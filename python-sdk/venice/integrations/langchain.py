"""
Venice AI LangChain Integration

Drop-in LangChain-compatible ChatModel and Embeddings for Venice AI.

Usage:
    from venice.integrations import VeniceChatModel, VeniceEmbeddings
    from langchain_core.messages import HumanMessage
    
    # Chat model
    llm = VeniceChatModel(model="llama-3.3-70b")
    response = llm.invoke([HumanMessage(content="Hello!")])
    
    # With web search
    llm = VeniceChatModel(model="llama-3.3-70b", enable_web_search="on")
    
    # Embeddings for RAG
    embeddings = VeniceEmbeddings()
    vectors = embeddings.embed_documents(["Hello", "World"])
"""

from __future__ import annotations
import os
from typing import Any, Dict, Iterator, List, Optional, Sequence, Union

try:
    from langchain_core.callbacks import CallbackManagerForLLMRun
    from langchain_core.language_models import BaseChatModel
    from langchain_core.embeddings import Embeddings
    from langchain_core.messages import (
        AIMessage,
        AIMessageChunk,
        BaseMessage,
        HumanMessage,
        SystemMessage,
        ToolMessage,
    )
    from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
    from pydantic import Field, SecretStr
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    BaseChatModel = object  # type: ignore
    Embeddings = object  # type: ignore

from ..client import Venice
from ..types import VeniceParameters, WebSearchMode


def _check_langchain():
    if not LANGCHAIN_AVAILABLE:
        raise ImportError(
            "LangChain integration requires langchain-core. "
            "Install with: pip install langchain-core"
        )


def _convert_message_to_dict(message: BaseMessage) -> Dict[str, Any]:
    """Convert a LangChain message to Venice API format."""
    if isinstance(message, SystemMessage):
        return {"role": "system", "content": message.content}
    elif isinstance(message, HumanMessage):
        return {"role": "user", "content": message.content}
    elif isinstance(message, AIMessage):
        msg: Dict[str, Any] = {"role": "assistant", "content": message.content}
        if message.tool_calls:
            msg["tool_calls"] = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": tc["args"] if isinstance(tc["args"], str) else str(tc["args"]),
                    },
                }
                for tc in message.tool_calls
            ]
        return msg
    elif isinstance(message, ToolMessage):
        return {
            "role": "tool",
            "tool_call_id": message.tool_call_id,
            "content": message.content,
        }
    else:
        return {"role": "user", "content": str(message.content)}


def _convert_response_to_message(response: Dict[str, Any]) -> AIMessage:
    """Convert Venice API response to LangChain AIMessage."""
    content = response.get("content", "")
    tool_calls = response.get("tool_calls", [])
    
    lc_tool_calls = []
    if tool_calls:
        for tc in tool_calls:
            func = tc.get("function", {})
            lc_tool_calls.append({
                "id": tc.get("id", ""),
                "name": func.get("name", ""),
                "args": func.get("arguments", ""),
            })
    
    additional_kwargs = {}
    if response.get("reasoning_content"):
        additional_kwargs["reasoning_content"] = response["reasoning_content"]
    
    return AIMessage(
        content=content,
        tool_calls=lc_tool_calls if lc_tool_calls else [],
        additional_kwargs=additional_kwargs,
    )


