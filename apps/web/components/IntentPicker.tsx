"use client";

import { INTENTS, INTENT_LABELS, MODES, GROUP_SIZES } from "@groupspeak/shared";
import { useSession } from "@/lib/store";

export function IntentPicker() {
  const intent = useSession((s) => s.intent);
  const setIntent = useSession((s) => s.setIntent);
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-ink-200">Intent</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {INTENTS.map((i) => (
          <button
            key={i}
            onClick={() => setIntent(i)}
            className={
              "rounded-lg border px-3 py-2.5 text-sm transition " +
              (intent === i
                ? "border-accent bg-accent/15 text-white"
                : "border-ink-700 bg-ink-800/40 text-ink-200 hover:border-ink-500")
            }
            type="button"
          >
            {INTENT_LABELS[i]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModePicker() {
  const mode = useSession((s) => s.mode);
  const setMode = useSession((s) => s.setMode);
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-ink-200">Mode</h3>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              "rounded-lg border px-3 py-2.5 text-sm capitalize transition " +
              (mode === m
                ? "border-accent bg-accent/15 text-white"
                : "border-ink-700 bg-ink-800/40 text-ink-200 hover:border-ink-500")
            }
            type="button"
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GroupSizePicker() {
  const groupSize = useSession((s) => s.groupSize);
  const setGroupSize = useSession((s) => s.setGroupSize);
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-ink-200">Group size</h3>
      <div className="grid grid-cols-4 gap-2">
        {GROUP_SIZES.map((n) => (
          <button
            key={n}
            onClick={() => setGroupSize(n)}
            className={
              "rounded-lg border px-3 py-2.5 text-sm transition " +
              (groupSize === n
                ? "border-accent bg-accent/15 text-white"
                : "border-ink-700 bg-ink-800/40 text-ink-200 hover:border-ink-500")
            }
            type="button"
          >
            {n === 2 ? "1-on-1" : `${n} people`}
          </button>
        ))}
      </div>
    </div>
  );
}
