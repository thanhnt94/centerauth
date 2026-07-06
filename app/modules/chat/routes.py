from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import List, Optional
import uuid
import logging

from app.core.db_aichat import get_aichat_db as get_db, SessionLocal
from app.core.db import get_db as get_auth_db
from app.modules.chat.utils import get_current_user
from app.modules.identity.models import User
from app.modules.chat.models import ChatSession, Message
from app.modules.chat.providers import get_provider
from app.modules.admin.models import AIFailoverModel
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chatting"])

class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    model_used: Optional[str]
    created_at: str

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    content: str

class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

@router.get("/sessions", response_model=List[SessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all chat sessions of the logged-in user."""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
    )
    sessions = result.scalars().all()
    
    return [
        SessionResponse(
            id=s.id,
            title=s.title,
            created_at=s.created_at.isoformat()
        )
        for s in sessions
    ]

@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    data: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new chat session."""
    session_id = str(uuid.uuid4())
    session = ChatSession(
        id=session_id,
        title=data.title,
        user_id=current_user.id
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at.isoformat()
    )

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat session."""
    # Ensure it exists and belongs to the user
    result = await db.execute(
        select(ChatSession).where(
            (ChatSession.id == session_id) & (ChatSession.user_id == current_user.id)
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    await db.delete(session)
    await db.commit()
    return {"success": True, "message": "Session deleted successfully"}

@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all messages in a chat session."""
    # Validate session access
    result = await db.execute(
        select(ChatSession).where(
            (ChatSession.id == session_id) & (ChatSession.user_id == current_user.id)
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    
    return [
        MessageResponse(
            id=m.id,
            role=m.role,
            content=m.content,
            model_used=m.model_used,
            created_at=m.created_at.isoformat()
        )
        for m in messages
    ]

@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a user message, save it, and stream back the response from Gemini."""
    prompt = data.content.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Empty message content")

    # 1. Validate session and access
    result = await db.execute(
        select(ChatSession).where(
            (ChatSession.id == session_id) & (ChatSession.user_id == current_user.id)
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # 2. Get history (limit to last 20 messages for context efficiency)
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    history = [
        {"role": m.role, "content": m.content}
        for m in messages
    ]

    # Choose API Key and Model dynamically based on selected provider / key account
    import json
    
    active_key_id = current_user.active_key_id
    active_provider = "google"
    api_key = None
    model_name = ""
    
    if active_key_id == "system-google":
        active_provider = "google"
        api_key = settings.GEMINI_API_KEY
        model_name = current_user.google_model or "gemini-2.0-flash"
    elif active_key_id == "system-groq":
        active_provider = "groq"
        api_key = settings.GROQ_API_KEY
        model_name = current_user.groq_model or "llama-3.3-70b-versatile"
    elif active_key_id == "system-cerebras":
        active_provider = "cerebras"
        api_key = settings.CEREBRAS_API_KEY
        model_name = current_user.cerebras_model or "llama3.1-8b"
    elif active_key_id == "system-openai":
        active_provider = "openai"
        api_key = settings.OPENAI_API_KEY
        model_name = current_user.openai_model or "gpt-4o"
    elif active_key_id == "system-nvidia":
        active_provider = "nvidia"
        api_key = settings.NVIDIA_API_KEY
        model_name = current_user.nvidia_model or "meta/llama-3.3-70b-instruct"
    elif active_key_id == "system-sambanova":
        active_provider = "sambanova"
        api_key = settings.SAMBANOVA_API_KEY
        model_name = current_user.sambanova_model or "Meta-Llama-3.3-70B-Instruct"
    elif active_key_id == "system-mistral":
        active_provider = "mistral"
        api_key = settings.MISTRAL_API_KEY
        model_name = current_user.mistral_model or "mistral-large-latest"
    elif active_key_id == "system-cloudflare":
        active_provider = "cloudflare"
        api_key = settings.CLOUDFLARE_API_KEY
        model_name = current_user.cloudflare_model or "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    elif active_key_id == "system-github_models":
        active_provider = "github_models"
        api_key = settings.GITHUB_MODELS_API_KEY
        model_name = current_user.github_models_model or "gpt-4o"
    elif active_key_id == "system-cohere":
        active_provider = "cohere"
        api_key = settings.COHERE_API_KEY
        model_name = current_user.cohere_model or "command-r-plus"
    elif active_key_id == "system-huggingface":
        active_provider = "huggingface"
        api_key = settings.HUGGINGFACE_API_KEY
        model_name = current_user.huggingface_model or "meta-llama/Llama-3.3-70B-Instruct"
    elif active_key_id == "system-fireworks":
        active_provider = "fireworks"
        api_key = settings.FIREWORKS_API_KEY
        model_name = current_user.fireworks_model or "accounts/fireworks/models/llama-v3p3-70b-instruct"
    elif active_key_id:
        try:
            keys = json.loads(current_user.api_keys_json or "[]")
            matched = next((k for k in keys if k.get("id") == active_key_id), None)
            if matched:
                active_provider = matched.get("provider", "google")
                api_key = matched.get("api_key")
                model_name = matched.get("model")
                if not model_name:
                    if active_provider == "google":
                        model_name = current_user.google_model or "gemini-2.0-flash"
                    elif active_provider == "groq":
                        model_name = current_user.groq_model or "llama-3.3-70b-versatile"
                    elif active_provider == "cerebras":
                        model_name = current_user.cerebras_model or "llama3.1-8b"
                    elif active_provider == "openai":
                        model_name = current_user.openai_model or "gpt-4o"
                    elif active_provider == "nvidia":
                        model_name = current_user.nvidia_model or "meta/llama-3.3-70b-instruct"
                    elif active_provider == "sambanova":
                        model_name = current_user.sambanova_model or "Meta-Llama-3.3-70B-Instruct"
                    elif active_provider == "mistral":
                        model_name = current_user.mistral_model or "mistral-large-latest"
                    elif active_provider == "cloudflare":
                        model_name = current_user.cloudflare_model or "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
                    elif active_provider == "github_models":
                        model_name = current_user.github_models_model or "gpt-4o"
                    elif active_provider == "cohere":
                        model_name = current_user.cohere_model or "command-r-plus"
                    elif active_provider == "huggingface":
                        model_name = current_user.huggingface_model or "meta-llama/Llama-3.3-70B-Instruct"
                    elif active_provider == "fireworks":
                        model_name = current_user.fireworks_model or "accounts/fireworks/models/llama-v3p3-70b-instruct"
            else:
                active_key_id = None
        except Exception:
            active_key_id = None
            
    if not active_key_id:
        active_provider = current_user.active_provider or "google"
        if active_provider == "google":
            api_key = current_user.google_api_key or settings.GEMINI_API_KEY
            model_name = current_user.google_model or "gemini-2.0-flash"
        elif active_provider == "groq":
            api_key = current_user.groq_api_key or settings.GROQ_API_KEY
            model_name = current_user.groq_model or "llama-3.3-70b-versatile"
        elif active_provider == "cerebras":
            api_key = current_user.cerebras_api_key or settings.CEREBRAS_API_KEY
            model_name = current_user.cerebras_model or "llama3.1-8b"
        elif active_provider == "openai":
            api_key = current_user.openai_api_key or settings.OPENAI_API_KEY
            model_name = current_user.openai_model or "gpt-4o"
        elif active_provider == "nvidia":
            api_key = current_user.nvidia_api_key or settings.NVIDIA_API_KEY
            model_name = current_user.nvidia_model or "meta/llama-3.3-70b-instruct"
        elif active_provider == "sambanova":
            api_key = current_user.sambanova_api_key or settings.SAMBANOVA_API_KEY
            model_name = current_user.sambanova_model or "Meta-Llama-3.3-70B-Instruct"
        elif active_provider == "mistral":
            api_key = current_user.mistral_api_key or settings.MISTRAL_API_KEY
            model_name = current_user.mistral_model or "mistral-large-latest"
        elif active_provider == "cloudflare":
            api_key = current_user.cloudflare_api_key or settings.CLOUDFLARE_API_KEY
            model_name = current_user.cloudflare_model or "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
        elif active_provider == "github_models":
            api_key = current_user.github_models_api_key or settings.GITHUB_MODELS_API_KEY
            model_name = current_user.github_models_model or "gpt-4o"
        elif active_provider == "cohere":
            api_key = current_user.cohere_api_key or settings.COHERE_API_KEY
            model_name = current_user.cohere_model or "command-r-plus"
        elif active_provider == "huggingface":
            api_key = current_user.huggingface_api_key or settings.HUGGINGFACE_API_KEY
            model_name = current_user.huggingface_model or "meta-llama/Llama-3.3-70B-Instruct"
        elif active_provider == "fireworks":
            api_key = current_user.fireworks_api_key or settings.FIREWORKS_API_KEY
            model_name = current_user.fireworks_model or "accounts/fireworks/models/llama-v3p3-70b-instruct"

    # Save user message immediately to the main request db session
    user_msg = Message(
        session_id=session_id,
        role="user",
        content=prompt,
        model_used=model_name
    )
    db.add(user_msg)
    
    # If session is named "New Chat", auto-update it to the first 4 words of the prompt
    if session.title == "New Chat":
        words = prompt.split()
        title_suggestion = " ".join(words[:4])
        if len(words) > 4:
            title_suggestion += "..."
        session.title = title_suggestion
        
    await db.commit()
    
    service = get_provider(active_provider, api_key=api_key, model_id=model_name)

    # 4. Stream response generator
    async def response_streamer():
        accumulated_text = ""
        try:
            async for chunk in service.generate_text_stream(prompt, history):
                accumulated_text += chunk
                yield chunk
                
            # Stream complete. Save assistant reply using a fresh connection
            if accumulated_text.strip():
                async with SessionLocal() as db_write:
                    assistant_msg = Message(
                        session_id=session_id,
                        role="model", # google-genai expects "model"
                        content=accumulated_text,
                        model_used=model_name
                    )
                    db_write.add(assistant_msg)
                    await db_write.commit()
        except Exception as e:
            logger.error(f"Error streaming response: {e}")
            yield f"\n[Streaming Error]: {e}"

    return StreamingResponse(response_streamer(), media_type="text/plain")


# -------------------------------------------------------------------
# Settings & Model Discovery
# -------------------------------------------------------------------

class UpdateSettingsRequest(BaseModel):
    active_provider: Optional[str] = None
    active_key_id: Optional[str] = None
    api_keys_json: Optional[str] = None
    provider_name: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None


class DiscoverModelsRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None


@router.get("/settings")
async def get_chat_settings(
    current_user: User = Depends(get_current_user)
):
    """Retrieve masked API keys and selected models for all providers."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    def mask_key(k):
        return "********" if k else ""

    return {
        "active_provider": current_user.active_provider or "google",
        "active_key_id": current_user.active_key_id or "",
        "api_keys_json": current_user.api_keys_json or "[]",
        "has_google_fallback": bool(current_user.google_api_key or settings.GEMINI_API_KEY),
        "has_openai_fallback": bool(current_user.openai_api_key or settings.OPENAI_API_KEY),
        "has_groq_fallback": bool(current_user.groq_api_key or settings.GROQ_API_KEY),
        "has_cerebras_fallback": bool(current_user.cerebras_api_key or settings.CEREBRAS_API_KEY),
        "has_nvidia_fallback": bool(current_user.nvidia_api_key or settings.NVIDIA_API_KEY),
        "has_sambanova_fallback": bool(current_user.sambanova_api_key or settings.SAMBANOVA_API_KEY),
        "has_mistral_fallback": bool(current_user.mistral_api_key or settings.MISTRAL_API_KEY),
        "has_cloudflare_fallback": bool(current_user.cloudflare_api_key or settings.CLOUDFLARE_API_KEY),
        "has_github_models_fallback": bool(current_user.github_models_api_key or settings.GITHUB_MODELS_API_KEY),
        "has_cohere_fallback": bool(current_user.cohere_api_key or settings.COHERE_API_KEY),
        "has_huggingface_fallback": bool(current_user.huggingface_api_key or settings.HUGGINGFACE_API_KEY),
        "has_fireworks_fallback": bool(current_user.fireworks_api_key or settings.FIREWORKS_API_KEY),
        "providers": {
            "google": {"key": mask_key(current_user.google_api_key), "model": current_user.google_model or "gemini-2.0-flash"},
            "openai": {"key": mask_key(current_user.openai_api_key), "model": current_user.openai_model or "gpt-4o"},
            "anthropic": {"key": mask_key(current_user.anthropic_api_key), "model": current_user.anthropic_model or "claude-3-5-sonnet"},
            "groq": {"key": mask_key(current_user.groq_api_key), "model": current_user.groq_model or "llama-3.3-70b-versatile"},
            "cerebras": {"key": mask_key(current_user.cerebras_api_key), "model": current_user.cerebras_model or "llama3.1-8b"},
            "nvidia": {"key": mask_key(current_user.nvidia_api_key), "model": current_user.nvidia_model or "meta/llama-3.3-70b-instruct"},
            "sambanova": {"key": mask_key(current_user.sambanova_api_key), "model": current_user.sambanova_model or "Meta-Llama-3.3-70B-Instruct"},
            "mistral": {"key": mask_key(current_user.mistral_api_key), "model": current_user.mistral_model or "mistral-large-latest"},
            "cloudflare": {"key": mask_key(current_user.cloudflare_api_key), "model": current_user.cloudflare_model or "@cf/meta/llama-3.3-70b-instruct-fp8-fast"},
            "github_models": {"key": mask_key(current_user.github_models_api_key), "model": current_user.github_models_model or "gpt-4o"},
            "cohere": {"key": mask_key(current_user.cohere_api_key), "model": current_user.cohere_model or "command-r-plus"},
            "huggingface": {"key": mask_key(current_user.huggingface_api_key), "model": current_user.huggingface_model or "meta-llama/Llama-3.3-70B-Instruct"},
            "fireworks": {"key": mask_key(current_user.fireworks_api_key), "model": current_user.fireworks_model or "accounts/fireworks/models/llama-v3p3-70b-instruct"}
        }
    }


@router.post("/settings")
async def update_chat_settings(
    data: UpdateSettingsRequest,
    current_user: User = Depends(get_current_user),
    db_auth: AsyncSession = Depends(get_auth_db)
):
    """Save API Keys, models, or active default provider configurations."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Refresh/get the user within CentralAuth DB Session
    result = await db_auth.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.active_provider:
        user.active_provider = data.active_provider
    if data.active_key_id is not None:
        user.active_key_id = data.active_key_id
    if data.api_keys_json is not None:
        user.api_keys_json = data.api_keys_json

    if data.provider_name:
        p = data.provider_name.lower()
        key_col = f"{p}_api_key"
        model_col = f"{p}_model"
        
        # Save key if provided and not masked
        if data.api_key and data.api_key != "********":
            setattr(user, key_col, data.api_key)
        elif data.api_key == "":
            setattr(user, key_col, None)
            
        if data.model:
            setattr(user, model_col, data.model)

    await db_auth.commit()
    return {"success": True, "message": "AI settings updated successfully"}


@router.post("/models")
async def discover_models(
    data: DiscoverModelsRequest,
    current_user: User = Depends(get_current_user)
):
    """Call a provider dynamically to discover available model variants."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    p = data.provider.lower()
    api_key = data.api_key
    
    if api_key == "********" or not api_key:
        api_key = getattr(current_user, f"{p}_api_key", None)
        
    if not api_key:
        # Fall back to env system key configs
        fallback_keys = {
            "google": settings.GEMINI_API_KEY,
            "openai": settings.OPENAI_API_KEY,
            "groq": settings.GROQ_API_KEY,
            "cerebras": settings.CEREBRAS_API_KEY,
            "nvidia": settings.NVIDIA_API_KEY,
            "sambanova": settings.SAMBANOVA_API_KEY,
            "mistral": settings.MISTRAL_API_KEY,
            "cloudflare": settings.CLOUDFLARE_API_KEY,
            "github_models": settings.GITHUB_MODELS_API_KEY,
            "cohere": settings.COHERE_API_KEY,
            "huggingface": settings.HUGGINGFACE_API_KEY,
            "fireworks": settings.FIREWORKS_API_KEY
        }
        api_key = fallback_keys.get(p, "")

    if not api_key:
        return []
        
    try:
        service = get_provider(p, api_key=api_key)
        models = await service.list_models()
        return models
    except Exception as e:
        logger.error(f"Discover models failed for provider '{p}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ListModelsByKeyRequest(BaseModel):
    key_id: str


@router.post("/list-models")
async def list_models_by_key(
    data: ListModelsByKeyRequest,
    current_user: User = Depends(get_current_user)
):
    """Retrieve available models for a specific key_id (either custom key or system fallback)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    key_id = data.key_id
    provider = "google"
    api_key = None
    
    # 1. Check system keys
    if key_id.startswith("system-"):
        provider = key_id.replace("system-", "")
        api_key = getattr(current_user, f"{provider}_api_key", None)
        if not api_key:
            fallback_keys = {
                "google": settings.GEMINI_API_KEY,
                "openai": settings.OPENAI_API_KEY,
                "groq": settings.GROQ_API_KEY,
                "cerebras": settings.CEREBRAS_API_KEY,
                "nvidia": settings.NVIDIA_API_KEY,
                "sambanova": settings.SAMBANOVA_API_KEY,
                "mistral": settings.MISTRAL_API_KEY,
                "cloudflare": settings.CLOUDFLARE_API_KEY,
                "github_models": settings.GITHUB_MODELS_API_KEY,
                "cohere": settings.COHERE_API_KEY,
                "huggingface": settings.HUGGINGFACE_API_KEY,
                "fireworks": settings.FIREWORKS_API_KEY
            }
            api_key = fallback_keys.get(provider, "")
    else:
        # 2. Check custom keys
        import json
        try:
            keys = json.loads(current_user.api_keys_json or "[]")
            matched = next((k for k in keys if k.get("id") == key_id), None)
            if matched:
                provider = matched.get("provider", "google")
                api_key = matched.get("api_key")
        except Exception:
            pass
            
    if not api_key:
        return []
        
    try:
        service = get_provider(provider, api_key=api_key)
        models = await service.list_models()
        return models
    except Exception as e:
        logger.error(f"Failed to list models for key_id '{key_id}': {e}")
        raise HTTPException(status_code=400, detail=str(e))

class DirectGenerateRequest(BaseModel):
    prompt: str
    provider: Optional[str] = None
    model: Optional[str] = None

@router.post("/generate-direct")
async def generate_direct(
    body: DirectGenerateRequest,
    db: AsyncSession = Depends(get_auth_db)
):
    """Directly generate text using active administrator configurations, with automatic failover."""
    admins_result = await db.execute(
        select(User).where(User.is_admin == True).order_by(User.id.asc())
    )
    admins = admins_result.scalars().all()
    if not admins:
        raise HTTPException(status_code=400, detail="Administrator user not configured in CentralAuth.")
        
    admin_user = None
    for admin in admins:
        if admin.active_key_id:
            admin_user = admin
            break
    if not admin_user:
        admin_user = admins[0]

    # 1. Try AIFailoverModel database configs first (if any are enabled)
    pool_result = await db.execute(
        select(AIFailoverModel)
        .where(AIFailoverModel.is_enabled == True)
        .order_by(AIFailoverModel.priority.asc())
    )
    failover_models = pool_result.scalars().all()
    
    tried_candidates = []
    
    for candidate in failover_models:
        provider = candidate.provider
        key_id = candidate.key_id
        model = candidate.model_id
        
        # Resolve api_key from database custom keys
        api_key = None
        try:
            import json
            for admin in admins:
                keys = json.loads(admin.api_keys_json or "[]")
                matched = next((k for k in keys if k.get("id") == key_id), None)
                if matched:
                    api_key = matched.get("api_key")
                    break
        except Exception:
            pass
            
        if not api_key and not key_id.startswith("system-"):
            logger.warning(f"[FAILOVER] Key not configured for pool candidate: {candidate.key_label} ({provider})")
            continue
            
        tried_candidates.append(f"{candidate.key_label} [{model}]")
        
        try:
            logger.info(f"[FAILOVER] Attempting generation using candidate: {candidate.key_label} (model: {model})")
            service = get_provider(provider, api_key=api_key, model_id=model)
            response_chunks = []
            async for chunk in service.generate_text_stream(body.prompt, []):
                response_chunks.append(chunk)
            text = "".join(response_chunks).strip()
            
            # Check if it contains API error message
            if "[Google Studio API Error]" in text or "[Groq API Error]" in text or "API Error" in text or "quota" in text.lower():
                raise Exception(f"Provider returned error: {text[:150]}")
                
            return {"text": text, "provider": provider, "model": model, "key_label": candidate.key_label}
        except Exception as e:
            logger.error(f"[FAILOVER WARNING] Candidate {candidate.key_label} ({model}) failed: {e}")
            
    # 2. Final Fallback if pool is empty or all pool candidates failed
    logger.info("[FAILOVER] Falling back to default admin configuration...")
    active_key_id = admin_user.active_key_id
    active_provider = admin_user.active_provider or "google"
    api_key = None
    model_name = ""
    
    if active_key_id:
        try:
            import json
            matched = None
            for admin in admins:
                keys = json.loads(admin.api_keys_json or "[]")
                matched = next((k for k in keys if k.get("id") == active_key_id), None)
                if matched:
                    admin_user = admin  # bind to the correct admin user profile
                    break
            if matched:
                active_provider = matched.get("provider", "google")
                api_key = matched.get("api_key")
                model_name = matched.get("model")
                if not model_name:
                    if active_provider == "google":
                        model_name = admin_user.google_model or "gemini-2.0-flash"
                    elif active_provider == "groq":
                        model_name = admin_user.groq_model or "llama-3.3-70b-versatile"
                    elif active_provider == "cerebras":
                        model_name = admin_user.cerebras_model or "llama3.1-8b"
                    elif active_provider == "openai":
                        model_name = admin_user.openai_model or "gpt-4o"
                    elif active_provider == "nvidia":
                        model_name = admin_user.nvidia_model or "meta/llama-3.3-70b-instruct"
                    elif active_provider == "sambanova":
                        model_name = admin_user.sambanova_model or "Meta-Llama-3.3-70B-Instruct"
                    elif active_provider == "mistral":
                        model_name = admin_user.mistral_model or "mistral-large-latest"
                    elif active_provider == "cloudflare":
                        model_name = admin_user.cloudflare_model or "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
                    elif active_provider == "github_models":
                        model_name = admin_user.github_models_model or "gpt-4o"
                    elif active_provider == "cohere":
                        model_name = admin_user.cohere_model or "command-r-plus"
                    elif active_provider == "huggingface":
                        model_name = admin_user.huggingface_model or "meta-llama/Llama-3.3-70B-Instruct"
                    elif active_provider == "fireworks":
                        model_name = admin_user.fireworks_model or "accounts/fireworks/models/llama-v3p3-70b-instruct"
        except Exception:
            pass

    provider = body.provider or active_provider
    model = body.model or model_name
        
    if not api_key:
        raise HTTPException(status_code=400, detail=f"API key not configured for provider '{provider}'. Tried pool candidates: {tried_candidates}")
        
    try:
        service = get_provider(provider, api_key=api_key, model_id=model)
        response_chunks = []
        async for chunk in service.generate_text_stream(body.prompt, []):
            response_chunks.append(chunk)
        text = "".join(response_chunks).strip()
        return {"text": text, "provider": provider, "model": model, "key_label": "System Fallback"}
    except Exception as e:
        logger.error(f"Final default generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed after trying pool: {tried_candidates}. Error: {str(e)}")

class FailoverItem(BaseModel):
    provider: str
    key_id: str
    key_label: str
    model_id: str
    priority: int
    is_enabled: bool

class FailoverPoolSaveRequest(BaseModel):
    items: List[FailoverItem]

@router.get("/failover")
async def get_failover_pool(
    db: AsyncSession = Depends(get_auth_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve the current AI Failover Pool config and all available keys."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    pool_result = await db.execute(
        select(AIFailoverModel).order_by(AIFailoverModel.priority.asc())
    )
    pool = pool_result.scalars().all()
    pool_list = [
        {
            "id": item.id,
            "provider": item.provider,
            "key_id": item.key_id,
            "key_label": item.key_label,
            "model_id": item.model_id,
            "priority": item.priority,
            "is_enabled": item.is_enabled
        }
        for item in pool
    ]

    admin_user = current_user
    available_keys = []
    if admin_user:
        try:
            import json
            keys = json.loads(admin_user.api_keys_json or "[]")
            for k in keys:
                available_keys.append({
                    "key_id": k.get("id"),
                    "label": k.get("label"),
                    "provider": k.get("provider"),
                    "default_model": k.get("model", "")
                })
        except Exception:
            pass

    return {
        "failover_pool": pool_list,
        "available_keys": available_keys
    }

@router.post("/failover")
async def save_failover_pool(
    body: FailoverPoolSaveRequest,
    db: AsyncSession = Depends(get_auth_db),
    current_user: User = Depends(get_current_user)
):
    """Save the updated AI Failover Pool config."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    await db.execute(delete(AIFailoverModel))
    for idx, item in enumerate(body.items):
        db.add(
            AIFailoverModel(
                provider=item.provider,
                key_id=item.key_id,
                key_label=item.key_label,
                model_id=item.model_id,
                priority=idx,
                is_enabled=item.is_enabled
            )
        )
    await db.commit()
    return {"success": True, "message": "AI Failover Pool saved successfully!"}

from app.modules.chat.models import AICache

class AICacheItemResponse(BaseModel):
    prompt_hash: str
    prompt: str
    response: str
    provider: Optional[str] = None
    model: Optional[str] = None
    linked_cards: Optional[str] = None
    created_at: str

class PaginatedAICacheResponse(BaseModel):
    total: int
    caches: List[AICacheItemResponse]
    page: int
    limit: int

@router.get("/ai-cache", response_model=PaginatedAICacheResponse)
async def get_ai_caches(
    page: int = 1,
    limit: int = 24,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_auth_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    from sqlalchemy import func, or_
    stmt = select(AICache).order_by(AICache.created_at.desc())
    total_stmt = select(func.count()).select_from(AICache)
    
    if search:
        search_pattern = f"%{search.strip()}%"
        filter_cond = or_(
            AICache.prompt.like(search_pattern),
            AICache.response.like(search_pattern)
        )
        stmt = stmt.where(filter_cond)
        total_stmt = total_stmt.where(filter_cond)
        
    count_res = await db.execute(total_stmt)
    total_count = count_res.scalar() or 0
    
    stmt = stmt.offset((page - 1) * limit).limit(limit)
    res = await db.execute(stmt)
    items = res.scalars().all()
    
    caches_list = []
    for item in items:
        caches_list.append({
            "prompt_hash": item.prompt_hash,
            "prompt": item.prompt,
            "response": item.response,
            "provider": item.provider,
            "model": item.model,
            "linked_cards": item.linked_cards,
            "created_at": item.created_at.strftime('%Y-%m-%d %H:%M:%S') if item.created_at else ""
        })
        
    return {
        "total": total_count,
        "caches": caches_list,
        "page": page,
        "limit": limit
    }

@router.delete("/ai-cache/clear-all")
async def clear_all_ai_caches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_auth_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    await db.execute(delete(AICache))
    await db.commit()
    return {"success": True, "message": "All cached responses cleared successfully!"}

@router.post("/ai-cache/link")
async def link_card_to_cache(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_auth_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    prompt_hash = data.get("prompt_hash")
    card_id = data.get("card_id")
    field = data.get("field", "explanation")
    satellite_source = data.get("satellite_source", "vocaburn")
    callback_url = data.get("callback_url")
    
    if not prompt_hash or not card_id:
        raise HTTPException(status_code=400, detail="prompt_hash and card_id are required")
        
    try:
        card_id = int(card_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="card_id must be an integer")
        
    # Auto-construct callback_url if it's empty and satellite_source is vocaburn
    if not callback_url and satellite_source == "vocaburn":
        callback_url = f"http://vocaburn:8000/api/deck/card/{card_id}/update-field"
        
    # 1. Fetch target cache
    stmt = select(AICache).where(AICache.prompt_hash == prompt_hash)
    res = await db.execute(stmt)
    cache = res.scalar_one_or_none()
    if not cache:
        raise HTTPException(status_code=404, detail="Target cache entry not found")
        
    import json
    # 2. Clean up this card from other cache entries to enforce uniqueness
    other_caches_stmt = select(AICache).where(AICache.prompt_hash != prompt_hash, AICache.linked_cards != None, AICache.linked_cards != '[]')
    other_caches_res = await db.execute(other_caches_stmt)
    for other in other_caches_res.scalars().all():
        try:
            other_links = json.loads(other.linked_cards)
            updated_links = [
                ol for ol in other_links
                if not (ol.get("card_id") == card_id and ol.get("field") == field and ol.get("satellite_source") == satellite_source)
            ]
            if len(updated_links) != len(other_links):
                other.linked_cards = json.dumps(updated_links)
        except Exception:
            pass
            
    # 3. Add to target cache
    links = []
    if cache.linked_cards:
        try:
            links = json.loads(cache.linked_cards)
        except Exception:
            links = []
            
    new_link = {
        "satellite_source": satellite_source,
        "card_id": card_id,
        "field": field,
        "callback_url": callback_url
    }
    
    # Check if exists
    exists = any(
        l.get("card_id") == card_id and 
        l.get("field") == field and 
        l.get("satellite_source") == satellite_source 
        for l in links
    )
    if not exists:
        links.append(new_link)
        cache.linked_cards = json.dumps(links)
        
    await db.commit()
    
    # 4. Trigger callback immediately to sync card content with this cache
    if callback_url:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(callback_url, json={
                    "field": field,
                    "content": cache.response
                })
        except Exception as cb_err:
            return {"success": True, "message": f"Linked card successfully, but callback sync failed: {str(cb_err)}"}
            
    return {"success": True, "message": "Linked card successfully and synchronized content!"}

@router.post("/ai-cache/unlink")
async def unlink_card_from_cache(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_auth_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    prompt_hash = data.get("prompt_hash")
    card_id = data.get("card_id")
    field = data.get("field", "explanation")
    satellite_source = data.get("satellite_source", "vocaburn")
    
    if not prompt_hash or not card_id:
        raise HTTPException(status_code=400, detail="prompt_hash and card_id are required")
        
    try:
        card_id = int(card_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="card_id must be an integer")
        
    stmt = select(AICache).where(AICache.prompt_hash == prompt_hash)
    res = await db.execute(stmt)
    cache = res.scalar_one_or_none()
    if not cache:
        raise HTTPException(status_code=404, detail="Cache entry not found")
        
    import json
    links = []
    if cache.linked_cards:
        try:
            links = json.loads(cache.linked_cards)
        except Exception:
            links = []
            
    updated_links = [
        l for l in links
        if not (l.get("card_id") == card_id and l.get("field") == field and l.get("satellite_source") == satellite_source)
    ]
    
    cache.linked_cards = json.dumps(updated_links)
    await db.commit()
    return {"success": True, "message": "Unlinked card successfully!"}

@router.delete("/ai-cache/{prompt_hash}")
async def delete_ai_cache(
    prompt_hash: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_auth_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    await db.execute(delete(AICache).where(AICache.prompt_hash == prompt_hash))
    await db.commit()
    return {"success": True, "message": "Cached response deleted successfully!"}


@router.post("/ai-cache/regenerate")
async def regenerate_ai_cache(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_auth_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    prompt_hash = data.get("prompt_hash")
    custom_prompt = data.get("prompt")
    key_id = data.get("key_id")
    custom_model = data.get("model")
    
    if not prompt_hash:
        raise HTTPException(status_code=400, detail="prompt_hash is required")
        
    # 1. Fetch cache entry
    stmt = select(AICache).where(AICache.prompt_hash == prompt_hash)
    res = await db.execute(stmt)
    cache = res.scalar_one_or_none()
    if not cache:
        raise HTTPException(status_code=404, detail="Cache entry not found")
        
    import hashlib
    import json
    from app.core.config import settings
    from app.modules.chat.providers import get_provider
    from app.modules.queue.worker import _generate_text_full
    
    old_prompt = cache.prompt
    old_hash = cache.prompt_hash
    target_prompt = custom_prompt if custom_prompt is not None else old_prompt
    new_hash = hashlib.sha256(target_prompt.encode('utf-8')).hexdigest()
    
    model_to_use = custom_model if custom_model else cache.model
    
    # 2. Get admins for API keys
    admin_result = await db.execute(
        select(User).where(User.is_admin == True).order_by(User.id.asc())
    )
    admins = admin_result.scalars().all()
    if not admins:
        raise HTTPException(status_code=500, detail="No admin user found to resolve credentials.")
        
    # 3. Resolve key by key_id
    resolved_api_key = None
    provider_to_use = None
    
    if key_id:
        if key_id.startswith("system-"):
            provider_to_use = key_id.replace("system-", "")
            resolved_api_key = getattr(current_user, f"{provider_to_use}_api_key", None)
            if not resolved_api_key:
                fallback_keys = {
                    "google": settings.GEMINI_API_KEY,
                    "openai": settings.OPENAI_API_KEY,
                    "groq": settings.GROQ_API_KEY,
                    "cerebras": settings.CEREBRAS_API_KEY,
                    "nvidia": settings.NVIDIA_API_KEY,
                    "sambanova": settings.SAMBANOVA_API_KEY,
                    "mistral": settings.MISTRAL_API_KEY,
                    "cloudflare": settings.CLOUDFLARE_API_KEY,
                    "github_models": settings.GITHUB_MODELS_API_KEY,
                    "cohere": settings.COHERE_API_KEY,
                    "huggingface": settings.HUGGINGFACE_API_KEY,
                    "fireworks": settings.FIREWORKS_API_KEY
                }
                resolved_api_key = fallback_keys.get(provider_to_use, "")
        else:
            try:
                keys = json.loads(current_user.api_keys_json or "[]")
                matched = next((k for k in keys if k.get("id") == key_id), None)
                if matched:
                    provider_to_use = matched.get("provider", "google")
                    resolved_api_key = matched.get("api_key")
            except Exception:
                pass
                
    response_text = None
    success_provider_name = None
    success_model_name = None
    errors_accumulated = []
    
    # If resolved successfully, execute directly
    if resolved_api_key and provider_to_use:
        try:
            logger.info(f"[Regenerate-Cache] Directly using key_id '{key_id}' / provider '{provider_to_use}' with model '{model_to_use}'")
            provider = get_provider(provider_to_use, api_key=resolved_api_key, model_id=model_to_use)
            res_val = await _generate_text_full(provider, target_prompt)
            if res_val.strip().startswith("[") and "Error" in res_val:
                raise Exception(res_val)
            response_text = res_val
            success_provider_name = provider_to_use
            success_model_name = model_to_use
        except Exception as e:
            errors_accumulated.append(f"{provider_to_use} failed: {e}")
            
    # Fallback to candidates resolver if key_id didn't resolve or direct call failed
    if response_text is None:
        fallback_provider = provider_to_use or cache.provider or "google"
        logger.info(f"[Regenerate-Cache] Falling back to candidate failover resolver for provider: {fallback_provider}")
        class MockTask:
            def __init__(self, provider, model):
                self.provider = provider
                self.model = model
                self.provider_priority = None
        mock_task = MockTask(fallback_provider, model_to_use)
        
        from app.modules.queue.worker import _build_candidate_providers
        candidates = await _build_candidate_providers(mock_task, admins, db)
        for candidate in candidates:
            pname = candidate["provider_name"]
            pkey = candidate["api_key"]
            pmodel = candidate["model_id"]
            plabel = candidate["label"]
            try:
                logger.info(f"[Regenerate-Cache-Fallback] Trying provider '{plabel}' with model '{pmodel}'")
                provider = get_provider(pname, api_key=pkey, model_id=pmodel)
                res_val = await _generate_text_full(provider, target_prompt)
                if res_val.strip().startswith("[") and "Error" in res_val:
                    raise Exception(res_val)
                response_text = res_val
                success_provider_name = pname
                success_model_name = pmodel
                break
            except Exception as e:
                errors_accumulated.append(f"{plabel} failed: {e}")
                
    if response_text is None:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {'; '.join(errors_accumulated)}")
        
    # 5. Save updated cache (handle hash changes)
    from datetime import datetime
    
    linked_list = []
    try:
        if cache.linked_cards:
            linked_list = json.loads(cache.linked_cards)
    except Exception:
        pass
        
    # Backfill links from queued_tasks if present
    from app.modules.queue.models import QueuedTask
    tasks_res = await db.execute(select(QueuedTask).where(QueuedTask.prompt == old_prompt))
    matched_tasks = tasks_res.scalars().all()
    for task in matched_tasks:
        if task.callback_url and task.extra_data:
            try:
                extra = json.loads(task.extra_data)
                card_id = extra.get("card_id")
                field = extra.get("field", "explanation")
                if card_id:
                    new_link = {
                        "satellite": task.satellite_source,
                        "card_id": card_id,
                        "field": field,
                        "callback_url": task.callback_url
                    }
                    if not any(l.get("card_id") == card_id and l.get("field") == field for l in linked_list):
                        linked_list.append(new_link)
            except Exception:
                pass

    if new_hash != old_hash:
        # Delete old cache
        await db.execute(delete(AICache).where(AICache.prompt_hash == old_hash))
        
        # Check if new cache already exists
        new_cache_res = await db.execute(select(AICache).where(AICache.prompt_hash == new_hash))
        existing_new_cache = new_cache_res.scalar_one_or_none()
        
        if existing_new_cache:
            try:
                existing_links = json.loads(existing_new_cache.linked_cards or "[]")
                for link in linked_list:
                    if not any(l.get("card_id") == link.get("card_id") and l.get("field") == link.get("field") for l in existing_links):
                        existing_links.append(link)
                existing_new_cache.linked_cards = json.dumps(existing_links)
            except Exception:
                pass
            existing_new_cache.prompt = target_prompt
            existing_new_cache.response = response_text
            existing_new_cache.provider = success_provider_name
            existing_new_cache.model = success_model_name
            existing_new_cache.created_at = datetime.utcnow()
            cache = existing_new_cache
        else:
            new_cache = AICache(
                prompt_hash=new_hash,
                prompt=target_prompt,
                response=response_text,
                provider=success_provider_name,
                model=success_model_name,
                linked_cards=json.dumps(linked_list),
                created_at=datetime.utcnow()
            )
            db.add(new_cache)
            cache = new_cache
    else:
        cache.prompt = target_prompt
        cache.response = response_text
        cache.provider = success_provider_name
        cache.model = success_model_name
        cache.linked_cards = json.dumps(linked_list)
        cache.created_at = datetime.utcnow()
        
    await db.commit()
    
    # 6. Send callbacks to update matching cards
    callbacks_sent = 0
    notified_cards = set()
    
    for task in matched_tasks:
        task.prompt = target_prompt
        task.result = response_text
        task.status = "completed"
        task.completed_at = datetime.utcnow()
        if task.callback_url:
            try:
                await _send_callback(task)
                callbacks_sent += 1
            except Exception as callback_err:
                logger.error(f"[Regenerate-Cache] Callback failed for task {task.id}: {callback_err}")
            
            if task.extra_data:
                try:
                    extra = json.loads(task.extra_data)
                    c_id = extra.get("card_id")
                    f_name = extra.get("field", "explanation")
                    if c_id:
                        notified_cards.add((task.satellite_source, c_id, f_name))
                except Exception:
                    pass
                      
    for link in linked_list:
        satellite = link.get("satellite")
        card_id = link.get("card_id")
        field = link.get("field", "explanation")
        callback_url = link.get("callback_url")
        
        if (satellite, card_id, field) not in notified_cards:
            mock_task = QueuedTask(
                id=f"regen-mock-{uuid.uuid4()}",
                satellite_source=satellite,
                prompt=target_prompt,
                status="completed",
                result=response_text,
                callback_url=callback_url,
                extra_data=json.dumps({"card_id": card_id, "field": field, "task_type": "ai-explain"}),
                processed_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )
            try:
                await _send_callback(mock_task)
                callbacks_sent += 1
            except Exception as callback_err:
                logger.error(f"[Regenerate-Cache] Callback failed for permanent link {card_id}: {callback_err}")
                
    await db.commit()
    
    return {
        "success": True, 
        "message": f"Cache updated! Synced with {callbacks_sent} cards.",
        "response": response_text
    }

