from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings using pydantic-settings for environment variable management"""
    
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=False,
        extra='ignore'
    )
    
    # Database settings
    database_url: str = Field(
        default="sqlite:///./studytube.db",
        description="Database connection URL"
    )
    
    # JWT settings
    secret_key: str = Field(
        default="your-secret-key-here-please-change-in-production",
        description="JWT secret key for token signing"
    )
    algorithm: str = Field(
        default="HS256", 
        description="JWT algorithm"
    )
    access_token_expire_minutes: int = Field(
        default=1440,  # 24시간
        description="Access token expiration time in minutes"
    )
    
    # OpenAI settings
    openai_api_key: str = Field(
        default="", 
        description="OpenAI API key for STT and translation"
    )
    
    # Server settings
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    debug: bool = Field(default=True, description="Debug mode")
    
    # CORS settings
    cors_origins: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost",
            "http://127.0.0.1",
            "http://0.0.0.0",
            "http://0.0.0.0:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000"
        ],
        description="Allowed CORS origins"
    )
    
    # File upload settings
    upload_dir: str = Field(
        default="./uploads",
        description="Directory for file uploads"
    )
    max_file_size: int = Field(
        default=100 * 1024 * 1024,  # 100MB
        description="Maximum file size in bytes"
    )


# Global settings instance
settings = Settings() 