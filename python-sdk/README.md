# Venice AI Python SDK

**A comprehensive Python SDK for Venice AI with full API coverage, async support, streaming, and LangChain integration.**

[![PyPI version](https://badge.fury.io/py/venice-ai.svg)](https://badge.fury.io/py/venice-ai)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 What This Does

This SDK provides a Pythonic interface to the entire Venice AI API, enabling developers to:

- **Chat Completions** - Text generation with streaming, web search, reasoning models, and vision
- **Image Generation** - Create, edit, and upscale images
- **Text-to-Speech** - Generate audio with Kokoro voices
- **Audio Transcription** - Transcribe audio with Whisper
- **Embeddings** - Generate embeddings for RAG and semantic search
- **Video Generation** - Create videos with Kling and other models
- **LangChain Integration** - Drop-in ChatModel and Embeddings for agent frameworks

## 🚀 Quick Start

### Installation

```bash
# Basic installation
pip install venice-ai

# With LangChain integration
pip install venice-ai[langchain]

# All features
pip install venice-ai[all]
```

### Basic Usage

```python
from venice import Venice

# Initialize (uses VENICE_API_KEY env var)
client = Venice()

# Or pass explicitly
client = Venice(api_key="your-api-key")

# Chat completion
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"},
    ],
)

print(response.content)
```

### Streaming

```python
for chunk in client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True,
):
    if chunk.choices[0].delta.get("content"):
        print(chunk.choices[0].delta["content"], end="")
```

### Web Search

```python
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "What's the latest AI news?"}],
    enable_web_search="on",  # or "auto"
)
```

### Vision/Multimodal

```python
response = client.chat.completions.create(
    model="qwen3-vl-235b-a22b",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe this image"},
            {"type": "image_url", "image_url": {"url": "https://..."}},
        ],
    }],
)
```

### Reasoning Models

```python
response = client.chat.completions.create(
    model="deepseek-ai-DeepSeek-R1",
    messages=[{"role": "user", "content": "Solve this math problem..."}],
    venice_parameters={
        "strip_thinking_response": True,  # Hide <think> tags
    },
)
```

## 📚 Full API Coverage

### Chat Completions

```python
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[...],
    
    # Standard parameters
    temperature=0.7,
    max_tokens=1000,
    top_p=0.9,
    frequency_penalty=0.0,
    presence_penalty=0.0,
    stop=["END"],
    seed=42,
    
    # Streaming
    stream=True,
    
    # Venice-specific
    venice_parameters={
        "enable_web_search": "on",       # off, on, auto
        "enable_web_citations": True,
        "enable_web_scraping": True,     # Scrape URLs in message
        "character_slug": "my-character",
        "strip_thinking_response": True,
        "disable_thinking": False,
        "include_venice_system_prompt": True,
    },
    
    # Reasoning
    reasoning_effort="high",  # low, medium, high
    
    # Tool calling
    tools=[...],
    tool_choice="auto",
    
    # Response format
    response_format={"type": "json_object"},
)
```

### Image Generation

```python
# Generate
result = client.images.generate(
    prompt="A sunset over mountains",
    model="fluently-xl",
    n=1,
    size="1024x1024",
    negative_prompt="blurry, low quality",
    cfg_scale=7.5,
    steps=30,
    seed=42,
)
print(result.data[0].url)

# Edit
result = client.images.edit(
    image="base64_or_url",
    prompt="Add a rainbow",
    mask="optional_mask",
)

# Upscale
result = client.images.upscale(
    image="base64_or_url",
    scale=4,
)
```

### Text-to-Speech

```python
result = client.audio.speech.create(
    input="Hello, world!",
    model="kokoro",
    voice="af_bella",  # See TTSVoice enum
    response_format="mp3",
    speed=1.0,
)

# Save to file
with open("speech.mp3", "wb") as f:
    f.write(result.audio)
```

### Audio Transcription

```python
with open("audio.mp3", "rb") as f:
    audio_data = f.read()

result = client.audio.transcriptions.create(
    file=audio_data,
    model="whisper-large-v3-turbo",
    language="en",
)
print(result.text)
```

### Embeddings

```python
result = client.embeddings.create(
    input=["Hello", "World"],
    model="text-embedding-ada-002",
)

for emb in result.data:
    print(f"Vector {emb.index}: {len(emb.embedding)} dimensions")
```

### Video Generation

```python
# Text-to-video
result = client.video.generate(
    prompt="A cat playing piano",
    model="kling-1.5-pro",
    duration=5,
    aspect_ratio="16:9",
)

# Check status
status = client.video.status(result.id)
if status.video_url:
    print(f"Video ready: {status.video_url}")
```

### Models & Characters

```python
# List models
models = client.models.list()
for m in models:
    print(f"{m.id} - {m.owned_by}")

# List characters
characters = client.characters.list()
for c in characters:
    print(f"{c.slug}: {c.name}")
```

## 🔌 LangChain Integration

### Chat Model

```python
from venice.integrations import VeniceChatModel
from langchain_core.messages import HumanMessage, SystemMessage

llm = VeniceChatModel(
    model="llama-3.3-70b",
    temperature=0.7,
    enable_web_search="on",  # Venice-specific
)

response = llm.invoke([
    SystemMessage(content="You are a helpful assistant."),
    HumanMessage(content="What's the weather like?"),
])
```

### With Chains

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert in {topic}"),
    ("user", "{question}"),
])

