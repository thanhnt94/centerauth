import httpx
import json
import logging
from typing import List, Dict, Any, AsyncGenerator
from app.modules.chat.providers.base import BaseAIProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

class MistralProvider(BaseAIProvider):
    """
    Mistral API provider.
    Connects to official Mistral completions endpoints.
    """
    def __init__(self, api_key: str = None, model_id: str = "mistral-large-latest"):
        resolved_key = api_key or settings.MISTRAL_API_KEY
        super().__init__(api_key=resolved_key, model_id=model_id or "mistral-large-latest")

    async def generate_text_stream(self, prompt: str, history: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield "Mistral API Key is not configured. Please enter your key in settings."
            return

        messages = []
        if history:
            for msg in history:
                role = "assistant" if msg.get("role") in ("model", "assistant") else "user"
                messages.append({
                    "role": role,
                    "content": msg.get("content")
                })
        
        messages.append({
            "role": "user",
            "content": prompt
        })

        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": self.model_id,
            "messages": messages,
            "stream": True
        }

        try:
            async with httpx.AsyncClient() as client:
                async with client.stream("POST", url, headers=headers, json=data, timeout=30.0) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        err_msg = err_body.decode('utf-8')
                        try:
                            err_json = json.loads(err_msg)
                            detail = err_json.get("message", err_msg)
                        except Exception:
                            detail = err_msg
                        yield f"\n[Mistral API Error {response.status_code}]: {detail}"
                        return
                    
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                text = chunk["choices"][0]["delta"].get("content", "")
                                if text:
                                    yield text
                            except Exception:
                                pass
        except Exception as e:
            logger.error(f"Error calling Mistral API: {e}")
            yield f"\n[Mistral API Exception]: {str(e)}"

    async def list_models(self) -> List[Dict[str, str]]:
        if not self.api_key:
            return []
            
        url = "https://api.mistral.ai/v1/models"
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers, timeout=10.0)
                if res.status_code == 200:
                    data = res.json()
                    models = []
                    for m in data.get("data", []):
                        m_id = m.get("id")
                        # Include text-generation models
                        if any(x in m_id.lower() for x in ("mistral", "mixtral", "codestral")):
                            models.append({
                                "id": m_id,
                                "display_name": m_id
                            })
                    models.sort(key=lambda x: x["id"])
                    return models
                else:
                    logger.error(f"Mistral list models returned status {res.status_code}: {res.text}")
                    return []
        except Exception as e:
            logger.error(f"Failed to list Mistral models: {e}")
            return []
