import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GroupSpeak — Real conversations with strangers, picked for you.",
  description:
    "Intent-driven, AI-amplified, moderated conversations. Pick a topic, pick a mood, get matched in seconds.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050614",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
