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
        db_path = os.path.join(self.STORAGE_DIR, "centralauth.db")
        return f"sqlite+aiosqlite:///{db_path}"
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "central_auth_secret_key_999")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    
    UPLOAD_FOLDER: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "uploads")
    ALLOWED_EXTENSIONS: set = {"png", "jpg", "jpeg", "gif"}

    class Config:
        case_sensitive = True

settings = Settings()
