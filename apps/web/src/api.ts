import type {
  Snapshot,
  SocketMessage,
} from "../../../packages/shared/src/index.ts";
export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      value.error ?? "Chưa kết nối được máy chủ. Vui lòng thử lại.",
    );
  return value;
}
export class TempleClient {
  state?: Snapshot;
  connected = false;
  private listeners = new Set<() => void>();
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private closed = false;
  private attempt = 0;
  constructor(private admin = false) {
    this.connect();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private notify() {
    for (const listener of this.listeners) listener();
  }
  private connect() {
    this.socket = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws${this.admin ? "?role=admin" : ""}`,
    );
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as SocketMessage;
      if (message.type === "snapshot") {
        this.state = message.state;
        this.connected = true;
        this.attempt = 0;
        this.notify();
      }
    };
    this.socket.onclose = () => {
      this.connected = false;
      this.notify();
      if (!this.closed)
        this.retry = setTimeout(
          () => this.connect(),
          Math.min(10000, 500 * 2 ** this.attempt++),
        );
    };
    this.socket.onerror = () => this.socket?.close();
  }
  destroy() {
    this.closed = true;
    clearTimeout(this.retry);
    this.socket?.close();
    this.listeners.clear();
  }
}
