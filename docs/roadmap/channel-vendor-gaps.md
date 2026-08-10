# Channel vendor gaps (Five Star production call sites)

Status: **living**  
Date: 2026-08-05  

Backlog of real missing surfaces vs Lambda channel transports. Not every Web API method — only production call sites.

**Authority:** pack docs · `AGENTS.md` (host vs package) · gold vendor layout.

| Layer | Owns |
| --- | --- |
| **Vendor pack** | Provider HTTP, pure reference helpers, host client methods |
| **Host** | Webhook routes, claims, PHI, scopes, Graph admin policy, when to call |
| **Messaging seam** | Shared send/edit/react verbs only — **not** Slack streams / Teams Graph |

---

## Slack (`src/vendors/slack`)

| Item | Shape | Status |
| --- | --- | --- |
| `views.publish` | host client | done (this slice) |
| `assistant.threads.setSuggestedPrompts` | host client | done |
| `chat.startStream` / `appendStream` / `stopStream` | host client | done |
| Full `assistant.threads.setStatus` (+ `loading_messages`) | host client; seam typing still maps enum | done |
| `auth.revoke` | host client | done |
| `users.info` | host client | done |
| `users.conversations`, `conversations.info` / `history` / `replies` | host client | done |
| Reference helpers (mentions, channels, permalinks, strip bot @) | pure | done |
| Multi-file external upload | host client `sendMediaBatch` | done |
| Binary body in/out (`Uint8Array`) | host client overloads | done |

Agent tools stay on core messaging verbs unless product asks otherwise.

---

## Microsoft Teams (`src/vendors/teams`)

| Item | Shape | Status |
| --- | --- | --- |
| Real reaction add/remove (Graph `setReaction` / `unsetReaction`) | client when Graph token available | done (this slice) |
| Graph reads (team, channels, membership, messages, replies) | host client | todo |
| Channel/message URL parse | pure | todo |
| Personal-chat `downloadUrl` path | align `downloadFile` | partial (URL-as-file_id already) |
| File-consent attachment builder | pure helper | todo |

---

## iMessage

| Item | Notes | Status |
| --- | --- | --- |
| Spectrum webhook verify + rich parse | host today; pack has no Spectrum inbound by design | blocked on Spectrum vs Photon inbound lock |
| Outbound | **photon-rest-proxy** HTTP (`base_url` + Spectrum project headers) | pack migrated; proxy gaps: ensure-chat, clear-by-target+emoji, download without space, stable message_id |

---

## Telegram

No functional gap for current production call sites.

---

## Priority

1. Slack host surface (this slice)  
2. Teams reactions (this slice)  
3. Teams Graph reference reads + helpers  
4. iMessage inbound only after contract decision  
