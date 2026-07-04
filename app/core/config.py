import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "CentralAuth"
    SITE_NAME: str = "MindStack Identity"
    
    # Database
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    STORAGE_DIR: str = os.path.abspath(os.path.join(BASE_DIR, "..", "Storage", "database"))
    
    @property
    def DATABASE_URL(self) -> str:
        os.makedirs(self.STORAGE_DIR, exist_ok=True)
        db_path = os.path.join(self.STORAGE_DIR, "CentralAuth.db")
        return f"sqlite+aiosqlite:///{db_path}"
    
    @property
    def AIC_DATABASE_URL(self) -> str:
        os.makedirs(self.STORAGE_DIR, exist_ok=True)
        db_path = os.path.join(self.STORAGE_DIR, "AIChat.db")
        return f"sqlite+aiosqlite:///{db_path}"
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "central_auth_secret_key_999")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    
    UPLOAD_FOLDER: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "uploads")
    ALLOWED_EXTENSIONS: set = {"png", "jpg", "jpeg", "gif"}

    # AI Configurations (default system keys)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    CEREBRAS_API_KEY: str = os.getenv("CEREBRAS_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
    SAMBANOVA_API_KEY: str = os.getenv("SAMBANOVA_API_KEY", "")
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
    CLOUDFLARE_API_KEY: str = os.getenv("CLOUDFLARE_API_KEY", "")
    GITHUB_MODELS_API_KEY: str = os.getenv("GITHUB_MODELS_API_KEY", "")
    COHERE_API_KEY: str = os.getenv("COHERE_API_KEY", "")
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
    FIREWORKS_API_KEY: str = os.getenv("FIREWORKS_API_KEY", "")

    # Queue Configurations
    QUEUE_API_SECRET: str = os.getenv("QUEUE_API_SECRET", "super-secret-token-123")
    QUEUE_RATE_LIMIT_DELAY: int = int(os.getenv("QUEUE_RATE_LIMIT_DELAY", "60"))
    SOCKS5_PROXY: str = os.getenv("SOCKS5_PROXY", "")

    class Config:
        case_sensitive = True

settings = Settings()
