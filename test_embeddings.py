"""Test embeddings directly"""
import requests
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

API_KEY = 'VENICE-INFERENCE-KEY-xyVIqxkUz9TN4whC-zxGbCiuyEZO9RWZlaCu-9Tn2J'

# Raw request to Venice embeddings endpoint
resp = requests.post(
    'https://api.venice.ai/api/v1/embeddings',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={
        'model': 'text-embedding-bge-m3',
        'input': 'test'
    }
)
print(f'Direct POST: {resp.status_code}')
if resp.status_code == 200:
    data = resp.json()
    print(f"  dim={len(data['data'][0]['embedding'])}")
else:
    print(f'  Error: {resp.text[:200]}')

# Try with array input like LangChain does
resp2 = requests.post(
    'https://api.venice.ai/api/v1/embeddings',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={
        'model': 'text-embedding-bge-m3',
        'input': ['test']  # array format
    }
)
print(f'Array input POST: {resp2.status_code}')
if resp2.status_code == 200:
    data = resp2.json()
    print(f"  dim={len(data['data'][0]['embedding'])}")
else:
    print(f'  Error: {resp2.text[:200]}')

# Check what langchain-openai version
print()

# Try with check_embedding_ctx_length=False
from langchain_openai import OpenAIEmbeddings
embeddings = OpenAIEmbeddings(
    model='text-embedding-bge-m3',
    api_key=API_KEY,
    base_url='https://api.venice.ai/api/v1',
    check_embedding_ctx_length=False,  # Disable token checking
)
try:
    result = embeddings.embed_query('test')
    print(f'With check_embedding_ctx_length=False: works, dim={len(result)}')
except Exception as e:
    print(f'With check_embedding_ctx_length=False: FAILED - {e}')

