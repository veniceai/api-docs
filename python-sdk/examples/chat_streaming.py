"""
Streaming Chat Example

Demonstrates streaming responses for real-time output.
"""

from venice import Venice

client = Venice()

print("Streaming response:")
print("-" * 40)

# Stream a response
for chunk in client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[
        {"role": "user", "content": "Write a short poem about the ocean."},
    ],
    stream=True,
):
    # Each chunk contains partial content
    if chunk.choices and chunk.choices[0].delta:
        content = chunk.choices[0].delta.get("content", "")
        if content:
            print(content, end="", flush=True)

print("\n" + "-" * 40)
print("Stream complete!")


# Streaming with reasoning model
print("\n\nStreaming with reasoning model:")
print("-" * 40)

for chunk in client.chat.completions.create(
    model="deepseek-ai-DeepSeek-R1",
    messages=[
        {"role": "user", "content": "What is 15% of 240?"},
    ],
    stream=True,
    # Strip the <think> tags for cleaner output
    venice_parameters={"strip_thinking_response": True},
):
    if chunk.choices and chunk.choices[0].delta:
        content = chunk.choices[0].delta.get("content", "")
        if content:
            print(content, end="", flush=True)

print("\n" + "-" * 40)
