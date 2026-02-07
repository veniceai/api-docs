"""
Tool/Function Calling Example

Demonstrates Venice's function calling capabilities for building agents.
"""

import json

from venice import Venice
from venice.types import Tool, FunctionDefinition

client = Venice()

# Define tools
tools = [
    Tool(
        type="function",
        function=FunctionDefinition(
            name="get_weather",
            description="Get the current weather for a location",
            parameters={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City and state, e.g., 'San Francisco, CA'",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit",
                    },
                },
                "required": ["location"],
            },
        ),
    ),
    Tool(
        type="function",
        function=FunctionDefinition(
            name="search_web",
            description="Search the web for information",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query",
                    },
                },
                "required": ["query"],
            },
        ),
    ),
]

# Make a request that triggers tool use
response = client.chat.completions.create(
    model="zai-org-glm-4.7",  # Function calling model
    messages=[
        {"role": "user", "content": "What's the weather in Tokyo and New York?"},
    ],
    tools=[t.to_dict() for t in tools],
    tool_choice="auto",
)

print("Model Response:")
print("-" * 40)

if response.choices[0].message.tool_calls:
    print("Tool calls requested:")
    for tc in response.choices[0].message.tool_calls:
        print(f"  - {tc['function']['name']}: {tc['function']['arguments']}")
    
    # Simulate tool execution
    def execute_tool(name: str, args: dict) -> str:
        if name == "get_weather":
            location = args.get("location", "Unknown")
            unit = args.get("unit", "celsius")
            # Simulated response
            return json.dumps({
                "location": location,
                "temperature": 22 if unit == "celsius" else 72,
                "unit": unit,
                "condition": "Sunny",
            })
        elif name == "search_web":
            return json.dumps({"results": ["Result 1", "Result 2"]})
        return "{}"
    
    # Build messages with tool results
    messages = [
        {"role": "user", "content": "What's the weather in Tokyo and New York?"},
        {
            "role": "assistant",
            "content": response.content,
            "tool_calls": response.choices[0].message.tool_calls,
        },
    ]
    
    # Add tool results
    for tc in response.choices[0].message.tool_calls:
        args = json.loads(tc["function"]["arguments"])
        result = execute_tool(tc["function"]["name"], args)
        messages.append({
            "role": "tool",
            "tool_call_id": tc["id"],
            "content": result,
        })
    
    # Get final response
    final_response = client.chat.completions.create(
        model="zai-org-glm-4.7",
        messages=messages,
        tools=[t.to_dict() for t in tools],
    )
    
    print("\nFinal Response:")
    print("-" * 40)
    print(final_response.content)
else:
    print(response.content)
