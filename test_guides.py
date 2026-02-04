"""
Test script for Venice API framework integration guides.
Tests: OpenAI migration, LangChain, CrewAI examples.
"""

import os
import sys

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

API_KEY = "VENICE-INFERENCE-KEY-xyVIqxkUz9TN4whC-zxGbCiuyEZO9RWZlaCu-9Tn2J"
BASE_URL = "https://api.venice.ai/api/v1"

def test_openai_migration():
    """Test OpenAI migration guide examples"""
    print("\n" + "="*60)
    print("TESTING: OpenAI Migration Guide")
    print("="*60)
    
    from openai import OpenAI
    client = OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL
    )
    
    # Basic chat completion
    print("\n1. Basic chat completion...")
    response = client.chat.completions.create(
        model="venice-uncensored",
        messages=[{"role": "user", "content": "Say 'Hello Venice!' in exactly 3 words."}],
        max_tokens=20
    )
    print(f"   ✓ Response: {response.choices[0].message.content}")
    
    # Streaming
    print("\n2. Streaming...")
    stream = client.chat.completions.create(
        model="venice-uncensored",
        messages=[{"role": "user", "content": "Count from 1 to 3."}],
        stream=True,
        max_tokens=30
    )
    print("   [OK] Stream: ", end="")
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)
    print()
    
    # Web search (Venice-only feature)
    print("\n3. Web search (Venice-only)...")
    response = client.chat.completions.create(
        model="venice-uncensored",
        messages=[{"role": "user", "content": "What is Venice AI?"}],
        extra_body={
            "venice_parameters": {
                "enable_web_search": "auto"
            }
        },
        max_tokens=100
    )
    print(f"   ✓ Web search response received ({len(response.choices[0].message.content)} chars)")
    
    print("\n✅ OpenAI Migration: ALL TESTS PASSED")


def test_langchain():
    """Test LangChain guide examples"""
    print("\n" + "="*60)
    print("TESTING: LangChain Guide")
    print("="*60)
    
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    
    # Chat model
    print("\n1. ChatOpenAI basic...")
    llm = ChatOpenAI(
        model="venice-uncensored",
        api_key=API_KEY,
        base_url=BASE_URL,
        temperature=0.7,
        max_tokens=50
    )
    response = llm.invoke("Explain privacy in 1 sentence.")
    print(f"   ✓ Response: {response.content[:100]}...")
    
    # Streaming
    print("\n2. Streaming...")
    print("   ✓ Stream: ", end="")
    for chunk in llm.stream("Say 'LangChain works!'"):
        print(chunk.content, end="", flush=True)
    print()
    
    # Embeddings
    print("\n3. Embeddings...")
    embeddings = OpenAIEmbeddings(
        model="text-embedding-bge-m3",
        api_key=API_KEY,
        base_url=BASE_URL,
        check_embedding_ctx_length=False,  # Required for Venice
    )
    vectors = embeddings.embed_documents(["Venice AI provides private inference."])
    print(f"   ✓ Embedding dimension: {len(vectors[0])}")
    
    # Simple chain
    print("\n4. Chain with prompt template...")
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a {role}. Answer in one sentence."),
        ("user", "{question}"),
    ])
    chain = prompt | llm | StrOutputParser()
    response = chain.invoke({"role": "privacy expert", "question": "Why is zero retention good?"})
    print(f"   ✓ Chain response: {response[:100]}...")
    
    # Web search
    print("\n5. Web search integration...")
    llm_with_search = ChatOpenAI(
        model="venice-uncensored",
        api_key=API_KEY,
        base_url=BASE_URL,
        max_tokens=100,
        extra_body={
            "venice_parameters": {
                "enable_web_search": "auto"
            }
        }
    )
    response = llm_with_search.invoke("What is Venice AI's main feature?")
    print(f"   [OK] Web search response received ({len(response.content)} chars)")
    
    print("\n✅ LangChain: ALL TESTS PASSED")


def test_crewai():
    """Test CrewAI guide examples"""
    print("\n" + "="*60)
    print("TESTING: CrewAI Guide")
    print("="*60)
    
    from crewai import Agent, Task, Crew, LLM
    
    # Configure Venice LLM
    print("\n1. LLM configuration...")
    venice_llm = LLM(
        model="openai/venice-uncensored",
        api_key=API_KEY,
        base_url=BASE_URL,
        temperature=0.7,
    )
    print("   ✓ LLM configured")
    
    # Create agent
    print("\n2. Creating agent...")
    researcher = Agent(
        role="Research Analyst",
        goal="Provide brief, accurate information",
        backstory="You are a concise research expert.",
        llm=venice_llm,
        verbose=False,
        max_iter=2,
    )
    print("   ✓ Agent created")
    
    # Create task
    print("\n3. Creating task...")
    task = Task(
        description="In one sentence, explain what Venice AI is.",
        expected_output="A single sentence explanation.",
        agent=researcher,
    )
    print("   ✓ Task created")
    
    # Run crew (simplified single-agent crew)
    print("\n4. Running crew (this may take a moment)...")
    crew = Crew(
        agents=[researcher],
        tasks=[task],
        verbose=False,
    )
    result = crew.kickoff()
    print(f"   ✓ Crew result: {str(result)[:150]}...")
    
    print("\n✅ CrewAI: ALL TESTS PASSED")


def test_models_exist():
    """Test that all referenced models exist and respond"""
    print("\n" + "="*60)
    print("TESTING: Model Availability")
    print("="*60)
    
    from openai import OpenAI
    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
    
    models_to_test = [
        ("venice-uncensored", "text"),
        ("qwen3-4b", "text"),
        ("text-embedding-bge-m3", "embedding"),
    ]
    
    for model_id, model_type in models_to_test:
        print(f"\n   Testing {model_id}...", end=" ")
        try:
            if model_type == "text":
                response = client.chat.completions.create(
                    model=model_id,
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=5
                )
                print(f"✓ Works")
            elif model_type == "embedding":
                response = client.embeddings.create(
                    model=model_id,
                    input="test"
                )
                print(f"✓ Works (dim={len(response.data[0].embedding)})")
        except Exception as e:
            print(f"✗ Error: {e}")
    
    # Test models that may have different names
    print("\n   Testing zai-org-glm-4.7 (flagship)...", end=" ")
    try:
        response = client.chat.completions.create(
            model="zai-org-glm-4.7",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5
        )
        print(f"✓ Works")
    except Exception as e:
        print(f"✗ Error: {str(e)[:50]}")
    
    print("\n   Testing mistral-31-24b (vision)...", end=" ")
    try:
        response = client.chat.completions.create(
            model="mistral-31-24b",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5
        )
        print(f"✓ Works")
    except Exception as e:
        print(f"✗ Error: {str(e)[:50]}")


if __name__ == "__main__":
    print("="*60)
    print("VENICE API FRAMEWORK INTEGRATION GUIDE TESTS")
    print("="*60)
    
    try:
        test_openai_migration()
    except Exception as e:
        print(f"\n❌ OpenAI Migration FAILED: {e}")
    
    try:
        test_langchain()
    except Exception as e:
        print(f"\n❌ LangChain FAILED: {e}")
    
    try:
        test_models_exist()
    except Exception as e:
        print(f"\n❌ Model tests FAILED: {e}")
    
    try:
        test_crewai()
    except Exception as e:
        print(f"\n❌ CrewAI FAILED: {e}")
    
    print("\n" + "="*60)
    print("ALL TESTS COMPLETE")
    print("="*60)

