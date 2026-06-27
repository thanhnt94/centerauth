from app.modules.chat.providers.base import BaseAIProvider
from app.modules.chat.providers.google_studio import GoogleStudioProvider
from app.modules.chat.providers.openai import OpenAIProvider
from app.modules.chat.providers.anthropic_stub import AnthropicProvider
from app.modules.chat.providers.groq import GroqProvider
from app.modules.chat.providers.cerebras import CerebrasProvider
from app.modules.chat.providers.nvidia import NVIDIAProvider
from app.modules.chat.providers.sambanova import SambaNovaProvider
from app.modules.chat.providers.mistral import MistralProvider
from app.modules.chat.providers.cloudflare import CloudflareProvider
from app.modules.chat.providers.github_models import GitHubModelsProvider
from app.modules.chat.providers.cohere import CohereProvider
from app.modules.chat.providers.huggingface import HuggingFaceProvider
from app.modules.chat.providers.fireworks import FireworksProvider

# Provider registry map
PROVIDERS = {
    "google": GoogleStudioProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "groq": GroqProvider,
    "cerebras": CerebrasProvider,
    "nvidia": NVIDIAProvider,
    "sambanova": SambaNovaProvider,
    "mistral": MistralProvider,
    "cloudflare": CloudflareProvider,
    "github_models": GitHubModelsProvider,
    "cohere": CohereProvider,
    "huggingface": HuggingFaceProvider,
    "fireworks": FireworksProvider
}

def get_provider(name: str, api_key: str = None, model_id: str = None) -> BaseAIProvider:
    """
    Factory constructor returning the desired AI provider instance.
    Defaults to Google Studio if provider not found or mismatched.
    """
    name = (name or "google").lower()
    
    # Map any common synonyms
    if name == "gemini":
        name = "google"
        
    provider_class = PROVIDERS.get(name, GoogleStudioProvider)
    return provider_class(api_key=api_key, model_id=model_id)
