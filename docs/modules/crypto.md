# Crypto

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/crypto` |
| **Kind** | capability module |
| **Engine** | Web Crypto |

Small, explicit cryptographic operations:

| Tool | Purpose |
| --- | --- |
| `crypto-hash` | SHA-256, SHA-384, or SHA-512 digest |
| `crypto-hmac-sign` | HMAC signature using a host-bound key id |
| `crypto-hmac-verify` | Constant-time HMAC verification through Web Crypto |
| `crypto-random-bytes` | Up to 4096 secure random bytes |

HMAC key material is host auth, not a tool argument. The model selects a bound `key_id`. Data and results use UTF-8 or base64 contracts.
