"use client";

import { io, type Socket } from "socket.io-client";
import { ensureAuth } from "./api";

let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

const REALTIME =
  process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const auth = await ensureAuth();
    socket = io(REALTIME, {
      auth: { token: auth.token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 4000,
    });
    await new Promise<void>((resolve, reject) => {
      const onErr = (e: Error) => {
        socket?.off("connect", onOk);
        reject(e);
      };
      const onOk = () => {
        socket?.off("connect_error", onErr);
        resolve();
      };
      socket!.once("connect", onOk);
      socket!.once("connect_error", onErr);
    });
    connecting = null;
    return socket!;
  })();

  return connecting;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  connecting = null;
}
