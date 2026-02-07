"""
Web Search Integration Example

Demonstrates Venice's real-time web search capabilities.
"""

from venice import Venice

client = Venice()

# Enable web search
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[
        {"role": "user", "content": "What were the top tech news stories today?"},
    ],
    enable_web_search="on",  # Force web search
    # Or use "auto" to let the model decide
)

print("Web Search Response:")
print("-" * 40)
print(response.content)


# With citations
print("\n\nWith Citations:")
print("-" * 40)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[
        {"role": "user", "content": "What is the current price of Bitcoin?"},
    ],
    venice_parameters={
        "enable_web_search": "on",
        "enable_web_citations": True,  # Request citations
    },
)

print(response.content)


# URL scraping
print("\n\nURL Scraping:")
print("-" * 40)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[
        {"role": "user", "content": "Summarize this page: https://docs.venice.ai"},
    ],
    venice_parameters={
        "enable_web_scraping": True,  # Scrape URLs in the message
    },
)

print(response.content)
