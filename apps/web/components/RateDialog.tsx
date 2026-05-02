"use client";

import { useState } from "react";

export function RateDialog({
  participants,
  onSubmit,
  onSkip,
  summary,
}: {
  participants: Array<{ userId: string; displayName: string }>;
  onSubmit: (ratings: Array<{ userId: string; score: 1 | 2 | 3 | 4 | 5 }>) => void;
  onSkip: () => void;
  summary?: string | null;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6 animate-fade-in">
        <h2 className="text-lg font-semibold">How was that?</h2>
        <p className="mt-1 text-sm text-ink-400">
          Your ratings shape who you meet next.
        </p>

        {summary && (
          <div className="mt-4 rounded-xl border border-ink-700/60 bg-ink-800/40 p-3 text-sm text-ink-300">
            <div className="mb-1 text-xs uppercase tracking-wider text-ink-500">Summary</div>
            {summary}
          </div>
        )}

        <div className="mt-5 space-y-4">
          {participants.map((p) => (
            <div key={p.userId} className="flex items-center justify-between">
              <span className="text-sm">{p.displayName}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScores((s) => ({ ...s, [p.userId]: n }))}
                    className={
                      "h-9 w-9 rounded-md border text-sm " +
                      (scores[p.userId] === n
                        ? "border-accent bg-accent text-white"
                        : "border-ink-700 bg-ink-800/40 text-ink-300 hover:border-ink-500")
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onSkip} className="btn-secondary flex-1">
            Skip
          </button>
          <button
            onClick={() =>
              onSubmit(
                Object.entries(scores).map(([userId, score]) => ({
                  userId,
                  score: score as 1 | 2 | 3 | 4 | 5,
                })),
              )
            }
            disabled={Object.keys(scores).length === 0}
            className="btn-primary flex-1"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
