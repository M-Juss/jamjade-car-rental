import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { apiPost } from "@/services/http";
import { fleetChannelSchema } from "@/validations/fleet/schemas";

export type FleetConnection = "connecting" | "connected" | "offline" | "unconfigured";

export function subscribeFleetChanges(onChange: () => void, onState: (state: FleetConnection) => void) {
  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const host = process.env.NEXT_PUBLIC_REVERB_HOST;
  const secure = process.env.NEXT_PUBLIC_REVERB_SCHEME === "https";
  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT || (secure ? 443 : 8080));
  if (!key || !host || !Number.isInteger(port) || port < 1 || port > 65535
    || (window.location.protocol === "https:" && !secure)) {
    onState("unconfigured");
    return () => {};
  }
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const requests = new Set<AbortController>();
  const pusher = new Pusher(key, {
    cluster: "",
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: secure,
    enabledTransports: ["ws", "wss"],
    disableStats: true,
    channelAuthorization: {
      customHandler: ({ socketId, channelName }, callback) => {
        const parsed = fleetChannelSchema.safeParse({ socket_id: socketId, channel_name: channelName });
        if (!parsed.success) {
          onState("offline");
          callback(new Error("Invalid fleet connection."), null);
          return;
        }
        const controller = new AbortController();
        requests.add(controller);
        apiPost<{ auth: string }>("/admin/broadcasting/auth", parsed.data, { signal: controller.signal })
          .then((response) => { if (!closed) callback(null, response.data); })
          .catch(() => {
            if (!closed) {
              onState("offline");
              callback(new Error("Fleet connection could not be authorized."), null);
            }
          })
          .finally(() => requests.delete(controller));
      },
    },
  });
  const echo = new Echo({ broadcaster: "reverb", client: pusher });
  onState("connecting");
  pusher.connection.bind("state_change", ({ current }: { current: string }) => {
    if (!closed) onState(current === "connected" || current === "connecting" ? "connecting" : "offline");
  });
  function subscribe() {
    echo.private("fleet-monitoring")
      .listen(".fleet.changed", () => { if (!closed) onChange(); })
      .subscribed(() => {
        if (!closed) { clearTimeout(retry); retry = undefined; onState("connected"); onChange(); }
      })
      .error(() => {
        if (closed) return;
        onState("offline");
        if (!retry) retry = setTimeout(() => {
          retry = undefined;
          if (!closed) { echo.leave("fleet-monitoring"); subscribe(); }
        }, 10_000);
      });
  }
  subscribe();

  return () => {
    closed = true;
    clearTimeout(retry);
    requests.forEach((controller) => controller.abort());
    echo.leave("fleet-monitoring");
    pusher.connection.unbind("state_change");
    echo.disconnect();
  };
}
