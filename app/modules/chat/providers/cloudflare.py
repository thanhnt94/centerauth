import httpx
import json
import logging
from typing import List, Dict, Any, AsyncGenerator
from app.modules.chat.providers.base import BaseAIProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

class CloudflareProvider(BaseAIProvider):
    """
    Cloudflare Workers AI Provider.
    Requires api_key in format: ACCOUNT_ID:API_TOKEN
    """
    def __init__(self, api_key: str = None, model_id: str = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"):
        resolved_key = api_key or settings.CLOUDFLARE_API_KEY
        super().__init__(api_key=resolved_key, model_id=model_id or "@cf/meta/llama-3.3-70b-instruct-fp8-fast")

    async def generate_text_stream(self, prompt: str, history: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield "Cloudflare API Key is not configured. Please enter your key (Format: ACCOUNT_ID:API_TOKEN) in settings."
            return

        if ":" not in self.api_key:
            yield "Invalid Cloudflare API Key format. Expected ACCOUNT_ID:API_TOKEN"
            return

        account_id, api_token = self.api_key.split(":", 1)
        account_id = account_id.strip()
        api_token = api_token.strip()

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

        url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_token}",
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
                            detail = err_json.get("errors", [{}])[0].get("message", err_msg)
                        except Exception:
                            detail = err_msg
                        yield f"\n[Cloudflare AI Error {response.status_code}]: {detail}"
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
            logger.error(f"Error calling Cloudflare AI: {e}")
            yield f"\n[Cloudflare AI Exception]: {str(e)}"

    async def list_models(self) -> List[Dict[str, str]]:
        # Return a static list of popular Cloudflare Workers AI models
        return [
            {"id": "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "display_name": "Llama 3.3 70B Instruct FP8 Fast"},
            {"id": "@cf/meta/llama-3.1-8b-instruct", "display_name": "Llama 3.1 8B Instruct"},
            {"id": "@cf/qwen/qwen1.5-14b-chat-awq", "display_name": "Qwen 1.5 14B Chat AWQ"},
            {"id": "@cf/mistral/mistral-7b-instruct-v0.2", "display_name": "Mistral 7B Instruct v0.2"},
            {"id": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "display_name": "DeepSeek R1 Distill Qwen 32B"}
        ]
