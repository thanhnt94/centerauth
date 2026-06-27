from typing import List, Dict, Any, AsyncGenerator
from app.modules.chat.providers.base import BaseAIProvider

class AnthropicProvider(BaseAIProvider):
    """Stub implementation for Anthropic Claude integrations."""
    def __init__(self, api_key: str = None, model_id: str = "claude-3-5-sonnet"):
        super().__init__(api_key=api_key, model_id=model_id or "claude-3-5-sonnet")

    async def generate_text_stream(self, prompt: str, history: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        yield "[Anthropic Stub]: Anthropic provider is not fully implemented. " \
              "Configure your API client here using standard 'anthropic' package if desired."
        
    async def list_models(self) -> List[Dict[str, str]]:
        # Pre-seed standard Claude models lists
        return [
            {"id": "claude-3-5-sonnet", "display_name": "Claude 3.5 Sonnet (Default)"},
            {"id": "claude-3-5-haiku", "display_name": "Claude 3.5 Haiku"},
            {"id": "claude-3-opus", "display_name": "Claude 3 Opus"}
        ]
