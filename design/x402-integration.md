# x402 Micropayments Integration Design for Venice AI

**Status:** Draft  
**Author:** Venice AI Engineering  
**Created:** 2026-01-31  
**Last Updated:** 2026-01-31

## Executive Summary

This document proposes integrating the x402 micropayments standard into Venice AI's API infrastructure. x402 is an open, HTTP-native payment protocol developed by Coinbase that enables frictionless, pay-per-request transactions using cryptocurrency (primarily stablecoins like USDC). This integration would allow Venice AI to offer keyless, instant API access where users pay per request without requiring accounts, API keys, or prepaid credits.

## Table of Contents

1. [x402 Standard Overview](#x402-standard-overview)
2. [Strategic Fit with Venice AI](#strategic-fit-with-venice-ai)
3. [Current Venice API Architecture](#current-venice-api-architecture)
4. [Integration Architecture](#integration-architecture)
5. [Implementation Approach](#implementation-approach)
6. [Endpoint Design](#endpoint-design)
7. [Payment Flow](#payment-flow)
8. [Security Considerations](#security-considerations)
9. [Example Request/Response Flows](#example-requestresponse-flows)
10. [Migration & Rollout Strategy](#migration--rollout-strategy)
11. [Open Questions](#open-questions)

---

## 1. x402 Standard Overview

### What is x402?

x402 leverages the historically unused HTTP 402 "Payment Required" status code to create a native payment layer for the internet. The protocol is:

- **Open & Neutral**: Free to use, not tied to any single provider
- **HTTP-Native**: Built into existing HTTP request/response cycles
- **Network Agnostic**: Supports multiple blockchains (EVM, Solana, etc.) and tokens
- **Trust-Minimizing**: Cryptographic signatures prevent facilitators from moving funds arbitrarily

### Core Components

| Component | Description |
|-----------|-------------|
| **Client** | Entity wanting to pay for a resource (user, AI agent, application) |
| **Resource Server** | HTTP server providing paid API/resources (Venice API) |
| **Facilitator** | Service that verifies and settles payments on-chain |

### Protocol Flow

```
┌────────┐                    ┌─────────────────┐                  ┌─────────────┐
│ Client │                    │ Resource Server │                  │ Facilitator │
└───┬────┘                    └────────┬────────┘                  └──────┬──────┘
    │                                  │                                   │
    │ 1. GET /v1/chat/completions     │                                   │
    │ ────────────────────────────────>│                                   │
    │                                  │                                   │
    │ 2. HTTP 402 + PAYMENT-REQUIRED  │                                   │
    │ <────────────────────────────────│                                   │
    │                                  │                                   │
    │ 3. Sign payment authorization   │                                   │
    │ (client-side, using wallet)     │                                   │
    │                                  │                                   │
    │ 4. GET /v1/chat/completions     │                                   │
    │    + PAYMENT-SIGNATURE header   │                                   │
    │ ────────────────────────────────>│                                   │
    │                                  │ 5. POST /verify                   │
    │                                  │ ─────────────────────────────────>│
    │                                  │                                   │
    │                                  │ 6. { isValid: true }              │
    │                                  │ <─────────────────────────────────│
    │                                  │                                   │
    │                                  │ [Execute inference]               │
    │                                  │                                   │
    │                                  │ 7. POST /settle                   │
    │                                  │ ─────────────────────────────────>│
    │                                  │                                   │
    │                                  │ 8. { success: true, tx: "0x..." } │
    │                                  │ <─────────────────────────────────│
    │                                  │                                   │
    │ 9. HTTP 200 + Response          │                                   │
    │    + PAYMENT-RESPONSE header    │                                   │
    │ <────────────────────────────────│                                   │
    │                                  │                                   │
```

### Payment Schemes

x402 uses the **"exact" scheme** which transfers a specific, predetermined amount:

- **EVM (Ethereum, Base, etc.)**: Uses EIP-3009 `transferWithAuthorization` for gasless USDC transfers, or Permit2 for other ERC-20 tokens
- **Solana**: Uses SPL token `TransferChecked` instructions
- **Stellar, Aptos, Sui**: Native chain-specific implementations

### HTTP Headers

| Header | Direction | Description |
|--------|-----------|-------------|
| `PAYMENT-REQUIRED` | Server → Client | Base64 JSON with payment requirements |
| `PAYMENT-SIGNATURE` | Client → Server | Base64 JSON with signed payment authorization |
| `PAYMENT-RESPONSE` | Server → Client | Base64 JSON with settlement confirmation |

---

## 2. Strategic Fit with Venice AI

### Why x402 for Venice?

1. **Aligned with Crypto-Native Identity**: Venice already supports DIEM tokens and Web3 API key generation. x402 deepens the crypto integration.

2. **Enables AI Agent Payments**: AI agents can autonomously pay for API access without human intervention—perfect for the agentic future.

3. **Frictionless Onboarding**: No account creation, no API keys, no prepaid credits. Just pay and use.

4. **Micropayment Economics**: Pay exactly for what you use, down to individual API calls.

5. **Privacy Preservation**: Aligns with Venice's privacy-first philosophy—no KYC required for micropayments.

### Use Cases

| Use Case | Description |
|----------|-------------|
| **Agent-to-API** | AI agents pay for Venice inference without human intervention |
| **Anonymous Access** | Users access Venice without creating accounts |
| **Pay-As-You-Go** | No prepaid credits or subscriptions required |
| **Cross-Platform** | Third-party apps integrate Venice via x402 |
| **Overflow Capacity** | Handle burst traffic from non-registered users |

---

## 3. Current Venice API Architecture

Based on the Venice API documentation, the current architecture includes:

### Authentication
- API keys via `Authorization: Bearer <key>` header
- Web3-generated API keys supported
- Rate limiting per API key

### Endpoints
- **Chat Completions**: `/api/v1/chat/completions`
- **Image Generation**: `/api/v1/images/generations`
- **Embeddings**: `/api/v1/embeddings`
- **Audio**: `/api/v1/audio/speech`, `/api/v1/audio/transcriptions`

### Pricing Model
- Per-token pricing for text models (input/output/cache)
- Per-image pricing for image generation
- Prices in USD, payable via USD credits or DIEM tokens (1 DIEM = $1/day)

### Response Headers
Venice already returns rich metadata headers:
- `x-venice-balance-usd`, `x-venice-balance-diem`, `x-venice-balance-vcu`
- Rate limiting headers
- Model information headers

---

## 4. Integration Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Venice API Gateway                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │   Auth Layer     │    │  x402 Middleware │    │   Routing Layer      │  │
│  │                  │    │                  │    │                      │  │
│  │ - API Key Auth   │───>│ - Payment Check  │───>│ - Model Selection    │  │
│  │ - Web3 Auth      │    │ - 402 Response   │    │ - Load Balancing     │  │
│  │ - x402 Auth (NEW)│    │ - Verification   │    │ - Request Dispatch   │  │
│  │                  │    │ - Settlement     │    │                      │  │
│  └──────────────────┘    └────────┬─────────┘    └──────────────────────┘  │
│                                   │                                          │
│                          ┌────────▼─────────┐                               │
│                          │   Facilitator    │                               │
│                          │   (Coinbase or   │                               │
│                          │   Self-Hosted)   │                               │
│                          └────────┬─────────┘                               │
│                                   │                                          │
│                          ┌────────▼─────────┐                               │
│                          │   Blockchain     │                               │
│                          │   (Base, etc.)   │                               │
│                          └──────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### x402 Middleware
- Intercepts requests without valid authentication
- Returns HTTP 402 with `PAYMENT-REQUIRED` header
- Validates incoming `PAYMENT-SIGNATURE` headers
- Communicates with facilitator for verification and settlement

#### Facilitator Options
1. **Coinbase Facilitator**: Use Coinbase's hosted facilitator service
2. **Self-Hosted**: Deploy Venice's own facilitator for more control
3. **Hybrid**: Self-hosted with Coinbase as fallback

#### Pricing Engine Integration
- Calculate request cost based on:
  - Model selection
  - Estimated token count (for text)
  - Image dimensions/quality
- Return `maxAmountRequired` in payment requirements

---

## 5. Implementation Approach

### Phase 1: Core Infrastructure (MVP)

1. **x402 Middleware Implementation**
   - Add middleware to API gateway
   - Implement payment requirement generation
   - Integrate with external Coinbase facilitator

2. **Supported Networks (Initial)**
   - Base (mainnet) - USDC
   - Base Sepolia (testnet) - for development

3. **Supported Endpoints**
   - `/api/v1/chat/completions`
   - `/api/v1/images/generations`

4. **Pricing Integration**
   - Dynamic pricing based on model and estimated usage
   - Add buffer for token estimation uncertainty

### Phase 2: Enhanced Features

1. **Additional Networks**
   - Ethereum mainnet
   - Solana
   - Arbitrum

2. **Self-Hosted Facilitator**
   - Deploy Venice-controlled facilitator
   - Reduce dependency on external services

3. **All Endpoints**
   - Embeddings
   - Audio (TTS, STT)
   - Image editing/upscaling

### Phase 3: Advanced Features

1. **Session-Based Pricing**
   - Bundle multiple requests under one payment
   - Subscription-like experience via x402

2. **Discovery API Integration**
   - Register Venice endpoints with x402 Bazaar
   - Enable marketplace discovery

3. **Authenticated Pricing**
   - Discounts for verified users (SIWE integration)
   - Tiered pricing based on usage history

---

## 6. Endpoint Design

### Payment Requirements Configuration

Each Venice endpoint would be configured with x402 payment requirements:

```typescript
const x402Config = {
  "POST /api/v1/chat/completions": {
    description: "AI chat completion with uncensored models",
    mimeType: "application/json",
    pricing: (request) => calculateChatPrice(request),
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453", // Base mainnet
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      },
      {
        scheme: "exact", 
        network: "eip155:84532", // Base Sepolia (testnet)
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
      }
    ]
  },
  "POST /api/v1/images/generations": {
    description: "AI image generation with private inference",
    mimeType: "application/json",
    pricing: (request) => calculateImagePrice(request),
    accepts: [/* same as above */]
  }
};
```

### Pricing Calculation

```typescript
function calculateChatPrice(request: ChatRequest): string {
  const model = request.model;
  const modelPricing = getModelPricing(model);
  
  // Estimate tokens (pre-request)
  const estimatedInputTokens = estimateTokens(request.messages);
  const estimatedOutputTokens = request.max_tokens || 4096;
  
  // Calculate cost in USD
  const inputCost = (estimatedInputTokens / 1_000_000) * modelPricing.inputPrice;
  const outputCost = (estimatedOutputTokens / 1_000_000) * modelPricing.outputPrice;
  
  // Add 20% buffer for estimation uncertainty
  const totalCost = (inputCost + outputCost) * 1.2;
  
  // Convert to USDC atomic units (6 decimals)
  return Math.ceil(totalCost * 1_000_000).toString();
}

function calculateImagePrice(request: ImageRequest): string {
  const model = request.model || "venice-sd35";
  const modelPricing = getImageModelPricing(model);
  
  // Per-image pricing
  const numImages = request.n || 1;
  const totalCost = modelPricing.perImage * numImages;
  
  // Convert to USDC atomic units
  return Math.ceil(totalCost * 1_000_000).toString();
}
```

### New Headers

Venice would add these x402-specific response headers:

| Header | Description |
|--------|-------------|
| `x-venice-x402-enabled` | `true` if endpoint supports x402 payments |
| `x-venice-x402-networks` | Comma-separated list of supported networks |
| `x-venice-payment-tx` | Transaction hash of settled payment |

---

## 7. Payment Flow

### Flow A: First Request (No Payment)

```http
POST /api/v1/chat/completions HTTP/1.1
Host: api.venice.ai
Content-Type: application/json

{
  "model": "llama-3.3-70b",
  "messages": [{"role": "user", "content": "Hello!"}]
}
```

**Response:**

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkLi4uIiwiYWNjZXB0cyI6Wy4uLl19

{
  "error": {
    "message": "Payment required. Include PAYMENT-SIGNATURE header with valid payment authorization.",
    "type": "payment_required",
    "code": "x402_payment_required"
  }
}
```

The `PAYMENT-REQUIRED` header decodes to:

```json
{
  "x402Version": 2,
  "error": "Payment required for Venice AI inference",
  "resource": {
    "url": "https://api.venice.ai/api/v1/chat/completions",
    "description": "AI chat completion with uncensored models",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "2100",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0xVenicePaymentAddress...",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    }
  ]
}
```

### Flow B: Request with Payment

Client signs authorization and retries:

```http
POST /api/v1/chat/completions HTTP/1.1
Host: api.venice.ai
Content-Type: application/json
PAYMENT-SIGNATURE: eyJ4NDAyVmVyc2lvbiI6MiwicGF5bG9hZCI6ey4uLn19

{
  "model": "llama-3.3-70b",
  "messages": [{"role": "user", "content": "Hello!"}]
}
```

**Successful Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json
PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6IjB4Li4uIn0=
x-venice-payment-tx: 0x1234567890abcdef...

{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "model": "llama-3.3-70b",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      }
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 12,
    "total_tokens": 22
  }
}
```

---

## 8. Security Considerations

### Replay Attack Prevention

x402 includes multiple protections:

1. **Unique Nonces**: Each payment authorization includes a random 32-byte nonce
2. **Blockchain Enforcement**: EIP-3009 contracts reject reused nonces
3. **Time Windows**: Authorizations have `validAfter` and `validBefore` timestamps
4. **Signature Verification**: All authorizations are cryptographically signed

### Payment Amount Validation

- Verify payment amount meets or exceeds calculated cost
- Settlement occurs only after request is processed
- Venice bears the risk of token estimation inaccuracy

### Facilitator Trust

- Facilitator cannot redirect funds (cryptographic enforcement)
- Facilitator only broadcasts pre-signed transactions
- Consider self-hosting for maximum control

### Rate Limiting

Even with x402 payments, implement:
- Per-wallet rate limits to prevent DoS
- Global rate limits during network congestion
- Blacklist for abusive wallets

### Error Handling

| Scenario | Response |
|----------|----------|
| Invalid signature | 402 with `invalid_signature` error |
| Insufficient funds | 402 with `insufficient_funds` error |
| Expired authorization | 402 with `authorization_expired` error |
| Settlement failed | 500 with refund instructions |

---

## 9. Example Request/Response Flows

### Chat Completion with x402

#### Step 1: Initial Request (No Auth)

```bash
curl -X POST https://api.venice.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Explain quantum computing"}]
  }'
```

**Response (402):**
```json
{
  "error": {
    "message": "Payment required. This endpoint accepts x402 micropayments.",
    "type": "payment_required",
    "code": "x402_payment_required",
    "payment_details": {
      "amount_usd": "0.0021",
      "amount_usdc_atomic": "2100",
      "networks": ["base", "base-sepolia"],
      "asset": "USDC"
    }
  }
}
```

#### Step 2: Client Signs Payment (Off-chain)

Using @x402/fetch or similar SDK:

```typescript
import { wrapFetch } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const x402Fetch = wrapFetch(fetch, account, { network: "base" });

const response = await x402Fetch("https://api.venice.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "llama-3.3-70b",
    messages: [{ role: "user", content: "Explain quantum computing" }]
  })
});
```

#### Step 3: Request with Payment

```http
POST /api/v1/chat/completions HTTP/1.1
Host: api.venice.ai
Content-Type: application/json
PAYMENT-SIGNATURE: <base64-encoded-payment-payload>

{...}
```

#### Step 4: Successful Response

```json
{
  "id": "chatcmpl-xyz789",
  "object": "chat.completion",
  "model": "llama-3.3-70b",
  "choices": [{
    "message": {
      "role": "assistant", 
      "content": "Quantum computing is a type of computation that harnesses quantum mechanical phenomena..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 150,
    "total_tokens": 165
  },
  "x402": {
    "payment_tx": "0xabc123...",
    "amount_charged": "2100",
    "network": "base"
  }
}
```

### Image Generation with x402

```bash
# Using x402-enabled client
x402-curl -X POST https://api.venice.ai/api/v1/images/generations \
  --wallet $WALLET_ADDRESS \
  -d '{
    "model": "venice-sd35",
    "prompt": "A cyberpunk cityscape at night",
    "n": 1,
    "size": "1024x1024"
  }'
```

**Response:**
```json
{
  "created": 1706652000,
  "data": [{
    "b64_json": "/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "revised_prompt": "A cyberpunk cityscape at night..."
  }],
  "x402": {
    "payment_tx": "0xdef456...",
    "amount_charged": "10000",
    "network": "base"
  }
}
```

---

## 10. Migration & Rollout Strategy

### Phase 1: Testnet Launch (Week 1-2)
- Deploy x402 middleware to staging environment
- Base Sepolia testnet only
- Internal testing and SDK validation

### Phase 2: Beta Launch (Week 3-4)
- Enable on production for opt-in users
- Base mainnet with limited models
- Documentation and SDK examples published

### Phase 3: General Availability (Week 5+)
- Enable for all endpoints
- Add additional networks based on demand
- Marketing announcement

### Backward Compatibility

- Existing API key authentication remains primary method
- x402 is an additional, optional authentication path
- No changes required for existing integrations

### Monitoring & Metrics

Track:
- x402 request volume vs API key requests
- Payment success/failure rates
- Average payment amounts
- Network distribution
- Settlement latency

---

## 11. Open Questions

1. **Facilitator Choice**: Self-host vs. Coinbase hosted? Hybrid approach?

2. **Refund Policy**: How to handle failed requests after payment verification but before settlement?

3. **Price Estimation Accuracy**: How much buffer to add for token estimation?

4. **Streaming Support**: How to handle x402 payments for streaming responses (tokens come incrementally)?

5. **Multi-Network Priority**: Which networks beyond Base to prioritize?

6. **DIEM Integration**: Should x402 payments be convertible to DIEM staking?

7. **Rate Limits**: Wallet-based rate limits for x402 users?

8. **Minimum Payment**: Set a minimum payment threshold to avoid dust transactions?

---

## Appendix A: x402 SDK Options

### Client-Side Libraries

| Language | Package | Description |
|----------|---------|-------------|
| TypeScript | `@x402/fetch` | Wraps fetch with auto-payment |
| TypeScript | `@x402/axios` | Wraps axios with auto-payment |
| Python | `x402` | Python client library |
| Go | `github.com/coinbase/x402/go` | Go client library |

### Server-Side Libraries

| Language | Package | Description |
|----------|---------|-------------|
| TypeScript | `@x402/express` | Express.js middleware |
| TypeScript | `@x402/hono` | Hono framework middleware |
| TypeScript | `@x402/next` | Next.js middleware |
| Python | `x402` | FastAPI/Flask middleware |

---

## Appendix B: References

- [x402 Protocol Specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v1.md)
- [x402 Official Website](https://x402.org)
- [Venice API Documentation](https://docs.venice.ai)
- [EIP-3009: Transfer with Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [Permit2 Documentation](https://docs.uniswap.org/contracts/permit2/overview)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-01-31 | Initial draft |
