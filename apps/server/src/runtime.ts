import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const APP_DIR = "ChuaAnNhien";

// Per-user data folder for the packaged app (database, optional .env).
export function appDataDir(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.TEMPLE_HOME) return env.TEMPLE_HOME;
  if (platform === "darwin")
    return join(homedir(), "Library", "Application Support", APP_DIR);
  if (platform === "win32")
    return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), APP_DIR);
  return join(env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), APP_DIR);
}

export function openBrowser(url: string) {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // The URL is printed, so a missing opener is not fatal.
  }
}
