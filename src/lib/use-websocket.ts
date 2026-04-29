"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ServerMessage, ClientMessage } from "@/server/ws/types";
import { useSession } from "@/lib/auth-client";

type UseWebSocketOptions = {
  roomId: string;
  onMessage?: (msg: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

export function useWebSocket({ roomId, onMessage, onConnect, onDisconnect }: UseWebSocketOptions) {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const isConnecting = useRef(false);

  const send = useCallback((msg: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  const disconnect = useCallback(() => {
    isConnecting.current = false;
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }
  }, []);

  useEffect(() => {
    if (!session?.session?.token) return;

    const token = session.session.token;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
    const url = `${wsUrl}?token=${encodeURIComponent(token)}`;

    function connect() {
      if (isConnecting.current && ws.current?.readyState === WebSocket.CONNECTING) return;
      if (ws.current?.readyState === WebSocket.OPEN) return;

      isConnecting.current = true;
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        isConnecting.current = false;
        setIsConnected(true);
        onConnect?.();
      };

      socket.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data as string);
          if (msg.type === "pong") {
            socket.send(JSON.stringify({ type: "join_room", roomId, token }));
            return;
          }
          onMessage?.(msg);
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      socket.onclose = (event) => {
        isConnecting.current = false;
        setIsConnected(false);
        if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
        onDisconnect?.();
        if (event.code !== 4001) {
          reconnectTimeout.current = setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        isConnecting.current = false;
      };
    }

    connect();
    return () => disconnect();
  }, [session?.session?.token, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isConnected, send, disconnect };
}
