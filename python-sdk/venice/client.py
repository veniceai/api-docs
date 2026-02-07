"""
Venice AI Client

Sync and async clients for the Venice API with full feature support.
"""

from __future__ import annotations
import os
import json
import warnings
from typing import Any, AsyncIterator, Dict, Iterator, List, Optional, Union

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

from .types import (
    Message,
    ChatCompletion,
    ChatCompletionChunk,
    ImageGenerateResponse,
    AudioTranscription,
    AudioSpeechResponse,
    VideoGenerateResponse,
    EmbeddingResponse,
    Character,
    Model,
    VeniceParameters,
    Tool,
    ReasoningEffort,
)
from .exceptions import (
    VeniceError,
    VeniceAPIError,
    VeniceAuthenticationError,
    VeniceConnectionError,
    VeniceTimeoutError,
    VeniceModelDeprecationWarning,
    raise_for_status,
)


DEFAULT_BASE_URL = "https://api.venice.ai/api/v1"
DEFAULT_TIMEOUT = 120.0


class BaseClient:
    """Base client with common functionality."""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = 2,
    ):
        self.api_key = api_key or os.environ.get("VENICE_API_KEY")
        if not self.api_key:
            raise VeniceAuthenticationError("API key required. Set VENICE_API_KEY or pass api_key.")
        
        self.base_url = (base_url or os.environ.get("VENICE_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "venice-python/0.1.0",
        }
    
    def _check_deprecation_headers(self, headers: Dict[str, str]) -> None:
        """Check for model deprecation warnings in response headers."""
        warning = headers.get("x-venice-model-deprecation-warning")
        if warning:
            date = headers.get("x-venice-model-deprecation-date")
            model = headers.get("x-venice-model-id", "unknown")
            warnings.warn(
                VeniceModelDeprecationWarning(model, date),
                stacklevel=4,
            )


# ============================================================================
# Chat Completions
# ============================================================================

class ChatCompletions:
    """Chat completions API."""
    
    def __init__(self, client: "Venice"):
        self._client = client
    
    def create(
        self,
        *,
        model: str,
        messages: List[Union[Message, Dict[str, Any]]],
        # Standard OpenAI params
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: Optional[int] = None,
        max_completion_tokens: Optional[int] = None,
        stream: bool = False,
        stop: Optional[Union[str, List[str]]] = None,
        frequency_penalty: Optional[float] = None,
        presence_penalty: Optional[float] = None,
        seed: Optional[int] = None,
        n: int = 1,
        logprobs: Optional[bool] = None,
        top_logprobs: Optional[int] = None,
        # Tool calling
        tools: Optional[List[Union[Tool, Dict[str, Any]]]] = None,
        tool_choice: Optional[Union[str, Dict[str, Any]]] = None,
        parallel_tool_calls: bool = True,
        # Response format
        response_format: Optional[Dict[str, Any]] = None,
        # Venice-specific
        venice_parameters: Optional[Union[VeniceParameters, Dict[str, Any]]] = None,
        reasoning_effort: Optional[ReasoningEffort] = None,
        prompt_cache_key: Optional[str] = None,
        # Convenience params (map to venice_parameters)
        enable_web_search: Optional[str] = None,
        character_slug: Optional[str] = None,
    ) -> Union[ChatCompletion, Iterator[ChatCompletionChunk]]:
        """Create a chat completion."""
        
        # Build request
        request: Dict[str, Any] = {
            "model": model,
            "messages": [
                m.to_dict() if isinstance(m, Message) else m
                for m in messages
            ],
        }
        
        # Add optional params
        if temperature is not None:
            request["temperature"] = temperature
        if top_p is not None:
            request["top_p"] = top_p
        if max_tokens is not None:
            request["max_tokens"] = max_tokens
        if max_completion_tokens is not None:
            request["max_completion_tokens"] = max_completion_tokens
        if stop is not None:
            request["stop"] = stop
        if frequency_penalty is not None:
            request["frequency_penalty"] = frequency_penalty
        if presence_penalty is not None:
            request["presence_penalty"] = presence_penalty
        if seed is not None:
            request["seed"] = seed
        if n != 1:
            request["n"] = n
        if logprobs is not None:
            request["logprobs"] = logprobs
        if top_logprobs is not None:
            request["top_logprobs"] = top_logprobs
        if response_format:
            request["response_format"] = response_format
        if prompt_cache_key:
            request["prompt_cache_key"] = prompt_cache_key
        if reasoning_effort:
            request["reasoning_effort"] = reasoning_effort.value if isinstance(reasoning_effort, ReasoningEffort) else reasoning_effort
        
        # Tools
        if tools:
            request["tools"] = [
                t.to_dict() if isinstance(t, Tool) else t
                for t in tools
            ]
        if tool_choice is not None:
            request["tool_choice"] = tool_choice
        if not parallel_tool_calls:
            request["parallel_tool_calls"] = False
        
        # Venice parameters
        vp: Dict[str, Any] = {}
        if venice_parameters:
            vp = venice_parameters.to_dict() if isinstance(venice_parameters, VeniceParameters) else venice_parameters
        # Convenience overrides
        if enable_web_search:
            vp["enable_web_search"] = enable_web_search
        if character_slug:
            vp["character_slug"] = character_slug
        if vp:
            request["venice_parameters"] = vp
        
        if stream:
            request["stream"] = True
            return self._stream(request)
        else:
            response = self._client._post("/chat/completions", request)
            return ChatCompletion.from_dict(response)
    
    def _stream(self, request: Dict[str, Any]) -> Iterator[ChatCompletionChunk]:
        """Stream chat completions."""
        for line in self._client._stream_post("/chat/completions", request):
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    yield ChatCompletionChunk.from_dict(chunk)
                except json.JSONDecodeError:
                    continue


class Chat:
    """Chat namespace."""
    
    def __init__(self, client: "Venice"):
        self.completions = ChatCompletions(client)


# ============================================================================
# Images
# ============================================================================

class Images:
    """Image generation API."""
    
    def __init__(self, client: "Venice"):
        self._client = client
    
    def generate(
        self,
        *,
        prompt: str,
        model: str = "fluently-xl",
        n: int = 1,
        size: str = "1024x1024",
        quality: str = "standard",
        style: Optional[str] = None,
        response_format: str = "url",
        # Venice-specific
        negative_prompt: Optional[str] = None,
        cfg_scale: Optional[float] = None,
        steps: Optional[int] = None,
        seed: Optional[int] = None,
        safe_mode: bool = True,
    ) -> ImageGenerateResponse:
        """Generate images from a text prompt."""
        request: Dict[str, Any] = {
            "prompt": prompt,
            "model": model,
            "n": n,
            "size": size,
            "quality": quality,
            "response_format": response_format,
        }
        
        if style:
            request["style"] = style
        if negative_prompt:
            request["negative_prompt"] = negative_prompt
        if cfg_scale is not None:
            request["cfg_scale"] = cfg_scale
        if steps is not None:
            request["steps"] = steps
        if seed is not None:
            request["seed"] = seed
        if not safe_mode:
            request["safe_mode"] = False
        
        response = self._client._post("/images/generations", request)
        return ImageGenerateResponse.from_dict(response)
    
    def edit(
        self,
        *,
        image: str,  # base64 or URL
        prompt: str,
        model: str = "fluently-xl",
        mask: Optional[str] = None,
        n: int = 1,
        size: str = "1024x1024",
    ) -> ImageGenerateResponse:
        """Edit an image with a prompt."""
        request: Dict[str, Any] = {
            "image": image,
            "prompt": prompt,
            "model": model,
            "n": n,
            "size": size,
        }
        if mask:
            request["mask"] = mask
        
        response = self._client._post("/images/edits", request)
        return ImageGenerateResponse.from_dict(response)
    
    def upscale(
        self,
        *,
        image: str,  # base64 or URL
        model: str = "real-esrgan-4x",
        scale: int = 4,
    ) -> ImageGenerateResponse:
        """Upscale an image."""
        request: Dict[str, Any] = {
            "image": image,
            "model": model,
            "scale": scale,
        }
        
        response = self._client._post("/images/upscale", request)
        return ImageGenerateResponse.from_dict(response)


# ============================================================================
# Audio
# ============================================================================

class Audio:
    """Audio API (TTS and transcription)."""
    
    def __init__(self, client: "Venice"):
        self._client = client
        self.speech = Speech(client)
        self.transcriptions = Transcriptions(client)


class Speech:
    """Text-to-speech API."""
    
    def __init__(self, client: "Venice"):
        self._client = client
    
    def create(
        self,
        *,
        input: str,
        model: str = "kokoro",
        voice: str = "af_bella",
        response_format: str = "mp3",
        speed: float = 1.0,
    ) -> AudioSpeechResponse:
        """Generate speech from text."""
        request: Dict[str, Any] = {
            "input": input,
            "model": model,
            "voice": voice,
            "response_format": response_format,
            "speed": speed,
        }
        
        audio_bytes = self._client._post_binary("/audio/speech", request)
        content_type = f"audio/{response_format}"
        return AudioSpeechResponse(audio=audio_bytes, content_type=content_type)


class Transcriptions:
    """Audio transcription API."""
    
    def __init__(self, client: "Venice"):
        self._client = client
    
    def create(
        self,
        *,
        file: bytes,
        model: str = "whisper-large-v3-turbo",
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        response_format: str = "json",
        temperature: float = 0.0,
        timestamp_granularities: Optional[List[str]] = None,
    ) -> AudioTranscription:
        """Transcribe audio to text."""
        # This endpoint uses multipart form data
        import base64
        
        request: Dict[str, Any] = {
            "file": base64.b64encode(file).decode(),
            "model": model,
            "response_format": response_format,
            "temperature": temperature,
        }
        
        if language:
            request["language"] = language
        if prompt:
            request["prompt"] = prompt
        if timestamp_granularities:
            request["timestamp_granularities"] = timestamp_granularities
        
        response = self._client._post("/audio/transcriptions", request)
        return AudioTranscription.from_dict(response)


# ============================================================================
# Embeddings
# ============================================================================

class Embeddings:
    """Embeddings API."""
    
    def __init__(self, client: "Venice"):
        self._client = client
    
    def create(
        self,
        *,
        input: Union[str, List[str]],
        model: str = "text-embedding-ada-002",
        encoding_format: str = "float",
        dimensions: Optional[int] = None,
    ) -> EmbeddingResponse:
        """Create embeddings for text."""
        request: Dict[str, Any] = {
            "input": input,
            "model": model,
            "encoding_format": encoding_format,
        }
        
        if dimensions is not None:
            request["dimensions"] = dimensions
        
        response = self._client._post("/embeddings", request)
        return EmbeddingResponse.from_dict(response)


# ============================================================================
# Models
# ============================================================================

class Models:
    """Models API."""
    
    def __init__(self, client: "Venice"):
        self._client = client
    
    def list(self) -> List[Model]:
        """List all available models."""
        response = self._client._get("/models")
        return [Model.from_dict(m) for m in response.get("data", [])]
    
    def retrieve(self, model_id: str) -> Model:
        """Retrieve a specific model."""
        response = self._client._get(f"/models/{model_id}")
        return Model.from_dict(response)


# ============================================================================
# Characters
# ============================================================================

class Characters:
    """Characters API."""
    
    def __init__(self, client: "Venice"):
        self._client = client
    
    def list(self, *, public_only: bool = True) -> List[Character]:
        """List available characters."""
        params = {"public_only": str(public_only).lower()}
        response = self._client._get("/characters", params=params)
        return [Character.from_dict(c) for c in response.get("data", [])]
    
    def retrieve(self, slug: str) -> Character:
        """Retrieve a specific character by slug."""
        response = self._client._get(f"/characters/{slug}")
        return Character.from_dict(response)


# ============================================================================
# Video
# ============================================================================

class Video:
    """Video generation API."""
    
    def __init__(self, client: "Venice"):
        self._client = client
    
    def generate(
        self,
        *,
        prompt: str,
        model: str = "kling-1.5-pro",
        duration: int = 5,
        aspect_ratio: str = "16:9",
        # Optional image for image-to-video
        image: Optional[str] = None,
    ) -> VideoGenerateResponse:
        """Generate a video from text or image."""
        request: Dict[str, Any] = {
            "prompt": prompt,
            "model": model,
            "duration": duration,
            "aspect_ratio": aspect_ratio,
        }
        
        if image:
            request["image"] = image
        
        response = self._client._post("/video/generations", request)
        return VideoGenerateResponse.from_dict(response)
    
    def status(self, video_id: str) -> VideoGenerateResponse:
        """Check status of a video generation."""
        response = self._client._get(f"/video/generations/{video_id}")
        return VideoGenerateResponse.from_dict(response)


# ============================================================================
# Sync Client
# ============================================================================

class Venice(BaseClient):
    """
    Venice AI Python client.
    
    Example:
        client = Venice(api_key="your-key")
        
        # Chat
        response = client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[{"role": "user", "content": "Hello!"}]
        )
        print(response.content)
        
        # Chat with web search
        response = client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[{"role": "user", "content": "What's the weather in NYC?"}],
            enable_web_search="on"
        )
        
        # Streaming
        for chunk in client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[{"role": "user", "content": "Tell me a story"}],
            stream=True
        ):
            if chunk.choices[0].delta.get("content"):
                print(chunk.choices[0].delta["content"], end="")
        
        # Image generation
        image = client.images.generate(prompt="A sunset over mountains")
        print(image.data[0].url)
    """
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        if httpx is None:
            raise ImportError("httpx is required. Install with: pip install httpx")
        
        self._http = httpx.Client(
            timeout=self.timeout,
            headers=self._get_headers(),
        )
        
        # Initialize namespaces
        self.chat = Chat(self)
        self.images = Images(self)
        self.audio = Audio(self)
        self.embeddings = Embeddings(self)
        self.models = Models(self)
        self.characters = Characters(self)
        self.video = Video(self)
    
    def _get(self, path: str, params: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Make a GET request."""
        url = f"{self.base_url}{path}"
        try:
            response = self._http.get(url, params=params)
            self._check_deprecation_headers(dict(response.headers))
            
            if response.status_code >= 400:
                raise_for_status(
                    response.json() if response.content else {},
                    response.status_code,
                    response.headers.get("cf-ray"),
                )
            return response.json()
        except httpx.TimeoutException:
            raise VeniceTimeoutError("Request timed out")
        except httpx.ConnectError as e:
            raise VeniceConnectionError(f"Connection failed: {e}")
    
    def _post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make a POST request."""
        url = f"{self.base_url}{path}"
        try:
            response = self._http.post(url, json=data)
            self._check_deprecation_headers(dict(response.headers))
            
            if response.status_code >= 400:
                raise_for_status(
                    response.json() if response.content else {},
                    response.status_code,
                    response.headers.get("cf-ray"),
                )
            return response.json()
        except httpx.TimeoutException:
            raise VeniceTimeoutError("Request timed out")
        except httpx.ConnectError as e:
            raise VeniceConnectionError(f"Connection failed: {e}")
    
    def _post_binary(self, path: str, data: Dict[str, Any]) -> bytes:
        """Make a POST request that returns binary data."""
        url = f"{self.base_url}{path}"
        try:
            response = self._http.post(url, json=data)
            self._check_deprecation_headers(dict(response.headers))
            
            if response.status_code >= 400:
                raise_for_status(
                    response.json() if response.content else {},
                    response.status_code,
                    response.headers.get("cf-ray"),
                )
            return response.content
        except httpx.TimeoutException:
            raise VeniceTimeoutError("Request timed out")
        except httpx.ConnectError as e:
            raise VeniceConnectionError(f"Connection failed: {e}")
    
    def _stream_post(self, path: str, data: Dict[str, Any]) -> Iterator[str]:
        """Make a streaming POST request."""
        url = f"{self.base_url}{path}"
        try:
            with self._http.stream("POST", url, json=data) as response:
                self._check_deprecation_headers(dict(response.headers))
                
                if response.status_code >= 400:
                    # Read full response for error
                    response.read()
                    raise_for_status(
                        response.json() if response.content else {},
                        response.status_code,
                        response.headers.get("cf-ray"),
                    )
                
                for line in response.iter_lines():
                    if line:
                        yield line
        except httpx.TimeoutException:
            raise VeniceTimeoutError("Request timed out")
        except httpx.ConnectError as e:
            raise VeniceConnectionError(f"Connection failed: {e}")
    
    def close(self) -> None:
        """Close the HTTP client."""
        self._http.close()
    
    def __enter__(self) -> "Venice":
        return self
    
    def __exit__(self, *args) -> None:
        self.close()


# ============================================================================
# Async Client
# ============================================================================

class AsyncChatCompletions:
    """Async chat completions API."""
    
    def __init__(self, client: "AsyncVenice"):
        self._client = client
    
    async def create(
        self,
        *,
        model: str,
        messages: List[Union[Message, Dict[str, Any]]],
        stream: bool = False,
        **kwargs,
    ) -> Union[ChatCompletion, AsyncIterator[ChatCompletionChunk]]:
        """Create a chat completion (async)."""
        request: Dict[str, Any] = {
            "model": model,
            "messages": [
                m.to_dict() if isinstance(m, Message) else m
                for m in messages
            ],
            **kwargs,
        }
        
        if stream:
            request["stream"] = True
            return self._stream(request)
        else:
            response = await self._client._post("/chat/completions", request)
            return ChatCompletion.from_dict(response)
    
    async def _stream(self, request: Dict[str, Any]) -> AsyncIterator[ChatCompletionChunk]:
        """Stream chat completions (async)."""
        async for line in self._client._stream_post("/chat/completions", request):
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    yield ChatCompletionChunk.from_dict(chunk)
                except json.JSONDecodeError:
                    continue


class AsyncChat:
    """Async chat namespace."""
    
    def __init__(self, client: "AsyncVenice"):
        self.completions = AsyncChatCompletions(client)


class AsyncVenice(BaseClient):
    """
    Async Venice AI Python client.
    
    Example:
        async with AsyncVenice(api_key="your-key") as client:
            response = await client.chat.completions.create(
                model="llama-3.3-70b",
                messages=[{"role": "user", "content": "Hello!"}]
            )
            print(response.content)
    """
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        if httpx is None:
            raise ImportError("httpx is required. Install with: pip install httpx")
        
        self._http = httpx.AsyncClient(
            timeout=self.timeout,
            headers=self._get_headers(),
        )
        
        # Initialize async namespaces
        self.chat = AsyncChat(self)
    
    async def _get(self, path: str, params: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Make an async GET request."""
        url = f"{self.base_url}{path}"
        try:
            response = await self._http.get(url, params=params)
            self._check_deprecation_headers(dict(response.headers))
            
            if response.status_code >= 400:
                raise_for_status(
                    response.json() if response.content else {},
                    response.status_code,
                    response.headers.get("cf-ray"),
                )
            return response.json()
        except httpx.TimeoutException:
            raise VeniceTimeoutError("Request timed out")
        except httpx.ConnectError as e:
            raise VeniceConnectionError(f"Connection failed: {e}")
    
    async def _post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make an async POST request."""
        url = f"{self.base_url}{path}"
        try:
            response = await self._http.post(url, json=data)
            self._check_deprecation_headers(dict(response.headers))
            
            if response.status_code >= 400:
                raise_for_status(
                    response.json() if response.content else {},
                    response.status_code,
                    response.headers.get("cf-ray"),
                )
            return response.json()
        except httpx.TimeoutException:
            raise VeniceTimeoutError("Request timed out")
        except httpx.ConnectError as e:
            raise VeniceConnectionError(f"Connection failed: {e}")
    
    async def _stream_post(self, path: str, data: Dict[str, Any]) -> AsyncIterator[str]:
        """Make an async streaming POST request."""
        url = f"{self.base_url}{path}"
        try:
            async with self._http.stream("POST", url, json=data) as response:
                self._check_deprecation_headers(dict(response.headers))
                
                if response.status_code >= 400:
                    await response.aread()
                    raise_for_status(
                        response.json() if response.content else {},
                        response.status_code,
                        response.headers.get("cf-ray"),
                    )
                
                async for line in response.aiter_lines():
                    if line:
                        yield line
        except httpx.TimeoutException:
            raise VeniceTimeoutError("Request timed out")
        except httpx.ConnectError as e:
            raise VeniceConnectionError(f"Connection failed: {e}")
    
    async def close(self) -> None:
        """Close the async HTTP client."""
        await self._http.aclose()
    
    async def __aenter__(self) -> "AsyncVenice":
        return self
    
    async def __aexit__(self, *args) -> None:
        await self.close()
