# TEE & E2EE Models

Privacy-enhanced AI with Trusted Execution Environments and End-to-End Encryption.

Venice offers privacy-enhanced models that run in Trusted Execution Environments (TEE) and support End-to-End Encryption (E2EE). These models provide cryptographic guarantees that your data remains private—even from Venice.

## Understanding the Privacy Levels

| Type | Prefix | What It Means |
|------|--------|---------------|
| **TEE** | `tee-*` | Model runs in a hardware-secured enclave. Venice cannot access the computation. You can verify this with attestation. |
| **E2EE** | `e2ee-*` | Full end-to-end encryption. Your prompts are encrypted client-side before being sent. Only the TEE can decrypt them. |

> **Note:** E2EE models include TEE protection plus client-side encryption. TEE models provide enclave security without requiring client-side encryption.

## TEE Models

TEE models run inside hardware-secured enclaves (Intel TDX, NVIDIA Confidential Computing). The model weights and your data are protected from the host system—including Venice's infrastructure.

### Basic Usage

TEE models work exactly like regular models:

**Python:**
```python
from openai import OpenAI

client = OpenAI(
    api_key="your-venice-api-key",
    base_url="https://api.venice.ai/api/v1"
)

response = client.chat.completions.create(
    model="tee-qwen3-30b-a3b",
    messages=[{"role": "user", "content": "Explain quantum computing"}]
)

print(response.choices[0].message.content)
```

**Node.js:**
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: 'your-venice-api-key',
    baseURL: 'https://api.venice.ai/api/v1'
});

const response = await client.chat.completions.create({
    model: 'tee-qwen3-30b-a3b',
    messages: [{ role: 'user', content: 'Explain quantum computing' }]
});

console.log(response.choices[0].message.content);
```

**cURL:**
```bash
curl https://api.venice.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $VENICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tee-qwen3-30b-a3b",
    "messages": [{"role": "user", "content": "Explain quantum computing"}]
  }'
```

### Verifying TEE Attestation

You can cryptographically verify that a model is running in a genuine TEE by fetching its attestation report:

**cURL:**
```bash
# Generate a random nonce (prevents replay attacks)
NONCE=$(openssl rand -hex 16)

# Fetch attestation
curl "https://api.venice.ai/api/v1/tee/attestation?model=tee-qwen3-30b-a3b&nonce=$NONCE" \
  -H "Authorization: Bearer $VENICE_API_KEY"
```

**Python:**
```python
import secrets
import requests

nonce = secrets.token_hex(16)

response = requests.get(
    f"https://api.venice.ai/api/v1/tee/attestation",
    params={"model": "tee-qwen3-30b-a3b", "nonce": nonce},
    headers={"Authorization": f"Bearer {api_key}"}
)

attestation = response.json()
print(f"Verified: {attestation['verified']}")
print(f"TEE Provider: {attestation['tee_provider']}")
print(f"Model: {attestation['model']}")
```

#### Attestation Response Fields

| Field | Description |
|-------|-------------|
| `verified` | Whether the attestation passed server-side verification |
| `nonce` | Your nonce, confirming freshness |
| `model` | The attested model ID |
| `tee_provider` | TEE provider identifier |
| `intel_quote` | Raw Intel TDX quote (base64) for client-side verification |
| `nvidia_payload` | NVIDIA GPU attestation data (if applicable) |
| `signing_key` | Public key for verifying response signatures |
| `signing_address` | Ethereum address derived from signing key |

> **Tip:** For production use, verify the attestation client-side by parsing the Intel TDX quote and checking the NVIDIA attestation. See our [verification libraries](https://github.com/veniceai) for reference implementations.

### Response Signatures

TEE models can sign their responses, proving the output came from the attested enclave:

```bash
# After getting a completion, verify the signature
curl "https://api.venice.ai/api/v1/tee/signature?model=tee-qwen3-30b-a3b&request_id=chatcmpl-abc123" \
  -H "Authorization: Bearer $VENICE_API_KEY"
```

---

## E2EE Models

E2EE models add client-side encryption on top of TEE protection. Your prompts are encrypted before leaving your device, and only the TEE can decrypt them.

> **Warning:** E2EE requires client-side implementation. The examples below show the protocol—use our SDKs for production.

### How E2EE Works

1. **Fetch Attestation** - Get the model's TEE attestation and public key.
2. **Generate Ephemeral Keys** - Create an ECDH key pair (secp256k1) for this session.
3. **Derive Shared Secret** - Use ECDH to derive a shared secret with the model's public key.
4. **Encrypt Messages** - Encrypt your prompts with AES-256-GCM using the shared secret.
5. **Send Request** - Include your public key in headers. The TEE decrypts and processes.
6. **Decrypt Response** - The streamed response is encrypted—decrypt each chunk client-side.

### E2EE Request Headers

When making E2EE requests, include these headers:

| Header | Description |
|--------|-------------|
| `X-Venice-TEE-Client-Pub-Key` | Your ephemeral public key (hex-encoded) |
| `X-Venice-TEE-Signing-Algo` | Signature algorithm (use `ecdsa`) |
| `X-Venice-TEE-Model-Pub-Key` | Model's public key from attestation |

### Encryption Format

Messages are encrypted as hex-encoded ciphertext:

```
<nonce:24bytes><ciphertext><tag:16bytes>
```

- **Nonce**: 12 random bytes (24 hex chars)
- **Ciphertext**: AES-256-GCM encrypted content
- **Tag**: 16-byte authentication tag (32 hex chars)

### Example Flow (Python)

```python
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import requests

