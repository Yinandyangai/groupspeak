import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";
import type { Intent, Mode, Topic } from "@groupspeak/shared";

// ─── Client (lazy so the server still boots without a key) ─────────

let _client: Anthropic | null = null;
function client(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-...")) {
    logger.warn("ANTHROPIC_API_KEY not set — AI features disabled");
    return null;
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

// ─── Prompts (the exact text sent to the model) ────────────────────

export const PROMPTS = {
  /**
   * ICEBREAKER — fired the moment a session opens.
   * Goal: a single, specific, non-cringe opener participants can react to
   * within 5 seconds.
   */
  icebreaker: (args: { topics: Topic[]; intent: Intent; participants: string[] }) => ({
    system: [
      "You are GroupSpeak's icebreaker generator.",
      "You write ONE opener for a real-time video chat that strangers can react to within 5 seconds.",
      "Rules:",
      "- Maximum 22 words. No preamble. No emojis. No quotes.",
      "- Be specific to the topics. Avoid generic small talk ('how's your day').",
      "- Match the INTENT vibe: deep=reflective question, casual=light/funny prompt,",
      "  debate=spicy take, vent=permission to be honest, networking=curiosity hook.",
      "- Address the group as 'you all' if more than 2 participants.",
      "- Output the opener ONLY. No labels.",
    ].join("\n"),
    user:
      `Topics: ${args.topics.join(", ") || "(none chosen)"}\n` +
      `Intent: ${args.intent}\n` +
      `Participants: ${args.participants.join(", ")}\n` +
      "Write the opener.",
  }),

  /**
   * STALL PROMPT — injected if the room has been silent / low-activity.
   * Reason is logged so the UI can show why it appeared.
   */
  stallPrompt: (args: { topics: Topic[]; intent: Intent; lastMessages: string[] }) => ({
    system: [
      "You are GroupSpeak's AI co-host. The conversation has stalled.",
      "Output ONE short prompt (max 18 words) that revives it.",
      "- Reference what was just said when possible.",
      "- Keep the original intent's tone.",
      "- Do NOT moralise. Do NOT summarise. Do NOT ask multiple questions.",
      "- Output the prompt ONLY. No labels.",
    ].join("\n"),
    user:
      `Topics: ${args.topics.join(", ")}\n` +
      `Intent: ${args.intent}\n` +
      `Last messages (newest last):\n${args.lastMessages.join("\n") || "(silence)"}\n` +
      "Write the prompt.",
  }),

  /**
   * TOXICITY MODERATION — runs over chat messages.
   * Returns strict JSON.
   */
  moderation: (text: string) => ({
    system: [
      "You are GroupSpeak's moderation classifier.",
      "Classify the message and respond with JSON ONLY, no prose, no markdown:",
      '{ "flag": boolean, "score": number, "categories": string[], "reason": string }',
      "- score: 0.0 (safe) to 1.0 (severe).",
      "- flag: true if score >= 0.5 OR contains threats, hate speech, sexual content involving minors,",
      "  doxxing, or explicit calls to violence.",
      "- categories: subset of ['hate','harassment','sexual','self_harm','violence','spam','minor_safety'].",
      "- reason: <= 12 words explaining the flag, empty string if not flagged.",
      "Respond with the JSON object only.",
    ].join("\n"),
    user: text,
  }),

  /**
   * SUMMARY — post-session. Generated only if session > 60s.
   */
  summary: (args: { topics: Topic[]; intent: Intent; transcript: string }) => ({
    system: [
      "You are GroupSpeak's session summariser.",
      "Write a 2-3 sentence neutral recap of what was actually discussed and any open threads.",
      "- Do not invent details not present in the transcript.",
      "- Do not name participants.",
      "- No markdown, no bullet points. Plain sentences.",
    ].join("\n"),
    user:
      `Topics: ${args.topics.join(", ")}\n` +
      `Intent: ${args.intent}\n` +
      `Transcript:\n${args.transcript}\n` +
      "Write the recap.",
  }),
};

// ─── Public API ────────────────────────────────────────────────────

async function callText(
  prompt: { system: string; user: string },
  maxTokens: number,
): Promise<string | null> {
  const c = client();
  if (!c) return null;
  try {
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : null;
  } catch (err) {
    logger.error({ err }, "anthropic call failed");
    return null;
  }
}

export async function generateIcebreaker(args: {
  topics: Topic[];
  intent: Intent;
  participants: string[];
}): Promise<string | null> {
  const fallback = pickFallbackIcebreaker(args.intent, args.topics);
  const text = await callText(PROMPTS.icebreaker(args), 100);
  return text ?? fallback;
}

export async function generateStallPrompt(args: {
  topics: Topic[];
  intent: Intent;
  lastMessages: string[];
}): Promise<string | null> {
  return callText(PROMPTS.stallPrompt(args), 80);
}

export interface ModerationResult {
  flag: boolean;
  score: number;
  categories: string[];
  reason: string;
}

export async function moderate(text: string): Promise<ModerationResult> {
  const c = client();
  if (!c) return { flag: false, score: 0, categories: [], reason: "" };

  // Cheap pre-filter: regex catches obvious cases without an API hop.
  const lower = text.toLowerCase();
  const hardBlock = /\b(kill yourself|kys|n[i1]gg[3e]r|fag(got)?)\b/i.test(lower);
  if (hardBlock) {
    return { flag: true, score: 1, categories: ["hate", "harassment"], reason: "slur or self-harm directive" };
  }

  const raw = await callText(PROMPTS.moderation(text), 200);
  if (!raw) return { flag: false, score: 0, categories: [], reason: "" };
  try {
    // Strip code fences if model added any.
    const json = raw.replace(/^```json\s*/i, "").replace(/```$/g, "").trim();
    const parsed = JSON.parse(json);
    return {
      flag: !!parsed.flag,
      score: Number(parsed.score) || 0,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch (err) {
    logger.warn({ err, raw }, "moderation parse failed");
    return { flag: false, score: 0, categories: [], reason: "" };
  }
}

export async function summarise(args: {
  topics: Topic[];
  intent: Intent;
  transcript: string;
}): Promise<string | null> {
  if (!args.transcript.trim()) return null;
  return callText(PROMPTS.summary(args), 200);
}

// ─── Fallbacks (used when ANTHROPIC_API_KEY missing or call fails) ─

const FALLBACKS: Record<Intent, string[]> = {
  deep: [
    "What's a belief you held five years ago that you'd argue against now?",
    "Name a moment that quietly changed how you see yourself.",
  ],
  casual: [
    "First: what's the most recent thing that made you laugh out loud?",
    "What's a small thing in your life right now that's weirdly delightful?",
  ],
  debate: [
    "Hot take time — drop the most defensible unpopular opinion you've got.",
    "What's something most people get wrong, in your view?",
  ],
  vent: [
    "Vent freely — what's been sitting on your chest this week?",
    "No fixing, no advice — just say what you'd never say at work.",
  ],
  networking: [
    "What are you building or chasing right now, in one sentence?",
    "Who would be the most useful person you could meet today, and why?",
  ],
};

function pickFallbackIcebreaker(intent: Intent, topics: Topic[]): string {
  const pool = FALLBACKS[intent] ?? FALLBACKS.casual;
  const base = pool[Math.floor(Math.random() * pool.length)];
  if (topics.length > 0) return `${base} (we're here for ${topics.slice(0, 2).join(" + ")})`;
  return base;
}
