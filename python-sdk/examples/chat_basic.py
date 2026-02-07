"""
Basic Chat Example

Demonstrates simple chat completions with Venice AI.
"""

from venice import Venice

# Initialize client (uses VENICE_API_KEY env var)
client = Venice()

# Simple chat
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"},
    ],
)

print("Response:", response.content)
print(f"Tokens used: {response.usage.total_tokens}")


# Multi-turn conversation
messages = [
    {"role": "system", "content": "You are a knowledgeable science tutor."},
    {"role": "user", "content": "Explain photosynthesis in simple terms."},
]

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=messages,
)

print("\n--- Science Tutor ---")
print(response.content)

# Continue the conversation
messages.append({"role": "assistant", "content": response.content})
messages.append({"role": "user", "content": "Can you give me a real-world example?"})

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=messages,
)

print("\n--- Follow-up ---")
print(response.content)