# 1. Fetch attestation
nonce = os.urandom(16).hex()
attestation = requests.get(
    "https://api.venice.ai/api/v1/tee/attestation",
    params={"model": "e2ee-qwen3-30b-a3b", "nonce": nonce},
    headers={"Authorization": f"Bearer {api_key}"}
).json()

model_pubkey = attestation["signing_key"]

# 2. Generate ephemeral key pair
private_key = ec.generate_private_key(ec.SECP256K1())
public_key_hex = private_key.public_key().public_bytes(...).hex()

# 3. Derive shared secret (ECDH + HKDF)
shared_secret = derive_shared_secret(private_key, model_pubkey)

# 4. Encrypt message
def encrypt_message(plaintext: str, shared_secret: bytes) -> str:
    nonce = os.urandom(12)
    aesgcm = AESGCM(shared_secret)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return (nonce + ciphertext).hex()

encrypted_content = encrypt_message("Your private message", shared_secret)

# 5. Send request with E2EE headers
response = requests.post(
    "https://api.venice.ai/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Venice-TEE-Client-Pub-Key": public_key_hex,
        "X-Venice-TEE-Signing-Algo": "ecdsa",
        "X-Venice-TEE-Model-Pub-Key": model_pubkey,
    },
    json={
        "model": "e2ee-qwen3-30b-a3b",
        "messages": [{"role": "user", "content": encrypted_content}],
        "stream": True  # E2EE requires streaming
    },
    stream=True
)

# 6. Decrypt streamed response chunks
for line in response.iter_lines():
    if line.startswith(b"data: "):
        chunk = json.loads(line[6:])
        encrypted_chunk = chunk["choices"][0]["delta"].get("content", "")
        if encrypted_chunk:
            decrypted = decrypt_chunk(encrypted_chunk, shared_secret)
            print(decrypted, end="", flush=True)
```

### E2EE Limitations

| Feature | Status |
|---------|--------|
| Streaming | **Required** (non-streaming not supported) |
| Web search | **Disabled** (would leak content) |
| File uploads | **Not supported** |
| Function calling | **Not supported** |
| Venice system prompt | **Disabled** (must be encrypted client-side) |

---

## Using Venice CLI

The [Venice CLI](https://github.com/veniceai/venice-cli) handles all TEE verification and E2EE encryption automatically:

```bash
# Install
npm install -g veniceai-cli

# Configure
venice config set api_key YOUR_API_KEY

# TEE model - automatically verifies attestation
venice chat -m tee-qwen3-30b-a3b "Hello"

# E2EE model - automatically encrypts/decrypts
venice chat -m e2ee-qwen3-30b-a3b "This is end-to-end encrypted"

# Show attestation details
venice chat -m tee-qwen3-30b-a3b --tee-verify "Hello"

# Quiet mode - hide security messages
venice chat -m e2ee-qwen3-30b-a3b -q "Just show the response"

# Standalone attestation check
venice tee attestation tee-qwen3-30b-a3b
```

---

## Best Practices

### Always verify attestation in production
Don't just trust the `verified: true` response. Parse the Intel TDX quote client-side and verify the measurements match expected values. For NVIDIA GPUs, check the attestation via NVIDIA's verification service.

### Use fresh nonces
Always generate a new random nonce for each attestation request. This prevents replay attacks where an attacker could serve a stale attestation.

### Verify key binding
The signing key should be bound to the TDX REPORTDATA field. This proves the key was generated inside the enclave.

### Check for debug mode
Verify the TDX attestation doesn't have debug flags set. A debug enclave can be inspected and should not be trusted for production.

### Use our SDKs for E2EE
E2EE requires careful cryptographic implementation. Use our official SDKs rather than implementing the protocol yourself.

---

## Checking Model Capabilities

You can check if a model supports TEE or E2EE via the models endpoint:

**cURL:**
```bash
curl https://api.venice.ai/api/v1/models \
  -H "Authorization: Bearer $VENICE_API_KEY" | \
  jq '.data[] | select(.model_spec.capabilities.supportsTeeAttestation == true or .model_spec.capabilities.supportsE2EE == true) | {id, tee: .model_spec.capabilities.supportsTeeAttestation, e2ee: .model_spec.capabilities.supportsE2EE}'
```

**Python:**
```python
models = client.models.list()

for model in models.data:
    caps = getattr(model, 'model_spec', {}).get('capabilities', {})
    if caps.get('supportsTeeAttestation') or caps.get('supportsE2EE'):
        print(f"{model.id}: TEE={caps.get('supportsTeeAttestation')}, E2EE={caps.get('supportsE2EE')}")
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `TEE attestation verification failed` | Attestation didn't pass validation | Retry or contact support |
| `Attestation nonce mismatch` | Possible replay attack | Generate a fresh nonce |
| `TDX debug mode detected` | Enclave is in debug mode | Don't use for production |
| `Failed to decrypt field` | E2EE decryption failed server-side | Check your encryption implementation |
| `E2EE requires streaming` | Non-streaming request to E2EE model | Set `stream: true` |

---

## Resources

- [Venice CLI](https://github.com/veniceai/venice-cli) - Command-line tool with built-in TEE/E2EE support
- [Intel TDX Documentation](https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/documentation.html)
- [NVIDIA Confidential Computing](https://developer.nvidia.com/confidential-computing)
