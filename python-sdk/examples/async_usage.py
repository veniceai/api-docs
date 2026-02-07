"""
Async Usage Example

Demonstrates async client for concurrent requests.
"""

import asyncio

from venice import AsyncVenice


async def main():
    # Use async context manager
    async with AsyncVenice() as client:
        
        # Single async request
        print("Single async request:")
        print("-" * 40)
        
        response = await client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[
                {"role": "user", "content": "What is 2 + 2?"},
            ],
        )
        print(response.content)
        
        
        # Concurrent requests
        print("\n\nConcurrent requests:")
        print("-" * 40)
        
        questions = [
            "What is the capital of France?",
            "What is the capital of Germany?",
            "What is the capital of Italy?",
            "What is the capital of Spain?",
        ]
        
        # Create tasks for concurrent execution
        tasks = [
            client.chat.completions.create(
                model="llama-3.3-70b",
                messages=[{"role": "user", "content": q}],
                max_tokens=50,
            )
            for q in questions
        ]
        
        # Execute all concurrently
        responses = await asyncio.gather(*tasks)
        
        for q, r in zip(questions, responses):
            print(f"Q: {q}")
            print(f"A: {r.content[:100]}...")
            print()
        
        
        # Async streaming
        print("\n\nAsync streaming:")
        print("-" * 40)
        
        stream = await client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[
                {"role": "user", "content": "Count from 1 to 5."},
            ],
            stream=True,
        )
        
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta:
                content = chunk.choices[0].delta.get("content", "")
                if content:
                    print(content, end="", flush=True)
        
        print()


if __name__ == "__main__":
    asyncio.run(main())