if LANGCHAIN_AVAILABLE:
    class VeniceChatModel(BaseChatModel):
        """
        Venice AI Chat Model for LangChain.
        
        Drop-in replacement for ChatOpenAI with Venice-specific features:
        - Web search integration
        - Reasoning models with thinking
        - Vision/multimodal support
        - Characters
        
        Example:
            from venice.integrations import VeniceChatModel
            from langchain_core.messages import HumanMessage
            
            # Basic usage
            llm = VeniceChatModel(model="llama-3.3-70b")
            response = llm.invoke([HumanMessage(content="Hello!")])
            
            # With web search
            llm = VeniceChatModel(
                model="llama-3.3-70b",
                enable_web_search="on"
            )
            response = llm.invoke([HumanMessage(content="What's the latest AI news?")])
            
            # Reasoning model
            llm = VeniceChatModel(
                model="deepseek-ai-DeepSeek-R1",
                reasoning_effort="high"
            )
            
            # In a chain
            from langchain_core.prompts import ChatPromptTemplate
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a helpful assistant."),
                ("user", "{input}")
            ])
            chain = prompt | llm
            response = chain.invoke({"input": "Explain quantum computing"})
        """
        
        # Model configuration
        model: str = Field(default="llama-3.3-70b", description="Venice model ID")
        api_key: Optional[SecretStr] = Field(default=None, description="Venice API key")
        base_url: Optional[str] = Field(default=None, description="Venice API base URL")
        
        # Generation parameters
        temperature: float = Field(default=0.7, ge=0, le=2)
        max_tokens: Optional[int] = Field(default=None)
        top_p: Optional[float] = Field(default=None, ge=0, le=1)
        frequency_penalty: Optional[float] = Field(default=None, ge=-2, le=2)
        presence_penalty: Optional[float] = Field(default=None, ge=-2, le=2)
        
        # Venice-specific
        enable_web_search: Optional[str] = Field(default=None, description="off/on/auto")
        enable_web_citations: bool = Field(default=False)
        character_slug: Optional[str] = Field(default=None)
        reasoning_effort: Optional[str] = Field(default=None, description="low/medium/high")
        include_venice_system_prompt: bool = Field(default=True)
        
        # Streaming
        streaming: bool = Field(default=False)
        
        # Internal
        _client: Optional[Venice] = None
        
        class Config:
            arbitrary_types_allowed = True
        
        @property
        def _llm_type(self) -> str:
            return "venice-chat"
        
        @property
        def _identifying_params(self) -> Dict[str, Any]:
            return {
                "model": self.model,
                "temperature": self.temperature,
                "enable_web_search": self.enable_web_search,
            }
        
        def _get_client(self) -> Venice:
            if self._client is None:
                api_key = (
                    self.api_key.get_secret_value() if self.api_key 
                    else os.environ.get("VENICE_API_KEY")
                )
                self._client = Venice(
                    api_key=api_key,
                    base_url=self.base_url,
                )
            return self._client
        
        def _get_venice_params(self) -> Dict[str, Any]:
            params = {}
            if self.enable_web_search:
                params["enable_web_search"] = self.enable_web_search
            if self.enable_web_citations:
                params["enable_web_citations"] = True
            if self.character_slug:
                params["character_slug"] = self.character_slug
            if not self.include_venice_system_prompt:
                params["include_venice_system_prompt"] = False
            return params
        
        def _generate(
            self,
            messages: List[BaseMessage],
            stop: Optional[List[str]] = None,
            run_manager: Optional[CallbackManagerForLLMRun] = None,
            **kwargs: Any,
        ) -> ChatResult:
            """Generate a chat completion."""
            client = self._get_client()
            
            request_kwargs: Dict[str, Any] = {
                "model": self.model,
                "messages": [_convert_message_to_dict(m) for m in messages],
                "temperature": self.temperature,
            }
            
            if self.max_tokens:
                request_kwargs["max_tokens"] = self.max_tokens
            if self.top_p is not None:
                request_kwargs["top_p"] = self.top_p
            if self.frequency_penalty is not None:
                request_kwargs["frequency_penalty"] = self.frequency_penalty
            if self.presence_penalty is not None:
                request_kwargs["presence_penalty"] = self.presence_penalty
            if self.reasoning_effort:
                request_kwargs["reasoning_effort"] = self.reasoning_effort
            if stop:
                request_kwargs["stop"] = stop
            
            venice_params = self._get_venice_params()
            if venice_params:
                request_kwargs["venice_parameters"] = venice_params
            
            # Merge any extra kwargs
            request_kwargs.update(kwargs)
            
            response = client.chat.completions.create(**request_kwargs)
            
            message = _convert_response_to_message(
                response.choices[0].message.to_dict() if hasattr(response.choices[0].message, 'to_dict')
                else {
                    "content": response.choices[0].message.content,
                    "role": response.choices[0].message.role,
                    "tool_calls": response.choices[0].message.tool_calls,
                    "reasoning_content": response.choices[0].message.reasoning_content,
                }
            )
            
            generation = ChatGeneration(
                message=message,
                generation_info={
                    "finish_reason": response.choices[0].finish_reason,
                    "model": response.model,
                },
            )
            
            return ChatResult(
                generations=[generation],
                llm_output={
                    "token_usage": {
                        "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                        "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                        "total_tokens": response.usage.total_tokens if response.usage else 0,
                    },
                    "model": response.model,
                },
            )
        
        def _stream(
            self,
            messages: List[BaseMessage],
            stop: Optional[List[str]] = None,
            run_manager: Optional[CallbackManagerForLLMRun] = None,
            **kwargs: Any,
        ) -> Iterator[ChatGenerationChunk]:
            """Stream a chat completion."""
            client = self._get_client()
            
            request_kwargs: Dict[str, Any] = {
                "model": self.model,
                "messages": [_convert_message_to_dict(m) for m in messages],
                "temperature": self.temperature,
                "stream": True,
            }
            
            if self.max_tokens:
                request_kwargs["max_tokens"] = self.max_tokens
            if stop:
                request_kwargs["stop"] = stop
            
            venice_params = self._get_venice_params()
            if venice_params:
                request_kwargs["venice_parameters"] = venice_params
            
            request_kwargs.update(kwargs)
            
            for chunk in client.chat.completions.create(**request_kwargs):
                if chunk.choices and chunk.choices[0].delta:
                    delta = chunk.choices[0].delta
                    content = delta.get("content", "")
                    
                    yield ChatGenerationChunk(
                        message=AIMessageChunk(content=content),
                        generation_info={
                            "finish_reason": chunk.choices[0].finish_reason,
                        },
                    )
                    
                    if run_manager and content:
                        run_manager.on_llm_new_token(content)
        
        def bind_tools(self, tools: Sequence[Any], **kwargs: Any) -> "VeniceChatModel":
            """Bind tools to the model for function calling."""
            # Convert tools to Venice format
            formatted_tools = []
            for tool in tools:
                if hasattr(tool, "to_langchain_tool"):
                    tool = tool.to_langchain_tool()
                
                if hasattr(tool, "name") and hasattr(tool, "description"):
                    formatted_tools.append({
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": getattr(tool, "args_schema", {}).schema() if hasattr(tool, "args_schema") else {},
                        },
                    })
                elif isinstance(tool, dict):
                    formatted_tools.append(tool)
            
            # Create new instance with tools bound
            return self.model_copy(update={"tools": formatted_tools, **kwargs})


    class VeniceEmbeddings(Embeddings):
        """
        Venice AI Embeddings for LangChain.
        
        Use for RAG pipelines, semantic search, and document similarity.
        
        Example:
            from venice.integrations import VeniceEmbeddings
            from langchain_community.vectorstores import FAISS
            
            # Create embeddings
            embeddings = VeniceEmbeddings()
            
            # Embed documents
            vectors = embeddings.embed_documents([
                "The sky is blue",
                "The grass is green"
            ])
            
            # Use with vector store
            vectorstore = FAISS.from_texts(
                texts=["Document 1", "Document 2"],
                embedding=embeddings
            )
            
            # Query
            results = vectorstore.similarity_search("Find similar documents")
        """
        
        model: str = "text-embedding-ada-002"
        api_key: Optional[str] = None
        base_url: Optional[str] = None
        dimensions: Optional[int] = None
        
        _client: Optional[Venice] = None
        
        def __init__(self, **kwargs):
            _check_langchain()
            super().__init__(**kwargs)
        
        def _get_client(self) -> Venice:
            if self._client is None:
                self._client = Venice(
                    api_key=self.api_key or os.environ.get("VENICE_API_KEY"),
                    base_url=self.base_url,
                )
            return self._client
        
        def embed_documents(self, texts: List[str]) -> List[List[float]]:
            """Embed a list of documents."""
            client = self._get_client()
            
            kwargs: Dict[str, Any] = {
                "input": texts,
                "model": self.model,
            }
            if self.dimensions:
                kwargs["dimensions"] = self.dimensions
            
            response = client.embeddings.create(**kwargs)
            
            # Sort by index to ensure correct order
            sorted_data = sorted(response.data, key=lambda x: x.index)
            return [item.embedding for item in sorted_data]
        
        def embed_query(self, text: str) -> List[float]:
            """Embed a query string."""
            return self.embed_documents([text])[0]

else:
    # Stub classes when LangChain is not available
    class VeniceChatModel:
        def __init__(self, *args, **kwargs):
            raise ImportError(
                "LangChain integration requires langchain-core. "
                "Install with: pip install langchain-core"
            )
    
    class VeniceEmbeddings:
        def __init__(self, *args, **kwargs):
            raise ImportError(
                "LangChain integration requires langchain-core. "
                "Install with: pip install langchain-core"
            )
