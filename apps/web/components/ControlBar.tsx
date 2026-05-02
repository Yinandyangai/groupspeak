"use client";

import { useState } from "react";

export function ControlBar({
  mode,
  onToggleAudio,
  onToggleVideo,
  onSkip,
  onLeave,
  onReport,
}: {
  mode: "video" | "audio" | "text";
  onToggleAudio: (on: boolean) => void;
  onToggleVideo: (on: boolean) => void;
  onSkip: () => void;
  onLeave: () => void;
  onReport: () => void;
}) {
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(mode === "video");

  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-ink-700/60 bg-ink-800/60 px-4 py-3 backdrop-blur-md">
      {mode !== "text" && (
        <button
          type="button"
          onClick={() => {
            const v = !audioOn;
            setAudioOn(v);
            onToggleAudio(v);
          }}
          className={
            "btn-secondary " + (audioOn ? "" : "border-red-500/50 bg-red-500/10 text-red-200")
          }
        >
          {audioOn ? "Mute" : "Unmute"}
        </button>
      )}
      {mode === "video" && (
        <button
          type="button"
          onClick={() => {
            const v = !videoOn;
            setVideoOn(v);
            onToggleVideo(v);
          }}
          className={
            "btn-secondary " + (videoOn ? "" : "border-red-500/50 bg-red-500/10 text-red-200")
          }
        >
          {videoOn ? "Camera off" : "Camera on"}
        </button>
      )}
      <div className="mx-2 h-6 w-px bg-ink-700" />
      <button onClick={onSkip} className="btn-secondary">
        Skip
      </button>
      <button onClick={onReport} className="btn-secondary text-red-300">
        Report
      </button>
      <button
        onClick={onLeave}
        className="btn px-4 py-2 bg-red-500 text-white hover:bg-red-400"
      >
        Leave
      </button>
    </div>
  );
}
