from google import genai
from google.genai import types
from typing import List, Dict, Any, AsyncGenerator

from app.modules.chat.providers.base import BaseAIProvider
from app.core.config import settings

class GoogleStudioProvider(BaseAIProvider):
    def __init__(self, api_key: str = None, model_id: str = "gemini-2.0-flash"):
        # Resolve keys: custom key -> global env key
        resolved_key = api_key or settings.GEMINI_API_KEY
        super().__init__(api_key=resolved_key, model_id=model_id or "gemini-2.0-flash")
        
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    async def generate_text_stream(self, prompt: str, history: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        if not self.client:
            yield "Google AI Studio API Key is not configured. Please enter your key in settings."
            return

        # Format historical dialogues
        contents = []
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg.get("content"))]
                    )
                )
        
        # Append the active prompt
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=prompt)]
            )
        )

        try:
            response_stream = await self.client.aio.models.generate_content_stream(
                model=self.model_id,
                contents=contents
            )
            async for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"\n[Google Studio API Error]: {str(e)}"

    async def list_models(self) -> List[Dict[str, str]]:
        if not self.client:
            return []
            
        try:
            model_list = list(self.client.models.list())
            models = []
            
            for m in model_list:
                methods = getattr(m, 'supported_generation_methods', [])
                is_generative = any('generateContent' in str(method) or 'generate_content' in str(method) for method in methods)
                if is_generative or not methods:
                    model_id = m.name.split('/')[-1] if '/' in m.name else m.name
                    models.append({
                        "id": model_id,
                        "display_name": m.display_name or model_id
                    })
                    
            if not models and model_list:
                models = [{"id": m.name.split('/')[-1], "display_name": m.display_name or m.name} for m in model_list]
                
            return models
        except Exception as e:
            # Propagate error if key is invalid
            raise e
