"""
Venice AI Python SDK

A comprehensive Python SDK for Venice AI with full API coverage,
async support, streaming, and LangChain integration.

Usage:
    from venice import Venice
    
    client = Venice(api_key="your-api-key")
    response = client.chat.completions.create(
        model="llama-3.3-70b",
        messages=[{"role": "user", "content": "Hello!"}]
    )
"""

from .client import Venice, AsyncVenice
from .types import (
    Message,
    ChatCompletion,
    ChatCompletionChunk,
    ImageGenerateResponse,
    AudioTranscription,
    VideoGenerateResponse,
    EmbeddingResponse,
    Character,
    Model,
    VeniceParameters,
)
from .exceptions import (
    VeniceError,
    VeniceAPIError,
    VeniceAuthenticationError,
    VeniceRateLimitError,
    VeniceTimeoutError,
)

__version__ = "0.1.0"
__all__ = [
    # Clients
    "Venice",
    "AsyncVenice",
    # Types
    "Message",
    "ChatCompletion",
    "ChatCompletionChunk",
    "ImageGenerateResponse",
    "AudioTranscription",
    "VideoGenerateResponse",
    "EmbeddingResponse",
    "Character",
    "Model",
    "VeniceParameters",
    # Exceptions
    "VeniceError",
    "VeniceAPIError",
    "VeniceAuthenticationError",
    "VeniceRateLimitError",
    "VeniceTimeoutError",
]
