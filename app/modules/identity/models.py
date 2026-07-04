from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.core.db import Base
from werkzeug.security import generate_password_hash, check_password_hash

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    email = Column(String(100), unique=True, index=True)
    password_hash = Column(String(255))
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # AI configuration stored per user (primarily used by admin)
    active_provider = Column(String(50), default="google")
    google_api_key = Column(String(500), nullable=True)
    google_model = Column(String(255), default="gemini-2.0-flash")
    openai_api_key = Column(String(500), nullable=True)
    openai_model = Column(String(255), default="gpt-4o")
    anthropic_api_key = Column(String(500), nullable=True)
    anthropic_model = Column(String(255), default="claude-3-5-sonnet")
    groq_api_key = Column(String(500), nullable=True)
    groq_model = Column(String(255), default="llama-3.3-70b-versatile")
    cerebras_api_key = Column(String(500), nullable=True)
    cerebras_model = Column(String(255), default="llama3.1-8b")
    nvidia_api_key = Column(String(500), nullable=True)
    nvidia_model = Column(String(255), default="meta/llama-3.3-70b-instruct")
    sambanova_api_key = Column(String(500), nullable=True)
    sambanova_model = Column(String(255), default="Meta-Llama-3.3-70B-Instruct")
    mistral_api_key = Column(String(500), nullable=True)
    mistral_model = Column(String(255), default="mistral-large-latest")
    cloudflare_api_key = Column(String(500), nullable=True)
    cloudflare_model = Column(String(255), default="@cf/meta/llama-3.3-70b-instruct-fp8-fast")
    github_models_api_key = Column(String(500), nullable=True)
    github_models_model = Column(String(255), default="gpt-4o")
    cohere_api_key = Column(String(500), nullable=True)
    cohere_model = Column(String(255), default="command-r-plus")
    huggingface_api_key = Column(String(500), nullable=True)
    huggingface_model = Column(String(255), default="meta-llama/Llama-3.3-70B-Instruct")
    fireworks_api_key = Column(String(500), nullable=True)
    fireworks_model = Column(String(255), default="accounts/fireworks/models/llama-v3p3-70b-instruct")
    
    # Multiple API key support
    api_keys_json = Column(String(4000), nullable=True, default="[]")
    active_key_id = Column(String(255), nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": "admin" if self.is_admin else "user",
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class UserClientRole(Base):
    __tablename__ = "user_client_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    client_id = Column(Integer, nullable=False, index=True)
    role = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
