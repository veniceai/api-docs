"""
Text-to-Speech Example

Demonstrates Venice's TTS capabilities with Kokoro.
"""

from pathlib import Path

from venice import Venice
from venice.types import TTSVoice

client = Venice()

# Generate speech
print("Generating speech...")
print("-" * 40)

result = client.audio.speech.create(
    input="Hello! Welcome to Venice AI. I'm here to help you with any questions you might have.",
    model="kokoro",
    voice="af_bella",  # Female American voice
    response_format="mp3",
    speed=1.0,
)

# Save to file
output_path = Path("output_speech.mp3")
with open(output_path, "wb") as f:
    f.write(result.audio)

print(f"Saved to: {output_path}")
print(f"Audio size: {len(result.audio)} bytes")
print(f"Content-Type: {result.content_type}")


# Try different voices
print("\n\nAvailable voices:")
print("-" * 40)

voices = [
    ("af_bella", "American Female - Bella"),
    ("af_nicole", "American Female - Nicole"),
    ("af_sarah", "American Female - Sarah"),
    ("af_sky", "American Female - Sky"),
    ("am_adam", "American Male - Adam"),
    ("am_michael", "American Male - Michael"),
    ("bf_emma", "British Female - Emma"),
    ("bf_isabella", "British Female - Isabella"),
    ("bm_george", "British Male - George"),
    ("bm_lewis", "British Male - Lewis"),
]

for voice_id, description in voices:
    print(f"  {voice_id}: {description}")


# Generate with different speeds
print("\n\nGenerating at different speeds:")
print("-" * 40)

text = "The quick brown fox jumps over the lazy dog."

for speed in [0.75, 1.0, 1.25, 1.5]:
    result = client.audio.speech.create(
        input=text,
        model="kokoro",
        voice="am_michael",
        speed=speed,
    )
    
    filename = f"speech_speed_{speed}.mp3"
    with open(filename, "wb") as f:
        f.write(result.audio)
    
    print(f"Speed {speed}x: {filename} ({len(result.audio)} bytes)")


# Long-form content
print("\n\nLong-form TTS:")
print("-" * 40)

long_text = """
Venice AI is a privacy-focused artificial intelligence platform. 
Unlike other AI services, Venice does not retain your data or conversations.
This makes it ideal for sensitive use cases where privacy is paramount.

Venice offers a wide range of capabilities including text generation, 
image creation, audio transcription, and text-to-speech conversion.
All of these features are available through a simple API that's 
compatible with the OpenAI specification.
"""

result = client.audio.speech.create(
    input=long_text,
    model="kokoro",
    voice="bf_emma",  # British voice
)

with open("long_speech.mp3", "wb") as f:
    f.write(result.audio)

print(f"Generated long-form audio: {len(result.audio)} bytes")
