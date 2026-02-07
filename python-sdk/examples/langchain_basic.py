"""
LangChain Integration Example

Demonstrates using Venice with LangChain for building AI applications.

Requires: pip install venice-ai[langchain]
"""

from venice.integrations import VeniceChatModel, VeniceEmbeddings

# ============================================================================
# Basic Chat
# ============================================================================

print("Basic LangChain Chat:")
print("-" * 40)

try:
    from langchain_core.messages import HumanMessage, SystemMessage
    
    # Create Venice chat model
    llm = VeniceChatModel(
        model="llama-3.3-70b",
        temperature=0.7,
    )
    
    # Simple invocation
    response = llm.invoke([
        SystemMessage(content="You are a helpful assistant."),
        HumanMessage(content="What is the capital of Japan?"),
    ])
    
    print(response.content)

except ImportError as e:
    print(f"LangChain not installed: {e}")
    print("Install with: pip install langchain-core")


# ============================================================================
# With Web Search
# ============================================================================

print("\n\nWith Web Search:")
print("-" * 40)

try:
    from langchain_core.messages import HumanMessage
    
    # Venice model with web search enabled
    llm = VeniceChatModel(
        model="llama-3.3-70b",
        enable_web_search="on",
        enable_web_citations=True,
    )
    
    response = llm.invoke([
        HumanMessage(content="What are the top tech stories today?"),
    ])
    
    print(response.content)

except ImportError:
    print("LangChain not installed")


# ============================================================================
# Chain with Prompt Template
# ============================================================================

print("\n\nWith Prompt Template:")
print("-" * 40)

try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    
    llm = VeniceChatModel(model="llama-3.3-70b")
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert in {topic}. Provide clear, concise explanations."),
        ("user", "{question}"),
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    result = chain.invoke({
        "topic": "astronomy",
        "question": "Why do stars twinkle?",
    })
    
    print(result)

except ImportError:
    print("LangChain not installed")


# ============================================================================
# Embeddings for RAG
# ============================================================================

print("\n\nEmbeddings:")
print("-" * 40)

try:
    embeddings = VeniceEmbeddings()
    
    # Embed documents
    docs = [
        "The quick brown fox jumps over the lazy dog.",
        "Machine learning is a subset of artificial intelligence.",
        "Venice AI provides private, uncensored AI inference.",
    ]
    
    vectors = embeddings.embed_documents(docs)
    
    print(f"Embedded {len(docs)} documents")
    print(f"Vector dimensions: {len(vectors[0])}")
    
    # Embed query
    query_vector = embeddings.embed_query("What is AI?")
    print(f"Query vector dimensions: {len(query_vector)}")

except ImportError:
    print("LangChain not installed")


# ============================================================================
# Streaming
# ============================================================================

print("\n\nStreaming:")
print("-" * 40)

try:
    from langchain_core.messages import HumanMessage
    
    llm = VeniceChatModel(model="llama-3.3-70b", streaming=True)
    
    print("Streaming response: ", end="")
    for chunk in llm.stream([
        HumanMessage(content="Count from 1 to 10."),
    ]):
        print(chunk.content, end="", flush=True)
    print()

except ImportError:
    print("LangChain not installed")


# ============================================================================
# With Vector Store (RAG example)
# ============================================================================

print("\n\nRAG Pipeline (conceptual):")
print("-" * 40)

try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.runnables import RunnablePassthrough
    from langchain_core.output_parsers import StrOutputParser
    
    # This is a conceptual example - you'd need a vector store
    print("""
    # Install: pip install langchain-community faiss-cpu
    
    from langchain_community.vectorstores import FAISS
    
    # Create embeddings
    embeddings = VeniceEmbeddings()
    
    # Create vector store from documents
    vectorstore = FAISS.from_texts(
        texts=["Doc 1 content...", "Doc 2 content..."],
        embedding=embeddings
    )
    
    # Create retriever
    retriever = vectorstore.as_retriever()
    
    # Create RAG chain
    llm = VeniceChatModel(model="llama-3.3-70b")
    
    prompt = ChatPromptTemplate.from_template('''
    Answer based on the context:
    
    Context: {context}
    Question: {question}
    ''')
    
    chain = (
        {"context": retriever, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    
    result = chain.invoke("Your question here")
    """)

except ImportError:
    print("LangChain not installed")
