import bcrypt
if not hasattr(bcrypt, "__about__"):
    class DummyAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.1")
    bcrypt.__about__ = DummyAbout()

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Local imports
from database.connection import init_db, get_db
from core.rate_limit import limiter
from middleware.monitor_middleware import MonitorMiddleware
from cache.redis_cache import init_redis, redis_client
from routers.auth import auth_router
from routers.rag_router import rag_router
from routers.admin_router import admin_router
from routers.agent_router import agent_router
from routers.voice_router import voice_router
from routers.edu_router import edu_router
from routers.export_router import export_router
from schemas.api_schemas import HealthResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("rag-backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup database initializations and cache connectivity configurations.
    """
    logger.info("Initializing Enterprise AI Document Assistant backend...")
    
    async def startup_tasks():
        try:
            await init_db()
            logger.info("Database initialized successfully in background.")
        except Exception as e:
            logger.error(f"Database initialization failed in background: {e}")
            
        try:
            await init_redis()
        except Exception as e:
            logger.error(f"Redis initialization failed in background: {e}")

    import asyncio
    asyncio.create_task(startup_tasks())
    
    # 3. ML Models are lazy loaded on demand to minimize startup RAM below 100 MB.
    logger.info("ML Models deferred (lazy loaded on active search/study queries).")
    
    yield
    logger.info("Shutting down Enterprise AI Document Assistant backend...")

app = FastAPI(
    title="Enterprise AI Document Assistant",
    description="Production-grade, modular RAG Chatbot API service.",
    version="2.0.0",
    lifespan=lifespan
)

# Bind slowapi limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS Middleware
allowed_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
)
origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Configure GZip Compression Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configure custom Prometheus MonitorMiddleware
app.add_middleware(MonitorMiddleware)

# Custom Rate Limit Exceeded Exception Handler
@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    logger.warning(f"Rate limit exceeded by IP: {request.client.host}")
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many requests. Please wait a moment before retrying."}
    )

# Expose Prometheus scrapable metrics endpoint
@app.get("/metrics", include_in_schema=False)
async def prometheus_metrics():
    """
    Exposes raw Prometheus metrics for monitoring services (e.g. Grafana).
    """
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Liveness and readiness check. Validates SQLite/Postgres and Redis cache status.
    """
    db_connected = False
    try:
        await db.execute(text("SELECT 1"))
        db_connected = True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        
    redis_connected = False
    if redis_client:
        try:
            await redis_client.ping()
            redis_connected = True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            
    # Gather active models provider config list
    provider = os.getenv("MODEL_PROVIDER", "openai")
    
    return HealthResponse(
        status="healthy" if db_connected else "degraded",
        database_connected=db_connected,
        redis_connected=redis_connected,
        supported_models=["openai", "gemini", "groq", "ollama"]
    )

# Include Sub-Routers
app.include_router(auth_router)
app.include_router(rag_router)
app.include_router(admin_router)
app.include_router(agent_router)
app.include_router(voice_router)
app.include_router(edu_router)
app.include_router(export_router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "10000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port)
