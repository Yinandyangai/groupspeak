// ─── Domain enums ──────────────────────────────────────────────────

export const INTENTS = ["deep", "casual", "debate", "vent", "networking"] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  deep: "Deep talk",
  casual: "Casual",
  debate: "Debate",
  vent: "Vent",
  networking: "Networking",
};

export const MODES = ["video", "audio", "text"] as const;
export type Mode = (typeof MODES)[number];

export const TOPICS = [
  "tech", "ai", "startups", "design", "philosophy", "psychology",
  "books", "music", "movies", "gaming", "fitness", "travel",
  "food", "science", "politics", "spirituality", "relationships",
  "career", "money", "art", "writing", "sports", "history", "language",
] as const;
export type Topic = (typeof TOPICS)[number];

export const GROUP_SIZES = [2, 3, 4, 5] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];

// ─── Reputation ────────────────────────────────────────────────────

/** Vibe score is on 0-100 scale. New users start at 70. */
export const DEFAULT_VIBE_SCORE = 70;
export const MIN_VIBE_SCORE = 0;
export const MAX_VIBE_SCORE = 100;
/** Below this threshold users go into the shadow (low-quality) pool. */
export const SHADOW_QUEUE_THRESHOLD = 30;

// ─── Matchmaking config ────────────────────────────────────────────

export const MATCHMAKER_CONFIG = {
  /** how often the worker scans the queue */
  tickIntervalMs: 500,
  /** session TTL on the queue hash (auto-expire stale entries) */
  queueTtlSec: 120,
  /** seconds users can be in queue before threshold relaxes */
  patienceSec: 30,
  /** minimum match score to pair */
  matchThreshold: 40,
  /** relaxed threshold after patience window */
  relaxedThreshold: 0,
  /** weights */
  weights: {
    topicOverlap: 100, // jaccard * weight
    intentMatch: 50, // already enforced by bucketing, kept for transparency
    vibeDelta: 5, // subtracted per |delta| point
    repeatPenalty: 200, // subtracted if matched recently
    waitBoost: 0.5, // added per second of min wait
  },
  /** how long to remember recent matches */
  recentMatchTtlSec: 60 * 30, // 30 minutes
} as const;

// ─── Wire types: Client → Server ───────────────────────────────────

export interface EnqueuePayload {
  intent: Intent;
  mode: Mode;
  topics: Topic[];
  groupSize: GroupSize; // 2 = pair, 3-5 = small group
}

export interface WebRTCOfferPayload {
  to: string; // peer userId
  sdp: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerPayload {
  to: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRTCIcePayload {
  to: string;
  candidate: RTCIceCandidateInit;
}

export interface ChatMessagePayload {
  text: string;
}

export interface RatePayload {
  ratings: Array<{ userId: string; score: 1 | 2 | 3 | 4 | 5 }>;
}

export interface ReportPayload {
  reportedUserId: string;
  reason: string;
}

// ─── Wire types: Server → Client ───────────────────────────────────

export interface QueueStatusEvent {
  position: number;
  waitMs: number;
}

export interface MatchFoundEvent {
  sessionId: string;
  countdownMs: number;
  mode: Mode;
  topics: Topic[];
  intent: Intent;
  participants: Array<{ userId: string; displayName: string; vibeScore: number }>;
  /** Whether the local client should create offers. Lower userId initiates to avoid glare. */
  initiateTo: string[];
}

export interface PeerJoinedEvent {
  userId: string;
  displayName: string;
  vibeScore: number;
}

export interface PeerLeftEvent {
  userId: string;
}

export interface IncomingChatMessage {
  fromUserId: string;
  text: string;
  ts: number;
  flagged?: boolean;
}

export interface AIIcebreakerEvent {
  text: string;
  ts: number;
}

export interface AIPromptEvent {
  text: string;
  ts: number;
  /** Why the prompt was injected (e.g. "stalled", "topic-pivot") */
  reason: string;
}

export interface SessionEndEvent {
  sessionId: string;
  durationMs: number;
  participants: Array<{ userId: string; displayName: string }>;
  summary?: string;
}

// ─── Socket event names (single source of truth) ───────────────────

export const ClientEvent = {
  Enqueue: "queue:enqueue",
  Cancel: "queue:cancel",
  Offer: "rtc:offer",
  Answer: "rtc:answer",
  Ice: "rtc:ice",
  ChatMsg: "chat:msg",
  Leave: "session:leave",
  Rate: "session:rate",
  Report: "session:report",
  RequestPrompt: "ai:request-prompt",
} as const;

export const ServerEvent = {
  QueueStatus: "queue:status",
  MatchFound: "match:found",
  PeerJoined: "peer:joined",
  PeerLeft: "peer:left",
  Offer: "rtc:offer",
  Answer: "rtc:answer",
  Ice: "rtc:ice",
  ChatMsg: "chat:msg",
  Icebreaker: "ai:icebreaker",
  Prompt: "ai:prompt",
  SessionEnd: "session:end",
  Error: "error",
} as const;
