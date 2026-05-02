"use client";

import { useEffect, useRef } from "react";

export function VideoTile({
  stream,
  label,
  vibeScore,
  muted,
  isLocal,
  audioOnly,
}: {
  stream: MediaStream | null;
  label: string;
  vibeScore?: number;
  muted?: boolean;
  isLocal?: boolean;
  audioOnly?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900 shadow-lg">
      {!audioOnly && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted ?? isLocal}
          className={"h-full w-full object-cover " + (isLocal ? "scale-x-[-1]" : "")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-800 to-ink-900">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink-700 text-2xl font-semibold uppercase text-ink-200">
            {label.slice(0, 2)}
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-ink-950/90 to-transparent p-3 text-sm">
        <span className="font-medium">
          {label} {isLocal && <span className="text-ink-400">(you)</span>}
        </span>
        {typeof vibeScore === "number" && (
          <span className="rounded-full bg-ink-900/80 px-2 py-0.5 text-xs text-ink-300">
            Vibe {Math.round(vibeScore)}
          </span>
        )}
      </div>
    </div>
  );
}