chain = prompt | llm | StrOutputParser()

result = chain.invoke({
    "topic": "physics",
    "question": "Explain gravity",
})
```

### Embeddings for RAG

```python
from venice.integrations import VeniceEmbeddings
from langchain_community.vectorstores import FAISS

embeddings = VeniceEmbeddings()

# Create vector store
vectorstore = FAISS.from_texts(
    texts=["Document 1...", "Document 2..."],
    embedding=embeddings,
)

# Search
results = vectorstore.similarity_search("query")
```

## ⚡ Async Support

```python
import asyncio
from venice import AsyncVenice

async def main():
    async with AsyncVenice() as client:
        # Single request
        response = await client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[{"role": "user", "content": "Hello!"}],
        )
        
        # Concurrent requests
        tasks = [
            client.chat.completions.create(model="llama-3.3-70b", messages=[...])
            for _ in range(5)
        ]
        responses = await asyncio.gather(*tasks)
        
        # Async streaming
        stream = await client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[...],
            stream=True,
        )
        async for chunk in stream:
            print(chunk.choices[0].delta.get("content", ""), end="")

asyncio.run(main())
```

## 🛡️ Error Handling

```python
from venice import Venice
from venice.exceptions import (
    VeniceError,
    VeniceAPIError,
    VeniceAuthenticationError,
    VeniceRateLimitError,
    VeniceTimeoutError,
)

client = Venice()

try:
    response = client.chat.completions.create(...)
except VeniceAuthenticationError:
    print("Invalid API key")
except VeniceRateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except VeniceTimeoutError:
    print("Request timed out")
except VeniceAPIError as e:
    print(f"API error: {e.message} (status={e.status_code})")
```

## 🎛️ Configuration

```python
# Environment variables
# VENICE_API_KEY - Your API key
# VENICE_BASE_URL - Custom base URL (optional)

# Or pass directly
client = Venice(
    api_key="your-key",
    base_url="https://api.venice.ai/api/v1",
    timeout=120.0,
    max_retries=2,
)
```

## 📁 Repository Structure

```
venice-python-sdk/
├── venice/
│   ├── __init__.py          # Package exports
│   ├── client.py             # Venice & AsyncVenice clients
│   ├── types.py              # Type definitions
│   ├── exceptions.py         # Custom exceptions
│   └── integrations/
│       ├── __init__.py
│       └── langchain.py      # LangChain ChatModel & Embeddings
├── examples/
│   ├── chat_basic.py
│   ├── chat_streaming.py
│   ├── web_search.py
│   ├── reasoning_models.py
│   ├── vision.py
│   ├── tool_calling.py
│   ├── image_generation.py
│   ├── audio_tts.py
│   ├── langchain_basic.py
│   └── async_usage.py
├── pyproject.toml
└── README.md
```

## 🎯 Target Repo/Files

**Repository:** `veniceai/venice-python` (new repo)

**Also update:**
- `veniceai/api-docs` - Add SDK installation & quickstart guide
- Addresses GitHub Issue #60 (Agent frameworks)

## 💡 Why Users Will Love It

1. **OpenAI-Compatible** - Works with existing code, just change the import
2. **Full Type Hints** - Autocomplete and type checking in your IDE
3. **Venice Features First** - Web search, reasoning, vision built-in
4. **LangChain Ready** - Drop-in integration for agent frameworks
5. **Async Native** - Proper async/await for concurrent workloads
6. **Comprehensive Examples** - Copy-paste examples for every feature

## 📊 Diff Summary

This is a **new package** with no existing code to diff against.

**Files created:**
- `venice/__init__.py` - Package exports
- `venice/client.py` - Main sync/async clients (~600 lines)
- `venice/types.py` - Type definitions (~400 lines)
- `venice/exceptions.py` - Custom exceptions (~100 lines)
- `venice/integrations/__init__.py` - Integration exports
- `venice/integrations/langchain.py` - LangChain integration (~500 lines)
- `pyproject.toml` - Package configuration
- 10 example files demonstrating all features

**Total:** ~2,500 lines of production-ready Python code

---

*Built as part of Venice Nightworks - Feb 7, 2026*
