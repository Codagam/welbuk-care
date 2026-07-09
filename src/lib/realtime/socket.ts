import { io, type Socket } from "socket.io-client";

import { config } from "@/lib/config";
import { fetchWsToken } from "@/lib/api/endpoints/auth";

/**
 * Connect to ws.welbuk.com for a facility. Mirrors the Practice handshake:
 * the short-lived WS JWT (facility-scoped) is supplied via the `auth` callback,
 * and the server joins the `facility:<id>` room from the token claims. Events
 * arrive as named socket events (WelbukEventType); we forward them via onEvent.
 */
export function createRealtime(
  facilityId: string,
  onEvent: (event: string, payload: Record<string, unknown> | undefined) => void
): Socket {
  let token = "";

  const socket = io(config.wsUrl, {
    autoConnect: false,
    auth: (cb: (data: { token: string }) => void) => cb({ token }),
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  socket.onAny((event: string, payload?: Record<string, unknown>) => {
    onEvent(event, payload);
  });

  socket.on("connect_error", async (err: Error) => {
    const msg = err?.message ?? "";
    if (msg.includes("AUTH_TOKEN_EXPIRED") || msg.includes("AUTH_MISSING_TOKEN")) {
      try {
        token = await fetchWsToken(facilityId);
        if (!socket.connected) socket.connect();
      } catch {
        // session likely expired; the 401 path in the API client handles re-login
      }
    }
  });

  (async () => {
    try {
      token = await fetchWsToken(facilityId);
      socket.connect();
    } catch {
      // no token yet — connect_error will retry
    }
  })();

  return socket;
}
