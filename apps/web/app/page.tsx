"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const [screen, setScreen] = useState<"room" | "idle" | "edit">("room");
  const [chatOpen, setChatOpen] = useState(true);

  const [messages, setMessages] = useState([
    { user: "Stranger", text: "what do you think about AI?" },
  ]);
  const [input, setInput] = useState("");

  const [timeLeft, setTimeLeft] = useState(2700);

  const [profile, setProfile] = useState({
    email: "",
    username: "you",
    interests: ["AI", "Startups", "Philosophy"],
    bio: "thinker, builder",
  });

  // TIMER
  useEffect(() => {
    if (screen !== "room") return;

    const t = setInterval(() => {
      setTimeLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(t);
  }, [screen]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ACTIONS
  const handleNext = () => {
    setMessages([{ user: "System", text: "New connection..." }]);
    setTimeLeft(2700);
    setScreen("room");
  };

  const handleLeave = () => setScreen("idle");

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { user: "You", text: input }]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { user: "Stranger", text: "interesting..." },
      ]);
    }, 800);
  };

  // SAVE PROFILE (REAL DB)
  const saveProfile = async (p: any) => {
    setProfile(p);
    setScreen("idle");

    await supabase.from("profiles").insert([
      {
        username: p.username,
        interests: p.interests,
        bio: p.bio,
      },
    ]);
  };

  return (
    <div className="h-screen w-screen bg-[#0B0B12] flex items-center justify-center text-white">
      <div className="relative w-[1200px] h-[620px] rounded-3xl overflow-hidden bg-[#151522]">

        {/* SCREEN SWITCH */}
        {screen === "room" && (
          <>
            <Room />

            {chatOpen && (
              <ChatBox
                messages={messages}
                input={input}
                setInput={setInput}
                sendMessage={sendMessage}
              />
            )}

            <Controls
              onChat={() => setChatOpen(!chatOpen)}
              onNext={handleNext}
              onLeave={handleLeave}
            />
          </>
        )}

        {screen === "idle" && (
          <Idle profile={profile} onStart={handleNext} onEdit={() => setScreen("edit")} />
        )}

        {screen === "edit" && (
          <Edit profile={profile} onSave={saveProfile} onCancel={() => setScreen("idle")} />
        )}

        {/* HEADER */}
        <Header time={formatTime(timeLeft)} />
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */

function Room() {
  return (
    <div className="w-full h-full flex">
      <Avatar label="You" />
      <div className="flex-1 flex items-center justify-center bg-[#17172A]">
        <Avatar label="Stranger" />
      </div>
    </div>
  );
}

function ChatBox({ messages, input, setInput, sendMessage }: any) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-[420px] h-[300px] bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-2 text-sm">
          {messages.map((m: any, i: number) => (
            <div key={i}>
              <span className="text-white/50">{m.user}: </span>
              {m.text}
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border border-white/10 rounded px-2 py-1"
          />
          <button onClick={sendMessage} className="bg-white text-black px-3 rounded">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function Controls({ onChat, onNext, onLeave }: any) {
  return (
    <div className="absolute bottom-6 w-full flex justify-center gap-4">
      <Btn icon="💬" onClick={onChat} />
      <Btn icon="⏭" onClick={onNext} />
      <Btn icon="📞" onClick={onLeave} danger />
    </div>
  );
}

function Idle({ profile, onStart, onEdit }: any) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-white/5 p-8 rounded-3xl text-center">
        <div>@{profile.username}</div>
        <div className="flex gap-2 justify-center mt-2">
          {profile.interests.map((i: string) => (
            <span key={i}>{i}</span>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onStart}>Start</button>
          <button onClick={onEdit}>Edit</button>
        </div>
      </div>
    </div>
  );
}

function Edit({ profile, onSave, onCancel }: any) {
  const [username, setUsername] = useState(profile.username);
  const [interests, setInterests] = useState(profile.interests.join(", "));

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-white/5 p-6 rounded-3xl">
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <input value={interests} onChange={(e) => setInterests(e.target.value)} />

        <button
          onClick={() =>
            onSave({
              ...profile,
              username,
              interests: interests.split(",").map((i: string) => i.trim()),
            })
          }
        >
          Save
        </button>

        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Avatar({ label }: any) {
  return (
    <div className="flex-1 flex items-center justify-center flex-col">
      <div className="w-[140px] h-[140px] bg-[#2A2A3D] rounded-full" />
      <div className="text-gray-400 mt-2">{label}</div>
    </div>
  );
}

function Btn({ icon, onClick, danger }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-14 h-14 rounded-full ${
        danger ? "bg-red-500" : "bg-white text-black"
      }`}
    >
      {icon}
    </button>
  );
}

function Header({ time }: any) {
  return (
    <>
      <div className="absolute top-3 w-full text-center">Groupspeak</div>
      <div className="absolute top-10 w-full text-center text-sm text-gray-400">
        {time}
      </div>
    </>
  );
}