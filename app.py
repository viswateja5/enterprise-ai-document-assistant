import sys
import os

# Add backend directory to sys.path so it can resolve local module imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from backend.app import app
