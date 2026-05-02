// Fallback HTTP path for reporting.
// The canonical path is the Socket.io `session:report` event handled in
// apps/realtime/src/socket.ts.

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return new Response(
    JSON.stringify({
      ok: false,
      sessionId: params.id,
      message: "Use the Socket.io session:report event from the connected client.",
    }),
    { status: 501, headers: { "Content-Type": "application/json" } },
  );
}
