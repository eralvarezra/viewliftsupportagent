# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.auth.routes import router as auth_router
from app.routes.generate import router as generate_router
from app.routes.faqs import router as faqs_router
from app.routes.history import router as history_router
from app.routes.users import router as users_router
from app.routes.insights import router as insights_router

app = FastAPI(
    title="SCHN+ Support Assistant",
    description="Internal API for generating customer support responses",
    version="1.0.0",
    redirect_slashes=False  # Disable trailing slash redirects
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(generate_router, prefix="/api", tags=["generate"])
app.include_router(faqs_router, prefix="/api/faqs", tags=["faqs"])
app.include_router(history_router, prefix="/api/history", tags=["history"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(insights_router, prefix="/api/insights", tags=["insights"])


@app.on_event("startup")
async def startup_event():
    init_db()
    # Create admin user if not exists
    from app.auth.utils import create_admin_user
    create_admin_user()


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
