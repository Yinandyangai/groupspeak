"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TopicPicker } from "@/components/TopicPicker";
import { IntentPicker, ModePicker, GroupSizePicker } from "@/components/IntentPicker";
import { useSession } from "@/lib/store";
import { ensureAuth } from "@/lib/api";

export default function StartPage() {
  const router = useRouter();
  const topics = useSession((s) => s.topics);
  const [authed, setAuthed] = useState(false);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    ensureAuth().then((a) => {
      setAuthed(true);
      setName(a.user.displayName);
    });
  }, []);

  return (
    <main className="bg-mesh min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-accent to-accent-glow" />
          <span className="font-semibold tracking-tight">GroupSpeak</span>
        </Link>
        {authed && <div className="text-xs text-ink-400">You: {name}</div>}
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-32">
        <h1 className="text-3xl font-semibold tracking-tight">What kind of conversation?</h1>
        <p className="mt-2 text-ink-300">Tune the match. We'll do the rest.</p>

        <div className="mt-10 space-y-8">
          <TopicPicker />
          <IntentPicker />
          <ModePicker />
          <GroupSizePicker />
        </div>

        <div className="sticky bottom-6 mt-12">
          <button
            disabled={!authed || topics.length === 0}
            onClick={() => router.push("/queue")}
            className="btn-primary w-full py-3 text-base"
          >
            {topics.length === 0 ? "Pick at least one topic" : "Find someone to talk to"}
          </button>
        </div>
      </section>
    </main>
  );
}
