"""
Venice AI Types

Comprehensive type definitions for all Venice API entities.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Union
from enum import Enum


# ============================================================================
# Enums
# ============================================================================

class WebSearchMode(str, Enum):
    """Web search modes for Venice API."""
    OFF = "off"
    ON = "on"
    AUTO = "auto"


class ReasoningEffort(str, Enum):
    """Reasoning effort levels for supported models."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AudioFormat(str, Enum):
    """Supported audio formats."""
    WAV = "wav"
    MP3 = "mp3"
    AIFF = "aiff"
    AAC = "aac"
    OGG = "ogg"
    FLAC = "flac"
    M4A = "m4a"


class TTSVoice(str, Enum):
    """Available TTS voices."""
    AF_BELLA = "af_bella"
    AF_NICOLE = "af_nicole"
    AF_SARAH = "af_sarah"
    AF_SKY = "af_sky"
    AM_ADAM = "am_adam"
    AM_MICHAEL = "am_michael"
    BF_EMMA = "bf_emma"
    BF_ISABELLA = "bf_isabella"
    BM_GEORGE = "bm_george"
    BM_LEWIS = "bm_lewis"


# ============================================================================
# Message Types
# ============================================================================

@dataclass
class TextContent:
    """Text content part."""
    type: Literal["text"] = "text"
    text: str = ""
    cache_control: Optional[Dict[str, Any]] = None


@dataclass  
class ImageContent:
    """Image content part for vision models."""
    type: Literal["image_url"] = "image_url"
    image_url: Dict[str, str] = field(default_factory=dict)
    cache_control: Optional[Dict[str, Any]] = None
    
    @classmethod
    def from_url(cls, url: str) -> "ImageContent":
        """Create ImageContent from a URL."""
        return cls(image_url={"url": url})
    
    @classmethod
    def from_base64(cls, data: str, media_type: str = "image/png") -> "ImageContent":
        """Create ImageContent from base64 data."""
        return cls(image_url={"url": f"data:{media_type};base64,{data}"})


@dataclass
class AudioContent:
    """Audio content part for audio models."""
    type: Literal["input_audio"] = "input_audio"
    input_audio: Dict[str, str] = field(default_factory=dict)
    
    @classmethod
    def from_base64(cls, data: str, format: str = "wav") -> "AudioContent":
        """Create AudioContent from base64 data."""
        return cls(input_audio={"data": data, "format": format})


@dataclass
class VideoContent:
    """Video content part for video models."""
    type: Literal["video_url"] = "video_url"
    video_url: Dict[str, str] = field(default_factory=dict)
    
    @classmethod
    def from_url(cls, url: str) -> "VideoContent":
        """Create VideoContent from a URL."""
        return cls(video_url={"url": url})


ContentPart = Union[TextContent, ImageContent, AudioContent, VideoContent, Dict[str, Any]]


@dataclass
class Message:
    """A message in a conversation."""
    role: Literal["system", "user", "assistant", "tool", "developer"]
    content: Union[str, List[ContentPart]]
    name: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    reasoning_content: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to API-compatible dict."""
        result: Dict[str, Any] = {"role": self.role}
        
        if isinstance(self.content, str):
            result["content"] = self.content
        else:
            result["content"] = [
                c.to_dict() if hasattr(c, 'to_dict') else c 
                for c in self.content
            ]
        
        if self.name:
            result["name"] = self.name
        if self.tool_calls:
            result["tool_calls"] = self.tool_calls
        if self.tool_call_id:
            result["tool_call_id"] = self.tool_call_id
        if self.reasoning_content:
            result["reasoning_content"] = self.reasoning_content
            
        return result


# ============================================================================
# Venice-Specific Parameters
# ============================================================================

@dataclass
class VeniceParameters:
    """Venice-specific API parameters."""
    character_slug: Optional[str] = None
    strip_thinking_response: bool = False
    disable_thinking: bool = False
    enable_web_search: WebSearchMode = WebSearchMode.OFF
    enable_web_scraping: bool = False
    enable_web_citations: bool = False
    include_search_results_in_stream: bool = False
    return_search_results_as_documents: bool = False
    include_venice_system_prompt: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to API-compatible dict, excluding defaults."""
        result = {}
        if self.character_slug:
            result["character_slug"] = self.character_slug
        if self.strip_thinking_response:
            result["strip_thinking_response"] = True
        if self.disable_thinking:
            result["disable_thinking"] = True
        if self.enable_web_search != WebSearchMode.OFF:
            result["enable_web_search"] = self.enable_web_search.value
        if self.enable_web_scraping:
            result["enable_web_scraping"] = True
        if self.enable_web_citations:
            result["enable_web_citations"] = True
        if self.include_search_results_in_stream:
            result["include_search_results_in_stream"] = True
        if self.return_search_results_as_documents:
            result["return_search_results_as_documents"] = True
        if not self.include_venice_system_prompt:
            result["include_venice_system_prompt"] = False
        return result


