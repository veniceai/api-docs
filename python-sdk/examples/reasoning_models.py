"""
Reasoning Models Example

Demonstrates Venice's reasoning models with visible thinking process.
"""

from venice import Venice

client = Venice()

# DeepSeek R1 with full reasoning output
print("Reasoning Model (with thinking):")
print("-" * 40)

response = client.chat.completions.create(
    model="deepseek-ai-DeepSeek-R1",
    messages=[
        {"role": "user", "content": "Solve: A train leaves station A at 9am traveling at 60mph. Another train leaves station B at 10am traveling toward A at 80mph. Stations are 280 miles apart. When do they meet?"},
    ],
    # Keep thinking visible to see the reasoning process
)

print(response.content)


# Same problem but strip thinking for clean output
print("\n\nSame problem (thinking stripped):")
print("-" * 40)

response = client.chat.completions.create(
    model="deepseek-ai-DeepSeek-R1",
    messages=[
        {"role": "user", "content": "Solve: A train leaves station A at 9am traveling at 60mph. Another train leaves station B at 10am traveling toward A at 80mph. Stations are 280 miles apart. When do they meet?"},
    ],
    venice_parameters={
        "strip_thinking_response": True,  # Only show final answer
    },
)

print(response.content)


# Reasoning effort levels (for supported models)
print("\n\nDifferent reasoning efforts:")
print("-" * 40)

for effort in ["low", "medium", "high"]:
    response = client.chat.completions.create(
        model="qwen3-4b",  # Supports reasoning effort
        messages=[
            {"role": "user", "content": "What is 127 * 389?"},
        ],
        reasoning_effort=effort,
        venice_parameters={"strip_thinking_response": True},
    )
    print(f"{effort.upper()}: {response.content}")
