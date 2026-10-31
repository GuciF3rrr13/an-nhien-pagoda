import { useEffect, useState } from "react";
import { TempleClient } from "./api";
import type {
  AdminSnapshot,
  Snapshot,
} from "../../../packages/shared/src/index.ts";
export function useTemple(admin = false) {
  const [client] = useState(() => new TempleClient(admin));
  const [state, setState] = useState<Snapshot | AdminSnapshot>();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const update = () => {
      setState(client.state);
      setConnected(client.connected);
    };
    const unsubscribe = client.subscribe(update);
    update();
    return () => {
      unsubscribe();
      client.destroy();
    };
  }, [client]);
  return { client, state, connected };
}