# ============================================================================
# Response Types
# ============================================================================

@dataclass
class Usage:
    """Token usage statistics."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Usage":
        return cls(
            prompt_tokens=data.get("prompt_tokens", 0),
            completion_tokens=data.get("completion_tokens", 0),
            total_tokens=data.get("total_tokens", 0),
        )


@dataclass
class Choice:
    """A completion choice."""
    index: int
    message: Message
    finish_reason: Optional[str] = None
    logprobs: Optional[Dict[str, Any]] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Choice":
        msg_data = data.get("message", {})
        return cls(
            index=data.get("index", 0),
            message=Message(
                role=msg_data.get("role", "assistant"),
                content=msg_data.get("content", ""),
                tool_calls=msg_data.get("tool_calls"),
                reasoning_content=msg_data.get("reasoning_content"),
            ),
            finish_reason=data.get("finish_reason"),
            logprobs=data.get("logprobs"),
        )


@dataclass
class ChatCompletion:
    """Chat completion response."""
    id: str
    object: str
    created: int
    model: str
    choices: List[Choice]
    usage: Optional[Usage] = None
    system_fingerprint: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChatCompletion":
        return cls(
            id=data.get("id", ""),
            object=data.get("object", "chat.completion"),
            created=data.get("created", 0),
            model=data.get("model", ""),
            choices=[Choice.from_dict(c) for c in data.get("choices", [])],
            usage=Usage.from_dict(data["usage"]) if data.get("usage") else None,
            system_fingerprint=data.get("system_fingerprint"),
        )
    
    @property
    def content(self) -> Optional[str]:
        """Get the content of the first choice."""
        if self.choices and self.choices[0].message.content:
            content = self.choices[0].message.content
            return content if isinstance(content, str) else None
        return None


@dataclass
class DeltaChoice:
    """A streaming choice delta."""
    index: int
    delta: Dict[str, Any]
    finish_reason: Optional[str] = None
    logprobs: Optional[Dict[str, Any]] = None


@dataclass
class ChatCompletionChunk:
    """Streaming chat completion chunk."""
    id: str
    object: str
    created: int
    model: str
    choices: List[DeltaChoice]
    usage: Optional[Usage] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChatCompletionChunk":
        choices = []
        for c in data.get("choices", []):
            choices.append(DeltaChoice(
                index=c.get("index", 0),
                delta=c.get("delta", {}),
                finish_reason=c.get("finish_reason"),
                logprobs=c.get("logprobs"),
            ))
        return cls(
            id=data.get("id", ""),
            object=data.get("object", "chat.completion.chunk"),
            created=data.get("created", 0),
            model=data.get("model", ""),
            choices=choices,
            usage=Usage.from_dict(data["usage"]) if data.get("usage") else None,
        )


# ============================================================================
# Image Types
# ============================================================================

@dataclass
class ImageData:
    """Generated image data."""
    url: Optional[str] = None
    b64_json: Optional[str] = None
    revised_prompt: Optional[str] = None


@dataclass
class ImageGenerateResponse:
    """Image generation response."""
    created: int
    data: List[ImageData]
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImageGenerateResponse":
        return cls(
            created=data.get("created", 0),
            data=[
                ImageData(
                    url=img.get("url"),
                    b64_json=img.get("b64_json"),
                    revised_prompt=img.get("revised_prompt"),
                )
                for img in data.get("data", [])
            ],
        )


# ============================================================================
# Audio Types
# ============================================================================

@dataclass
class AudioTranscription:
    """Audio transcription response."""
    text: str
    task: str = "transcribe"
    language: Optional[str] = None
    duration: Optional[float] = None
    words: Optional[List[Dict[str, Any]]] = None
    segments: Optional[List[Dict[str, Any]]] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AudioTranscription":
        return cls(
            text=data.get("text", ""),
            task=data.get("task", "transcribe"),
            language=data.get("language"),
            duration=data.get("duration"),
            words=data.get("words"),
            segments=data.get("segments"),
        )


@dataclass
class AudioSpeechResponse:
    """TTS response with audio bytes."""
    audio: bytes
    content_type: str = "audio/mpeg"


# ============================================================================
# Video Types
# ============================================================================

@dataclass
class VideoGenerateResponse:
    """Video generation response."""
    id: str
    status: str
    video_url: Optional[str] = None
    created: Optional[int] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VideoGenerateResponse":
        return cls(
            id=data.get("id", ""),
            status=data.get("status", ""),
            video_url=data.get("video_url"),
            created=data.get("created"),
        )


# ============================================================================
# Embedding Types
# ============================================================================

@dataclass
class Embedding:
    """A single embedding vector."""
    object: str
    index: int
    embedding: List[float]


@dataclass
class EmbeddingResponse:
    """Embeddings response."""
    object: str
    data: List[Embedding]
    model: str
    usage: Usage
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmbeddingResponse":
        return cls(
            object=data.get("object", "list"),
            data=[
                Embedding(
                    object=e.get("object", "embedding"),
                    index=e.get("index", 0),
                    embedding=e.get("embedding", []),
                )
                for e in data.get("data", [])
            ],
            model=data.get("model", ""),
            usage=Usage.from_dict(data.get("usage", {})),
        )


# ============================================================================
# Model & Character Types
# ============================================================================

@dataclass
class Model:
    """Venice AI model."""
    id: str
    object: str
    created: int
    owned_by: str
    
    # Venice-specific fields
    model_spec: Optional[Dict[str, Any]] = None
    traits: Optional[List[str]] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Model":
        return cls(
            id=data.get("id", ""),
            object=data.get("object", "model"),
            created=data.get("created", 0),
            owned_by=data.get("owned_by", ""),
            model_spec=data.get("model_spec"),
            traits=data.get("traits"),
        )


@dataclass
class Character:
    """Venice AI character."""
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    system_prompt: Optional[str] = None
    model_id: Optional[str] = None
    is_public: bool = False
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Character":
        return cls(
            id=data.get("id", ""),
            slug=data.get("slug", ""),
            name=data.get("name", ""),
            description=data.get("description"),
            avatar_url=data.get("avatar_url"),
            system_prompt=data.get("system_prompt"),
            model_id=data.get("model_id"),
            is_public=data.get("is_public", False),
        )


# ============================================================================
# Tool Types
# ============================================================================

@dataclass
class FunctionDefinition:
    """Function definition for tool calling."""
    name: str
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    strict: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"name": self.name}
        if self.description:
            result["description"] = self.description
        if self.parameters:
            result["parameters"] = self.parameters
        if self.strict:
            result["strict"] = True
        return result


@dataclass
class Tool:
    """A tool for function calling."""
    type: str = "function"
    function: Optional[FunctionDefinition] = None
    
    def to_dict(self) -> Dict[str, Any]:
        if self.type == "function" and self.function:
            return {
                "type": "function",
                "function": self.function.to_dict(),
            }
        return {"type": self.type}


@dataclass
class ToolCall:
    """A tool call from the model."""
    id: str
    type: str
    function: Dict[str, Any]
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ToolCall":
        return cls(
            id=data.get("id", ""),
            type=data.get("type", "function"),
            function=data.get("function", {}),
        )
