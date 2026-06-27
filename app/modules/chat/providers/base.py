from abc import ABC, abstractmethod
from typing import List, Dict, Any, AsyncGenerator

class BaseAIProvider(ABC):
    def __init__(self, api_key: str = None, model_id: str = None):
        self.api_key = api_key
        self.model_id = model_id

    @abstractmethod
    async def generate_text_stream(self, prompt: str, history: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        """Streams text replies chunk-by-chunk from the LLM endpoint."""
        pass

    @abstractmethod
    async def list_models(self) -> List[Dict[str, str]]:
        """Queries the API endpoint to retrieve all active generative models."""
        pass
