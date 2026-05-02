"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientEvent, ServerEvent, type MatchFoundEvent } from "@groupspeak/shared";
import { getSocket } from "@/lib/socket";
import { getStoredAuth } from "@/lib/api";
import { PeerMesh, getLocalMedia } from "@/lib/webrtc";
import { useSession } from "@/lib/store";
import { VideoTile } from "@/components/VideoTile";
import { ChatPanel } from "@/components/ChatPanel";
import { ControlBar } from "@/components/ControlBar";
import { RateDialog } from "@/components/RateDialog";

interface PeerView {
  userId: string;
  displayName: string;
  vibeScore: number;
  stream: MediaStream | null;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = String(params.id);
  const match = useSession((s) => s.match);
  const pushChat = useSession((s) => s.pushChat);
  const clearChat = useSession((s) => s.clearChat);
  const setEndSummary = useSession((s) => s.setEndSummary);
  const endSummary = useSession((s) => s.endSummary);

  const [peers, setPeers] = useState<Record<string, PeerView>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [showRate, setShowRate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(match?.countdownMs ?? 0);
  const meshRef = useRef<PeerMesh | null>(null);
  const auth = useMemo(() => getStoredAuth(), []);

  // Whether to render media tiles
  const mode = match?.mode ?? "video";

  // ── Setup connection on mount ──────────────────────────────────
  useEffect(() => {
    if (!match || match.sessionId !== sessionId) {
      router.replace("/start");
      return;
    }
    if (!auth) {
      router.replace("/start");
      return;
    }

    let cancelled = false;
    let socket: Awaited<ReturnType<typeof getSocket>>;

    (async () => {
      try {
        socket = await getSocket();
        if (cancelled) return;

        // Initial peer state from match payload
        const initial: Record<string, PeerView> = {};
        for (const p of match.participants) {
          if (p.userId === auth.user.id) continue;
          initial[p.userId] = { ...p, stream: null };
        }
        setPeers(initial);

        // Get local media
        const stream = await getLocalMedia(mode).catch((e) => {
          setError(`Could not access ${mode}: ${e.message}`);
          return null;
        });
        if (cancelled) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);

        // Create mesh
        const mesh = new PeerMesh(socket, mode, {
          onTrack: (peerId, peerStream) =>
            setPeers((cur) => ({
              ...cur,
              [peerId]: { ...cur[peerId], stream: peerStream },
            })),
          onPeerClose: (peerId) =>
            setPeers((cur) => {
              const next = { ...cur };
              delete next[peerId];
              return next;
            }),
        });
        meshRef.current = mesh;
        await mesh.start(stream);

        // Add peers — initiate to those listed in initiateTo
        for (const p of match.participants) {
          if (p.userId === auth.user.id) continue;
          const initiate = match.initiateTo.includes(p.userId);
          await mesh.addPeer(p.userId, initiate);
        }

        // ── Wire socket events ───────────────────────────────
        socket.on(ServerEvent.PeerLeft, (e: { userId: string }) => {
          mesh.removePeer(e.userId);
          pushChat({
            kind: "system",
            fromUserId: "system",
            fromName: "system",
            text: `${initial[e.userId]?.displayName ?? "someone"} left`,
            ts: Date.now(),
          });
        });

        socket.on(ServerEvent.ChatMsg, (msg: any) => {
          pushChat({
            kind: "user",
            fromUserId: msg.fromUserId,
            fromName:
              match.participants.find((p) => p.userId === msg.fromUserId)?.displayName ??
              "anon",
            text: msg.text,
            ts: msg.ts,
            flagged: msg.flagged,
          });
        });

        socket.on(ServerEvent.Icebreaker, (e: { text: string; ts: number }) => {
          pushChat({
            kind: "ai-icebreaker",
            fromUserId: "ai",
            fromName: "ai",
            text: e.text,
            ts: e.ts,
          });
        });

        socket.on(ServerEvent.Prompt, (e: { text: string; ts: number }) => {
          pushChat({
            kind: "ai-prompt",
            fromUserId: "ai",
            fromName: "ai",
            text: e.text,
            ts: e.ts,
          });
        });

        socket.on(ServerEvent.SessionEnd, (e: any) => {
          setEndSummary(e.summary ?? null);
          setShowRate(true);
        });

        // Countdown animation
        const start = Date.now();
        const dur = match.countdownMs;
        const iv = setInterval(() => {
          const left = dur - (Date.now() - start);
          setCountdown(Math.max(0, left));
          if (left <= 0) clearInterval(iv);
        }, 80);
      } catch (e: any) {
        setError(e?.message ?? "connection failed");
      }
    })();

    return () => {
      cancelled = true;
      meshRef.current?.closeAll();
      meshRef.current = null;
      // detach handlers (other socket consumers don't exist here)
      getSocket().then((s) => {
        s.off(ServerEvent.PeerLeft);
        s.off(ServerEvent.ChatMsg);
        s.off(ServerEvent.Icebreaker);
        s.off(ServerEvent.Prompt);
        s.off(ServerEvent.SessionEnd);
      });
      clearChat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Actions ────────────────────────────────────────────────────
  const sendChat = async (text: string) => {
    const s = await getSocket();
    s.emit(ClientEvent.ChatMsg, { text });
  };
  const askAI = async () => {
    const s = await getSocket();
    s.emit(ClientEvent.RequestPrompt, {});
  };
  const leave = async () => {
    const s = await getSocket();
    s.emit(ClientEvent.Leave, {});
    setShowRate(true);
  };
  const skip = async () => {
    await leave();
    router.push("/start");
  };
  const report = async () => {
    const peerIds = Object.keys(peers);
    if (peerIds.length === 0) return;
    const reportedUserId = peerIds[0]; // For 2-person; UX could let user pick in groups.
    const reason = prompt("Reason for report?");
    if (!reason) return;
    const s = await getSocket();
    s.emit(ClientEvent.Report, { reportedUserId, reason });
    alert("Reported. Thanks for keeping GroupSpeak safe.");
  };

  const submitRatings = async (
    ratings: Array<{ userId: string; score: 1 | 2 | 3 | 4 | 5 }>,
  ) => {
    const s = await getSocket();
    s.emit(ClientEvent.Rate, { ratings });
    router.push("/start");
  };

  // ── Layout ─────────────────────────────────────────────────────
  const peerList = Object.values(peers);
  const everyone = [
    ...peerList,
    ...(auth ? [{ userId: auth.user.id, displayName: auth.user.displayName, vibeScore: auth.user.vibeScore, stream: localStream }] : []),
  ];
  const gridCols = everyone.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3";

  return (
    <main className="bg-mesh min-h-screen">
      {countdown > 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/80 backdrop-blur-md">
          <div className="text-center animate-fade-in">
            <div className="text-7xl font-semibold tabular-nums">
              {Math.ceil(countdown / 1000)}
            </div>
            <div className="mt-2 text-ink-300">Connecting…</div>
          </div>
        </div>
      )}

      <div className="mx-auto grid h-screen max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {mode === "text" ? (
            <div className="card flex flex-1 flex-col items-center justify-center p-10 text-center">
              <div className="text-sm uppercase tracking-wider text-ink-400">Text mode</div>
              <h2 className="mt-2 text-lg font-medium">
                {peerList.length} {peerList.length === 1 ? "person" : "people"} in the room
              </h2>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {peerList.map((p) => (
                  <span key={p.userId} className="tag">
                    {p.displayName}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className={"grid flex-1 gap-3 " + gridCols}>
              {everyone.map((p) => (
                <VideoTile
                  key={p.userId}
                  stream={p.stream}
                  label={p.displayName}
                  vibeScore={p.vibeScore}
                  isLocal={p.userId === auth?.user.id}
                  audioOnly={mode === "audio"}
                />
              ))}
            </div>
          )}

          <ControlBar
            mode={mode}
            onToggleAudio={(on) => meshRef.current?.setAudioEnabled(on)}
            onToggleVideo={(on) => meshRef.current?.setVideoEnabled(on)}
            onSkip={skip}
            onLeave={leave}
            onReport={report}
          />
        </div>

        <ChatPanel
          onSend={sendChat}
          onAskAI={askAI}
          participants={[
            ...peerList.map((p) => ({ userId: p.userId, displayName: p.displayName })),
            ...(auth ? [{ userId: auth.user.id, displayName: auth.user.displayName }] : []),
          ]}
        />
      </div>

      {showRate && (
        <RateDialog
          participants={peerList.map((p) => ({ userId: p.userId, displayName: p.displayName }))}
          onSubmit={submitRatings}
          onSkip={() => router.push("/start")}
          summary={endSummary}
        />
      )}
    </main>
  );
}
