"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientEvent, ServerEvent, type MatchFoundEvent } from "@groupspeak/shared";
import { getSocket } from "@/lib/socket";
import { useSession } from "@/lib/store";

export default function QueuePage() {
  const router = useRouter();
  const sel = useSession();
  const setMatch = useSession((s) => s.setMatch);
  const [position, setPosition] = useState<number | null>(null);
  const [waitMs, setWaitMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (sel.topics.length === 0) {
      router.replace("/start");
      return;
    }

    let cancelled = false;
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;
    let interval: NodeJS.Timeout | null = null;

    (async () => {
      try {
        socket = await getSocket();
        if (cancelled) return;

        socket.on(ServerEvent.QueueStatus, (s: { position: number }) => {
          setPosition(s.position);
        });

        socket.on(ServerEvent.MatchFound, (m: MatchFoundEvent) => {
          setMatch(m);
          router.push(`/room/${m.sessionId}`);
        });

        socket.on(ServerEvent.Error, (e: any) => setError(String(e?.message ?? e)));

        socket.emit(
          ClientEvent.Enqueue,
          {
            intent: sel.intent,
            mode: sel.mode,
            topics: sel.topics,
            groupSize: sel.groupSize,
          },
          (ack: any) => {
            if (!ack?.ok) setError(ack?.error ?? "queue failed");
            else setPosition(ack.position);
          },
        );

        interval = setInterval(() => setWaitMs(Date.now() - startedAt.current), 200);
      } catch (e: any) {
        setError(e?.message ?? "connection failed");
      }
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (socket) {
        socket.off(ServerEvent.QueueStatus);
        socket.off(ServerEvent.MatchFound);
        socket.off(ServerEvent.Error);
        socket.emit(ClientEvent.Cancel, {});
      }
    };
  }, [router, sel, setMatch]);

  const seconds = Math.floor(waitMs / 1000);

  return (
    <main className="bg-mesh flex min-h-screen items-center justify-center px-6">
      <div className="card w-full max-w-md p-10 text-center">
        <div className="relative mx-auto mb-6 h-24 w-24">
          <div className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-glow text-white shadow-[0_0_50px_rgba(99,102,241,0.6)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 15a4 4 0 0 1-4 4H8l-5 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-semibold">Finding your conversation…</h1>
        <p className="mt-2 text-sm text-ink-400">
          Intent: <span className="text-ink-200">{sel.intent}</span> · Mode:{" "}
          <span className="text-ink-200">{sel.mode}</span> · Group:{" "}
          <span className="text-ink-200">{sel.groupSize}</span>
        </p>
        <div className="mt-1 text-sm text-ink-400">
          Topics:{" "}
          <span className="text-ink-200">
            {sel.topics.length === 0 ? "any" : sel.topics.join(", ")}
          </span>
        </div>

        <div className="mt-8 flex items-center justify-around text-sm">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{seconds}s</div>
            <div className="text-xs text-ink-400">Waiting</div>
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">{position ?? "—"}</div>
            <div className="text-xs text-ink-400">Queue position</div>
          </div>
        </div>

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

        <button
          onClick={() => router.push("/start")}
          className="btn-secondary mt-8 w-full"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}
