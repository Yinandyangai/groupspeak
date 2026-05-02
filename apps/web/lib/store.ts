"use client";

import { create } from "zustand";
import type {
  Intent,
  Mode,
  Topic,
  GroupSize,
  MatchFoundEvent,
  IncomingChatMessage,
} from "@groupspeak/shared";

interface ChatLine {
  fromUserId: string;
  fromName: string;
  text: string;
  ts: number;
  flagged?: boolean;
  kind: "user" | "ai-icebreaker" | "ai-prompt" | "system";
}

interface SessionStore {
  // selection
  topics: Topic[];
  intent: Intent;
  mode: Mode;
  groupSize: GroupSize;
  setTopics: (t: Topic[]) => void;
  setIntent: (i: Intent) => void;
  setMode: (m: Mode) => void;
  setGroupSize: (n: GroupSize) => void;
  toggleTopic: (t: Topic) => void;

  // matched session
  match: MatchFoundEvent | null;
  setMatch: (m: MatchFoundEvent | null) => void;

  // chat log
  chat: ChatLine[];
  pushChat: (l: ChatLine) => void;
  clearChat: () => void;

  // session summary delivered at end
  endSummary: string | null;
  setEndSummary: (s: string | null) => void;
}

export const useSession = create<SessionStore>((set, get) => ({
  topics: [],
  intent: "casual",
  mode: "video",
  groupSize: 2,
  setTopics: (t) => set({ topics: t.slice(0, 8) }),
  setIntent: (i) => set({ intent: i }),
  setMode: (m) => set({ mode: m }),
  setGroupSize: (n) => set({ groupSize: n }),
  toggleTopic: (t) => {
    const cur = get().topics;
    if (cur.includes(t)) set({ topics: cur.filter((x) => x !== t) });
    else if (cur.length < 8) set({ topics: [...cur, t] });
  },

  match: null,
  setMatch: (m) => set({ match: m }),

  chat: [],
  pushChat: (l) => set({ chat: [...get().chat, l].slice(-200) }),
  clearChat: () => set({ chat: [] }),

  endSummary: null,
  setEndSummary: (s) => set({ endSummary: s }),
}));

// Cast helper for users who haven't picked anything (selection convenience)
export function emptySelection(s: SessionStore): boolean {
  return s.topics.length === 0;
}
