import os
from typing import Any

def get_clean_env_var(name: str) -> str:
    """
    Retrieves environment variable and returns empty string if value is
    unset, empty, or literally "undefined", "null", or "none".
    """
    val = os.getenv(name)
    if not val:
        return ""
    val_clean = val.strip().lower()
    if val_clean in ("", "undefined", "null", "none"):
        return ""
    return val

def get_llm(streaming: bool = True, temperature: float = 0.0) -> Any:
    """
    Dynamically instantiates and returns the configured LLM provider client
    based on the MODEL_PROVIDER environment variable.
    
    Supported values: 'openai', 'gemini', 'groq', 'ollama'
    """
    provider = os.getenv("MODEL_PROVIDER", "openai").lower()
    
    openai_key = get_clean_env_var("OPENAI_API_KEY")
    google_key = get_clean_env_var("GOOGLE_API_KEY")
    groq_key = get_clean_env_var("GROQ_API_KEY")
    
    # Auto-fallback detection if the chosen provider's key is not set
    if provider == "openai" and not openai_key:
        if google_key:
            provider = "gemini"
        elif groq_key:
            provider = "groq"
    elif provider == "gemini" and not google_key:
        if openai_key:
            provider = "openai"
        elif groq_key:
            provider = "groq"
    elif provider == "groq" and not groq_key:
        if openai_key:
            provider = "openai"
        elif google_key:
            provider = "gemini"
    
    if provider == "openai":
        if not openai_key:
            raise ValueError("No valid OpenAI API key found. Please configure OPENAI_API_KEY.")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="gpt-4o-mini", 
            temperature=temperature, 
            streaming=streaming,
            openai_api_key=openai_key
        )
        
    elif provider == "gemini":
        if not google_key:
            raise ValueError("No valid Gemini API key found. Please configure GOOGLE_API_KEY.")
        # Lazy import to avoid loading unused packages
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-flash", 
            google_api_key=google_key, 
            temperature=temperature, 
            streaming=streaming
        )
        
    elif provider == "groq":
        if not groq_key:
            raise ValueError("No valid Groq API key found. Please configure GROQ_API_KEY.")
        from langchain_groq import ChatGroq
        return ChatGroq(
            model="llama-3.3-70b-versatile", 
            groq_api_key=groq_key, 
            temperature=temperature, 
            streaming=streaming
        )
        
    elif provider == "ollama":
        from langchain_community.chat_models import ChatOllama
        ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        return ChatOllama(
            model="llama3", 
            base_url=ollama_host, 
            temperature=temperature
        )
        
    else:
        raise ValueError(
            f"Unsupported MODEL_PROVIDER '{provider}'. "
            f"Supported options are: 'openai', 'gemini', 'groq', 'ollama'"
        )
