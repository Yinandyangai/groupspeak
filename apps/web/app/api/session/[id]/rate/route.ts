// Fallback HTTP path for rating.
// The canonical path is the Socket.io `session:rate` event handled in
// apps/realtime/src/socket.ts. Web clients use the socket already.
// This stub exists so external integrations get a clear 501 instead of a 404.

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return new Response(
    JSON.stringify({
      ok: false,
      sessionId: params.id,
      message: "Use the Socket.io session:rate event from the connected client.",
    }),
    { status: 501, headers: { "Content-Type": "application/json" } },
  );
}
