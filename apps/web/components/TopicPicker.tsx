"use client";

import { TOPICS } from "@groupspeak/shared";
import { useSession } from "@/lib/store";

export function TopicPicker() {
  const topics = useSession((s) => s.topics);
  const toggle = useSession((s) => s.toggleTopic);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink-200">Topics</h3>
        <span className="text-xs text-ink-400">{topics.length}/8 selected</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TOPICS.map((t) => {
          const active = topics.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={"tag " + (active ? "tag-active" : "")}
              type="button"
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
