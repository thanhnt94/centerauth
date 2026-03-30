import os
from dotenv import load_dotenv

# Base directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Load environment variables from .env if present
load_dotenv(os.path.join(BASE_DIR, '.env'))

class Config:
    """Application configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-dev-secret-key')
    SESSION_COOKIE_NAME = 'centralauth_session'
    
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'default-jwt-secret-key')
    JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))
    
    # Database
    # Default to sqlite at shared Storage/database/CentralAuth.db
    ECOSYSTEM_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
    STORAGE_DB_PATH = os.environ.get(
        'SQLALCHEMY_DATABASE_URI', 
        f'sqlite:///{os.path.join(ECOSYSTEM_ROOT, "Storage", "database", "CentralAuth.db")}'
    )
    SQLALCHEMY_DATABASE_URI = STORAGE_DB_PATH
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Uploads
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'app', 'static', 'uploads', 'avatars')
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024 # 2MB Limit
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
