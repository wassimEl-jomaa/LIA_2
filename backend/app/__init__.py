"""ASGI package entrypoint for the backend API."""

from .main import app as api

# Backwards-compatible alias for common Uvicorn targets.
app = api
