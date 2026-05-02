# GroupSpeak

> Intent-driven, AI-amplified, moderated conversations with strangers. Pick a topic, pick a mood, get matched in seconds.

A monorepo with a Next.js frontend, a Socket.io realtime server, Redis-backed matchmaking, WebRTC mesh video, and an Anthropic-powered AI co-host.

---

## Table of contents

1. [What's in the box](#whats-in-the-box)
2. [Architecture](#architecture)
3. [Local setup (5 minutes)](#local-setup-5-minutes)
4. [Environment variables](#environment-variables)
5. [Database schema](#database-schema)
6. [Redis data structures](#redis-data-structures)
7. [The matchmaking algorithm](#the-matchmaking-algorithm)
8. [WebRTC signaling flow](#webrtc-signaling-flow)
9. [AI prompts (exact text)](#ai-prompts-exact-text)
10. [Reputation system (Vibe Score)](#reputation-system-vibe-score)
11. [Safety & moderation](#safety--moderation)
12. [Socket protocol](#socket-protocol)
13. [Production deployment](#production-deployment)
14. [Scaling notes](#scaling-notes)
15. [Bonus features and where to wire them](#bonus-features-and-where-to-wire-them)

---

## What's in the box

```
groupspeak/
├── apps/
│   ├── web/          Next.js 14 App Router · TypeScript · Tailwind · Zustand
│   └── realtime/     Node 20 · Socket.io · ioredis · Anthropic SDK · Prisma
├── packages/
│   ├── shared/       Wire types, enums, ClientEvent/ServerEvent, MATCHMAKER_CONFIG
│   └── db/           Prisma schema + client
├── docker-compose.yml   Postgres 16 + Redis 7 (+ optional coturn)
└── .env.example
```

Two long-running processes — the Next.js web app (`:3000`) and the realtime/socket server (`:4000`). They share types via `@groupspeak/shared` and a database via `@groupspeak/db`.

---

## Architecture

```
                 ┌─────────────────────────────────────────┐
                 │            Browser (Next.js)            │
                 │  Zustand store · Socket.io client       │
                 │  PeerMesh (RTCPeerConnection per peer)  │
                 └────────────┬────────────────────────────┘
                              │  WebSocket (auth: JWT)
                              │  WebRTC media (peer-to-peer)
                              ▼
        ┌────────────────────────────────────────────────────┐
        │             Realtime server (Node + Socket.io)     │
        │  ─ Auth (JWT)                                      │
        │  ─ Matchmaker worker (500ms tick, distributed lock)│
        │  ─ Signal relay (offer / answer / ICE)             │
        │  ─ Chat broadcast + moderation                     │
        │  ─ AI co-host (icebreaker / stall prompt / summary)│
        │  ─ Reputation recompute on rate                    │
        └─────┬───────────────────┬──────────────────┬───────┘
              │                   │                  │
              ▼                   ▼                  ▼
        ┌──────────┐        ┌──────────┐      ┌────────────┐
        │ Postgres │        │  Redis   │      │ Anthropic  │
        │ (Prisma) │        │ (queues) │      │ (Claude)   │
        └──────────┘        └──────────┘      └────────────┘
```

Postgres holds the durable record (users, sessions, ratings, reports, summaries). Redis holds the volatile matchmaking queue and per-session ephemeral state. The realtime server is the only thing that talks to Anthropic.

---

## Local setup (5 minutes)

You need: Node ≥ 20, pnpm 9, Docker.

```bash
# 1. Clone and install
git clone <your-repo> groupspeak && cd groupspeak
pnpm install

# 2. Environment
cp .env.example .env
# (optional) drop your real ANTHROPIC_API_KEY in .env to enable AI features

# 3. Infra
docker compose up -d postgres redis

# 4. Database
pnpm db:generate
pnpm db:migrate           # creates the schema
pnpm db:seed              # optional — adds a few test users

# 5. Run both services concurrently
pnpm dev
```

Now open <http://localhost:3000>. To test the full match flow you need two browser tabs (use one regular + one incognito so you get distinct anonymous accounts). Pick the same topic + intent + mode in both tabs and they will match within ~1 second.

> **WebRTC + localhost:** Browsers allow `getUserMedia` on `http://localhost`. Once you deploy, the web app *must* be served over HTTPS or the camera/mic prompt will fail.

---

## Environment variables

See `.env.example` for the full list. The key ones:

| Var | Where | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | both | HMAC for anonymous auth tokens. Use `openssl rand -hex 32` in prod. |
| `DATABASE_URL` | realtime, db | Postgres connection string. |
| `REDIS_URL` | realtime | Redis connection string. |
| `ANTHROPIC_API_KEY` | realtime | Optional. AI features fall back to canned content if absent. |
| `ANTHROPIC_MODEL` | realtime | Default `claude-sonnet-4-5`. |
| `CORS_ORIGIN` | realtime | The web app origin. |
| `NEXT_PUBLIC_REALTIME_URL` | web | Public URL of the realtime server. |
| `NEXT_PUBLIC_ICE_SERVERS` | web | JSON array of `RTCIceServer` objects. STUN by default; add TURN for prod. |

---

## Database schema

Defined in `packages/db/prisma/schema.prisma`. Five tables:

- **`User`** — `id`, `email?`, `displayName`, `vibeScore` (0–100, default 70), `banUntil?`, `isAnonymous`.
- **`Session`** — `id`, `mode` (`video|audio|text`), `intent` (`deep|casual|debate|vent|networking`), `topics[]`, `startedAt`, `endedAt?`, `summary?`.
- **`SessionParticipant`** — `userId × sessionId` join with `joinedAt`/`leftAt`. Skip rate is computed from this.
- **`Rating`** — `fromUserId × toUserId × sessionId` unique. `score 1-5`. Drives the Vibe Score.
- **`Report`** — `reporterId`, `reportedId`, `sessionId?`, `reason`, `aiScore?`, `status` (pending/reviewed/upheld/dismissed). Auto-moderation writes here too.

Run `pnpm db:studio` to browse the data with Prisma Studio.

---

## Redis data structures

| Key | Type | Purpose |
| --- | --- | --- |
| `queue:bucket:{intent}:{mode}:{groupSize}` | sorted set, score = enqueue ms | The active queue for a given configuration. |
| `queue:bucket:shadow:{intent}:{mode}:{groupSize}` | sorted set | Same shape but for users below the shadow-queue Vibe threshold. |
| `queue:user:{userId}` | hash `{ data, bucket }` | Full enqueue payload + a back-pointer to its bucket. TTL 120 s. |
| `match:recent:{userId}` | set of userIds | Peers this user matched with in the last 30 minutes. Drives the repeat-match penalty. |
| `session:{sessionId}` | hash | Lightweight session metadata cached at match time. |
| `session:{sessionId}:peers` | set | Active userIds in a session. |
| `ratelimit:{key}:{userId}` | string with TTL | INCR-based limiter (chat: 20 msgs/10 s; queue: 30 enqueues/min; AI prompt: 5/min). |
| `lock:matchmaker:tick` | string SETNX EX 2 | Distributed lock so multiple realtime nodes can run the worker safely. |

---

## The matchmaking algorithm

`apps/realtime/src/matchmaker.ts`. Tick every 500 ms, scoped to one bucket at a time.

**Bucketing.** Users are bucketed by `intent × mode × groupSize`. This collapses the search space and guarantees intent + mode parity by construction. Topics, vibe score, and recency are then used for ranking *within* the bucket.

**Score function.**

```
score(a, b) =
    100 * jaccard(a.topics, b.topics)        // topic overlap
  + 50                                        // intent match (always true within a bucket)
  -  5 * |a.vibeScore − b.vibeScore|         // reputation similarity
  - 200 if recentlyMatched(a, b)             // soft "no repeats"
  + 0.5 * minWaitSec                         // long-waiters get boosted
```

A pair is eligible if `score ≥ matchThreshold` (default 40). After 30 s in queue, the threshold relaxes to 0 to guarantee progress.

**Pairing (groupSize = 2).** Compute every pairwise score, sort descending, greedy max-weight matching with no user used twice. This is O(n²) per tick on the bucket size, which is fine for any realistic queue depth.

**Grouping (groupSize 3–5).** Seed-and-grow. Take the longest-waiting user as a seed, score every other user against the seed, keep adding the highest-scoring candidate that *also* clears threshold against every member already in the group. Stop at groupSize.

**Anti-glare ordering.** When a match commits, the server sorts the participant userIds and tells each peer to *initiate* WebRTC offers only to peers with a higher userId. Lower userIds wait for offers. This eliminates the offer collision problem in mesh topology.

All weights and timings are in `MATCHMAKER_CONFIG` in `packages/shared/src/index.ts` so you can tune them in one place.

---

## WebRTC signaling flow

```
client A (initiator)                    server                   client B
─────────────────────                    ──────                   ────────
addPeer(B, initiate=true)
createOffer → setLocalDescription
            ── rtc:offer{to:B, sdp} ──► relay ── rtc:offer{from:A, sdp} ──►
                                                                        setRemoteDescription
                                                                        createAnswer → setLocalDescription
            ◄── rtc:answer{from:B} ── relay ◄── rtc:answer{to:A, sdp} ──
setRemoteDescription
─── ICE trickle ─── rtc:ice{to,candidate} → relay → rtc:ice{from,candidate} ───
```

The realtime server *only relays* SDP and ICE — it never inspects media. ICE servers (STUN/TURN) are configured client-side via `NEXT_PUBLIC_ICE_SERVERS`. Mesh topology (every peer ↔ every peer) keeps things simple up to ~5 participants.

For production, run a TURN server. The provided `docker-compose.yml` includes a `coturn` service under the `prod` profile (`docker compose --profile prod up coturn`). Replace `TURN_USER` and `TURN_PASS`.

---

## AI prompts (exact text)

Defined in `apps/realtime/src/ai.ts` under `PROMPTS`. The model is called with `system` + a single `user` message; outputs are constrained to short text or strict JSON depending on the task.

### Icebreaker

```
SYSTEM
You are GroupSpeak's icebreaker generator.
You write ONE opener for a real-time video chat that strangers can react to within 5 seconds.
Rules:
- Maximum 22 words. No preamble. No emojis. No quotes.
- Be specific to the topics. Avoid generic small talk ('how's your day').
- Match the INTENT vibe: deep=reflective question, casual=light/funny prompt,
  debate=spicy take, vent=permission to be honest, networking=curiosity hook.
- Address the group as 'you all' if more than 2 participants.
- Output the opener ONLY. No labels.

USER
Topics: <comma list>
Intent: <intent>
Participants: <name1, name2, ...>
Write the opener.
```

### Stall prompt (AI co-host)

```
SYSTEM
You are GroupSpeak's AI co-host. The conversation has stalled.
Output ONE short prompt (max 18 words) that revives it.
- Reference what was just said when possible.
- Keep the original intent's tone.
- Do NOT moralise. Do NOT summarise. Do NOT ask multiple questions.
- Output the prompt ONLY. No labels.

USER
Topics: <...>
Intent: <...>
Last messages (newest last):
<name>: <text>
<name>: <text>
Write the prompt.
```

### Moderation

```
SYSTEM
You are GroupSpeak's moderation classifier.
Classify the message and respond with JSON ONLY, no prose, no markdown:
{ "flag": boolean, "score": number, "categories": string[], "reason": string }
- score: 0.0 (safe) to 1.0 (severe).
- flag: true if score >= 0.5 OR contains threats, hate speech, sexual content involving minors,
  doxxing, or explicit calls to violence.
- categories: subset of ['hate','harassment','sexual','self_harm','violence','spam','minor_safety'].
- reason: <= 12 words explaining the flag, empty string if not flagged.
Respond with the JSON object only.

USER
<message text>
```

### Post-session summary

```
SYSTEM
You are GroupSpeak's session summariser.
Write a 2-3 sentence neutral recap of what was actually discussed and any open threads.
- Do not invent details not present in the transcript.
- Do not name participants.
- No markdown, no bullet points. Plain sentences.

USER
Topics: <...>
Intent: <...>
Transcript:
<name>: <text>
<name>: <text>
...
Write the recap.
```

**Performance.** Icebreakers run *after* the WebRTC connection so they never block the perceived match latency. Stall prompts only fire after 25 s of silence in the room. Moderation runs in parallel with the chat broadcast — messages are sent immediately, then re-emitted with `flagged: true` if the model flags them. This is a deliberate latency-vs-purity tradeoff: real-time conversation flow wins.

---

## Reputation system (Vibe Score)

`apps/realtime/src/reputation.ts`. Recomputed for a user every time someone rates them.

```
score = clamp(70 + ratingSignal + behaviourSignal − reportPenalty, 0, 100)

  ratingSignal     = (avg(1-5 ratings) − 3) × 12               // [−24, +24]
  behaviourSignal  = mean(sessionDurationSec → [−5, +10])
                   − skipRate × 20                              // [−25, +10]
  reportPenalty    = upheldReports × 15
```

- `skipRate` = sessions left within 10 s ÷ total sessions joined. Burnt rubber tax.
- Users below `SHADOW_QUEUE_THRESHOLD` (default 30) are routed into a parallel shadow bucket — they still get matched, but only with each other. They don't pollute the main pool.
- `maybeBan(userId)` is called on every report. 3 upheld reports = 1 day, 5 = 7 days, 10+ = 30 days. The socket auth middleware checks `banUntil` on every connection.

---

## Safety & moderation

- **Auto-moderation on every chat message.** Cheap regex pre-filter for the worst slurs catches them with no API hop. Anything else goes through the Anthropic moderation prompt.
- **Auto-report.** When a message scores ≥ 0.85, a `Report` row is created with `status = upheld` and the sender's account is evaluated for ban.
- **Manual reports.** One-tap `Report` button in the room UI emits `session:report`. Upheld reports tick the ban counter.
- **Rate limits.** `chat`: 20 / 10 s. `enqueue`: 30 / min. `ai-prompt`: 5 / min. All Redis INCR + EXPIRE.
- **Hard payload caps.** 100 KB per socket message, 1000 chars per chat text, 8 topics max per enqueue.
- **Single-tab enforcement.** New socket for an existing user disconnects the old one — no duplicate queue entries, no orphaned sessions.

---

## Socket protocol

Single source of truth: `packages/shared/src/index.ts` (`ClientEvent`, `ServerEvent`).

**Client → server**

| Event | Payload | Purpose |
| --- | --- | --- |
| `queue:enqueue` | `{ intent, mode, topics[], groupSize }` | Join the matchmaking queue. |
| `queue:cancel` | – | Leave the queue. |
| `rtc:offer` | `{ to, sdp }` | Forward an SDP offer to a peer. |
| `rtc:answer` | `{ to, sdp }` | Forward an SDP answer. |
| `rtc:ice` | `{ to, candidate }` | Trickle an ICE candidate. |
| `chat:msg` | `{ text }` | Send a chat message (auto-moderated). |
| `ai:request-prompt` | – | Ask the co-host for a prompt now. |
| `session:leave` | – | Leave the current session. |
| `session:rate` | `{ ratings: [{ userId, score }] }` | Rate the people you just talked to. |
| `session:report` | `{ reportedUserId, reason }` | Report someone. |

**Server → client**

| Event | Payload | Purpose |
| --- | --- | --- |
| `queue:status` | `{ position, waitMs }` | Live queue position. |
| `match:found` | `MatchFoundEvent` | A match has been formed. Includes `initiateTo` for glare-free WebRTC setup. |
| `peer:joined` / `peer:left` | `{ userId, … }` | Peer membership changes. |
| `rtc:offer` / `rtc:answer` / `rtc:ice` | `{ from, … }` | Relayed signalling. |
| `chat:msg` | `IncomingChatMessage` | New chat (re-emitted with `flagged: true` if moderation hits). |
| `ai:icebreaker` | `{ text, ts }` | One-shot opener after match. |
| `ai:prompt` | `{ text, ts, reason }` | Co-host prompt (stall or user-requested). |
| `session:end` | `{ sessionId, durationMs, summary? }` | Last peer left → session closed, optional AI summary. |

---

## Production deployment

### One-command preflight

```bash
pnpm install
pnpm build              # builds shared types, web, and realtime
pnpm db:migrate:deploy  # apply migrations against your prod DATABASE_URL
```

### Recommended topology

| Piece | Where | Notes |
| --- | --- | --- |
| Web (Next.js) | **Vercel** | Set `NEXT_PUBLIC_REALTIME_URL` to your realtime URL and `NEXT_PUBLIC_ICE_SERVERS` to a TURN-augmented array. |
| Realtime (Node + Socket.io) | **Fly.io** or **Railway** | Long-running process, websockets enabled. Set every backend env var. Two replicas is fine — the matchmaker holds a Redis lock during ticks. |
| Postgres | **Neon**, **Supabase**, **Railway** | Apply migrations with `pnpm db:migrate:deploy`. |
| Redis | **Upstash**, **Railway**, **Fly Redis** | Persistence on; the queue is volatile but session metadata isn't. |
| TURN | **Twilio Network Traversal Service** or self-hosted **coturn** | Required for users behind symmetric NATs. |

### Fly.io for the realtime server

`fly.toml`:

```toml
app = "groupspeak-realtime"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 4000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 4000

  [[services.ports]]
    port = 80
    handlers = ["http"]
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

`apps/realtime/Dockerfile`:

```Dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# Install deps for the whole monorepo (cached layer)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

# Source
COPY . .
RUN pnpm --filter @groupspeak/db generate
RUN pnpm --filter @groupspeak/realtime build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/realtime/dist/index.js"]
```

Then:

```bash
fly launch --no-deploy
fly secrets set JWT_SECRET=$(openssl rand -hex 32) \
  DATABASE_URL=... REDIS_URL=... ANTHROPIC_API_KEY=... \
  CORS_ORIGIN=https://your-vercel-domain.vercel.app
fly deploy
```

### Vercel for the web app

```bash
cd apps/web
vercel link
vercel env add NEXT_PUBLIC_REALTIME_URL    # https://groupspeak-realtime.fly.dev
vercel env add NEXT_PUBLIC_ICE_SERVERS     # JSON array with TURN
vercel --prod
```

---

## Scaling notes

- **Realtime is horizontally scalable.** The matchmaker tick is guarded by a Redis lock so any number of replicas is safe. To make peer-to-peer signalling work across replicas, attach a Socket.io Redis adapter:
  ```ts
  import { createAdapter } from "@socket.io/redis-adapter";
  io.adapter(createAdapter(redisPub, redisSub));
  ```
  (Stub already exists in `redis.ts` — `redisPub` / `redisSub`.)
- **Backpressure on the matchmaker.** If a bucket grows huge, the O(n²) pairwise score becomes the bottleneck. Switch to a Hopcroft–Karp or Blossom max-weight matching, or shard buckets by topic prefix.
- **Stateless web tier.** The Next.js app holds zero server state. Everything routes through the realtime server.
- **Postgres hot path.** Most reads/writes are tiny (a session create, a participant update on leave, a rating row). The only N+1 risk is reputation recompute — already a single query for `Rating` and one for `SessionParticipant`. If you scale to millions of users, denormalise `vibeScore` updates into a daily batch.

---

## Bonus features and where to wire them

- **Anonymous mode toggle** — already done. New users start with `isAnonymous = true`. Add an OAuth flow to flip it.
- **"Stay with this group"** — at session end, emit a `session:stay` from each participant; if all agree within 10 s, skip the matchmaker and create a fresh `Session` with the same participant set. Three lines in `socket.ts`.
- **Friend/follow** — add a `Follow` model `{ followerId, followeeId, createdAt }` and a "follow" button on the rate dialog. Boost the matchmaking score for mutual follows.
- **Conversation history summaries** — already produced and stored in `Session.summary`. Build a `/history` page that lists past sessions a user participated in.
- **Topic-based rooms** — sticky persistent rooms per topic. Add a `Room` model with `Session` rows pointing at it; reuse the same WebRTC + chat code, skip the matchmaker.

---

## Scripts cheatsheet

```bash
pnpm dev             # web + realtime + prisma studio, all together
pnpm dev:web         # just the web app
pnpm dev:realtime    # just the realtime server
pnpm db:migrate      # create or update the schema
pnpm db:generate     # regenerate Prisma client (after schema changes)
pnpm db:seed         # add some test users
pnpm build           # build everything
```

Ship it.
