import httpx
import json
import logging
from typing import List, Dict, Any, AsyncGenerator
from app.modules.chat.providers.base import BaseAIProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

class HuggingFaceProvider(BaseAIProvider):
    """
    Hugging Face Inference API provider.
    """
    def __init__(self, api_key: str = None, model_id: str = "meta-llama/Llama-3.3-70B-Instruct"):
        resolved_key = api_key or settings.HUGGINGFACE_API_KEY
        super().__init__(api_key=resolved_key, model_id=model_id or "meta-llama/Llama-3.3-70B-Instruct")

    async def generate_text_stream(self, prompt: str, history: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield "Hugging Face Token is not configured. Please enter your token in settings."
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

        url = f"https://api-inference.huggingface.co/models/{self.model_id}/v1/chat/completions"
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
                            detail = err_json.get("error", err_msg)
                        except Exception:
                            detail = err_msg
                        yield f"\n[Hugging Face API Error {response.status_code}]: {detail}"
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
            logger.error(f"Error calling Hugging Face API: {e}")
            yield f"\n[Hugging Face API Exception]: {str(e)}"

    async def list_models(self) -> List[Dict[str, str]]:
        return [
            {"id": "meta-llama/Llama-3.3-70B-Instruct", "display_name": "meta-llama/Llama-3.3-70B-Instruct"},
            {"id": "mistralai/Mistral-7B-Instruct-v0.3", "display_name": "mistralai/Mistral-7B-Instruct-v0.3"},
            {"id": "Qwen/Qwen2.5-72B-Instruct", "display_name": "Qwen/Qwen2.5-72B-Instruct"},
            {"id": "microsoft/Phi-3-mini-4k-instruct", "display_name": "microsoft/Phi-3-mini-4k-instruct"},
            {"id": "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", "display_name": "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B"}
        ]
