"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/store";

export function ChatPanel({
  onSend,
  onAskAI,
  participants,
}: {
  onSend: (text: string) => void;
  onAskAI: () => void;
  participants: Array<{ userId: string; displayName: string }>;
}) {
  const chat = useSession((s) => s.chat);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  const nameFor = (userId: string) =>
    participants.find((p) => p.userId === userId)?.displayName ?? userId.slice(0, 6);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-ink-700/60 bg-ink-800/40">
      <div className="border-b border-ink-700/60 px-4 py-3 text-sm font-medium">Chat</div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {chat.length === 0 && (
          <div className="text-ink-500">Conversation will appear here.</div>
        )}
        {chat.map((c, i) => {
          if (c.kind === "ai-icebreaker" || c.kind === "ai-prompt") {
            return (
              <div
                key={i}
                className="animate-fade-in rounded-xl border border-accent/40 bg-accent/10 p-3"
              >
                <div className="mb-1 text-xs font-medium text-accent-glow">
                  {c.kind === "ai-icebreaker" ? "Icebreaker" : "AI co-host"}
                </div>
                <div>{c.text}</div>
              </div>
            );
          }
          if (c.kind === "system") {
            return (
              <div key={i} className="text-xs italic text-ink-500">
                {c.text}
              </div>
            );
          }
          return (
            <div key={i} className="animate-fade-in">
              <div className="mb-0.5 text-xs text-ink-400">{nameFor(c.fromUserId)}</div>
              <div
                className={
                  "rounded-xl px-3 py-2 " +
                  (c.flagged
                    ? "border border-red-500/50 bg-red-500/10 text-red-100"
                    : "bg-ink-700/60")
                }
              >
                {c.text}
                {c.flagged && (
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-red-300">
                    flagged by moderation
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-ink-700/60 p-3">
        <div className="mb-2 flex items-center justify-end">
          <button
            onClick={onAskAI}
            className="text-xs text-ink-400 hover:text-ink-100"
            type="button"
            title="Ask the AI co-host for a prompt"
          >
            ✨ Ask co-host
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Say something…"
            className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-accent"
            maxLength={1000}
          />
          <button onClick={submit} className="btn-primary" type="button">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
