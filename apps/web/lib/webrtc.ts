"use client";

import { ClientEvent, ServerEvent } from "@groupspeak/shared";
import type { Socket } from "socket.io-client";

function getIceServers(): RTCIceServer[] {
  try {
    const raw = process.env.NEXT_PUBLIC_ICE_SERVERS;
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [{ urls: ["stun:stun.l.google.com:19302"] }];
}

export interface PeerHandlers {
  onTrack: (peerId: string, stream: MediaStream) => void;
  onPeerClose: (peerId: string) => void;
  onConnState?: (peerId: string, state: RTCPeerConnectionState) => void;
}

/**
 * Mesh manager: every local peer maintains a separate RTCPeerConnection
 * to every other peer in the room. Works well up to ~5 participants.
 *
 * Glare avoidance: server gives us `initiateTo` — only those peers we
 * actively offer to. Other peers will offer to us first.
 */
export class PeerMesh {
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private socket: Socket;
  private handlers: PeerHandlers;
  private mode: "video" | "audio" | "text";
  private dataChannels = new Map<string, RTCDataChannel>();

  constructor(socket: Socket, mode: "video" | "audio" | "text", handlers: PeerHandlers) {
    this.socket = socket;
    this.mode = mode;
    this.handlers = handlers;

    socket.on(ServerEvent.Offer, (msg: any) => this.handleOffer(msg));
    socket.on(ServerEvent.Answer, (msg: any) => this.handleAnswer(msg));
    socket.on(ServerEvent.Ice, (msg: any) => this.handleIce(msg));
  }

  async start(localStream: MediaStream | null) {
    this.localStream = localStream;
  }

  async addPeer(peerId: string, initiate: boolean) {
    if (this.peers.has(peerId)) return;
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    this.peers.set(peerId, pc);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit(ClientEvent.Ice, { to: peerId, candidate: e.candidate.toJSON() });
      }
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (stream) this.handlers.onTrack(peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      this.handlers.onConnState?.(peerId, pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.removePeer(peerId);
      }
    };

    // Always create an out-of-band data channel for chat fallback / metadata.
    if (initiate) {
      const dc = pc.createDataChannel("gs", { ordered: true });
      this.bindDataChannel(peerId, dc);
    } else {
      pc.ondatachannel = (e) => this.bindDataChannel(peerId, e.channel);
    }

    // Add local tracks if we have media (video / audio modes).
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    if (initiate) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: this.mode !== "text",
        offerToReceiveVideo: this.mode === "video",
      });
      await pc.setLocalDescription(offer);
      this.socket.emit(ClientEvent.Offer, { to: peerId, sdp: offer });
    }
  }

  removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc) return;
    pc.close();
    this.peers.delete(peerId);
    this.dataChannels.delete(peerId);
    this.handlers.onPeerClose(peerId);
  }

  closeAll() {
    for (const peerId of [...this.peers.keys()]) this.removePeer(peerId);
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
  }

  // ── Mute / camera toggles ──────────────────────────────────────
  setAudioEnabled(on: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on));
  }
  setVideoEnabled(on: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on));
  }

  // ── Signalling handlers ────────────────────────────────────────
  private async handleOffer(msg: { from: string; sdp: RTCSessionDescriptionInit }) {
    let pc = this.peers.get(msg.from);
    if (!pc) {
      // Peer offered to us before we added them; create as non-initiator.
      await this.addPeer(msg.from, false);
      pc = this.peers.get(msg.from)!;
    }
    await pc.setRemoteDescription(msg.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.socket.emit(ClientEvent.Answer, { to: msg.from, sdp: answer });
  }

  private async handleAnswer(msg: { from: string; sdp: RTCSessionDescriptionInit }) {
    const pc = this.peers.get(msg.from);
    if (!pc) return;
    if (pc.signalingState === "stable") return;
    await pc.setRemoteDescription(msg.sdp);
  }

  private async handleIce(msg: { from: string; candidate: RTCIceCandidateInit }) {
    const pc = this.peers.get(msg.from);
    if (!pc) return;
    try {
      await pc.addIceCandidate(msg.candidate);
    } catch {
      /* candidate may be null/invalid; ignore */
    }
  }

  private bindDataChannel(peerId: string, dc: RTCDataChannel) {
    this.dataChannels.set(peerId, dc);
    // Could be wired up to send presence pings / fallback chat.
  }
}

// ─── Local media helpers ───────────────────────────────────────────

export async function getLocalMedia(mode: "video" | "audio" | "text"): Promise<MediaStream | null> {
  if (mode === "text") return null;
  const constraints: MediaStreamConstraints = {
    audio: { echoCancellation: true, noiseSuppression: true },
    video:
      mode === "video"
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
        : false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}
