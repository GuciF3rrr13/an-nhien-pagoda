import { useEffect, useRef, useState } from "react";
import { Flower2, Heart, Eye, Users, Volume2, VolumeX } from "lucide-react";
import {
  actionLabels,
  nextMilestone,
  type Snapshot,
} from "../../../packages/shared/src/index.ts";
import { TempleClient } from "./api";
import { mountGame } from "./game";
import { Soundscape } from "./audio";
import { StreamThanks } from "./Leaderboard";

export function TempleView({
  client,
  state,
  preview = false,
  overlay = false,
}: {
  client: TempleClient;
  state?: Snapshot;
  preview?: boolean;
  overlay?: boolean;
}) {
  const parent = useRef<HTMLDivElement>(null),
    sound = useRef<Soundscape | undefined>(undefined);
  const [audio, setAudio] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const game = mountGame(parent.current!, client);
    return () => {
      game.destroy(true);
    };
  }, [client]);
  useEffect(() => {
    if (preview) return;
    sound.current = new Soundscape();
    if (overlay && new URLSearchParams(location.search).get("audio") === "1")
      void sound.current
        .enable()
        .then(() => setAudio(sound.current?.active ?? false))
        .catch(() => {});
    return () => {
      void sound.current?.destroy();
      sound.current = undefined;
    };
  }, [preview, overlay]);
  useEffect(() => {
    if (state) sound.current?.update(state);
  }, [state, audio]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const milestone = nextMilestone(state?.progress ?? 0),
    progress = state?.progress ?? 0,
    latest = state?.ceremonies.at(-1);
  const prayer = state?.prayers.at(-1);
  const announcement = state?.announcements.at(-1);
  const announcementAge =
    announcement && state ? state.serverTime - announcement.at : Infinity;
  const announcementFresh = announcementAge >= 0 && announcementAge <= 20_000;
  const audienceAge =
    state?.audience.updatedAt != null
      ? state.serverTime - state.audience.updatedAt
      : Infinity;
  const audienceFresh =
    !!state &&
    client.connected &&
    state.connector.state === "connected" &&
    audienceAge >= 0 &&
    audienceAge <= 30_000 &&
    state.audience.current !== null;
  const audienceLabel = audienceFresh
    ? `${state!.audience.current!.toLocaleString("vi-VN")} người xem đồng thời`
    : "Đang chờ số người xem";
  const audienceMilestoneFresh =
    latest?.action === "audience-milestone" && state
      ? state.serverTime - latest.at >= 0 &&
        state.serverTime - latest.at <= 12_000
      : false;
  const ceremonyText =
    latest?.action === "audience-milestone"
      ? `${latest.count.toLocaleString("vi-VN")} người cùng hiện diện`
      : latest?.action === "share"
        ? "Cảm ơn đã chia sẻ"
        : latest?.action === "milestone"
          ? "Một cột mốc an lành mới"
          : latest?.action === "like"
            ? "Gửi một chút yêu thương"
            : latest?.action === "follow"
              ? "Vừa ghé thăm chùa"
              : latest?.action === "big-gift"
                ? "Cảm ơn bạn"
                : latest && latest.action in actionLabels
                  ? `${actionLabels[latest.action as keyof typeof actionLabels]}${latest.count > 1 ? ` ×${latest.count}` : ""}`
                  : "";
  const connectionLabel =
    state?.connector.mode === "tiktok"
      ? !client.connected
        ? "Mất kết nối"
        : {
            connected: "TikTok LIVE",
            connecting: "Đang kết nối",
            disconnected: "Mất kết nối",
            error: "Lỗi kết nối",
          }[state.connector.state]
      : "Mô phỏng";
  return (
    <div
      className={`temple-stage ${preview ? "is-preview" : ""} ${overlay ? "is-overlay" : ""}`}
      aria-label="Không gian Chùa An Nhiên"
    >
      <div ref={parent} className="game-canvas" />
      <div className="temple-vignette" />
      <div className="temple-top">
        <span className="temple-mark">
          <Flower2 size={20} /> AN NHIÊN
        </span>
        <span className="temple-mode">
          <i />
          {connectionLabel}
        </span>
      </div>
      <div className="temple-heading">
        <h2>Chùa An Nhiên</h2>
        <p>Một niệm an lành, ngàn hoa nở.</p>
      </div>
      <div className="temple-attendance">
        <Users size={14} />
        <span>{state?.visitors.length ?? 0} khách hiện diện</span>
      </div>
      <div className="temple-audience" aria-label="Số người xem đồng thời">
        <Eye size={14} />
        <span data-testid="audience-value">{audienceLabel}</span>
        <small>
          {state?.session.source === "mock" ? "Mô phỏng" : "TikTok LIVE"}
        </small>
      </div>
      {!client.connected && (
        <div className="scene-connection" role="status">
          Đang kết nối lại máy chủ…
        </div>
      )}
      <div className="temple-bottom">
        {notice && (
          <p className="scene-notice" role="status">
            {notice}
          </p>
        )}
        {latest &&
          (!announcementFresh || audienceMilestoneFresh) &&
          !new URLSearchParams(location.search).has("capture") && (
            <div className="offering-note">
              <Flower2 size={22} />
              <div>
                <strong>{latest.name}</strong>
                <span
                  data-testid={
                    audienceMilestoneFresh ? "audience-milestone" : undefined
                  }
                  className={
                    audienceMilestoneFresh
                      ? "audience-milestone-banner"
                      : undefined
                  }
                >
                  {ceremonyText}
                </span>
              </div>
            </div>
          )}
        {announcementFresh &&
          !audienceMilestoneFresh &&
          announcement &&
          !new URLSearchParams(location.search).has("capture") && (
            <div
              className="live-announcement"
              role="status"
              key={announcement.id}
            >
              <Flower2 size={19} />
              <span>{announcement.text}</span>
            </div>
          )}
        {prayer && (
          <div className="public-prayer">
            <Heart size={15} />
            <p>
              “{prayer.text}”<span>{prayer.userName}</span>
            </p>
          </div>
        )}
        <StreamThanks state={state} />
        <p className="stream-comment-guide">
          Bình luận <b>!le</b> · <b>!nhang</b> · <b>!cau &lt;lời nguyện&gt;</b>
          {state?.settings.fortuneEnabled && <> · <b>!que</b></>}
          <span>Hoa sen dành cho quà tặng LIVE.{state?.settings.fortuneEnabled && " · !que rút lá thăm"}</span>
        </p>
        <div className="temple-progress">
          <div>
            <span>Cùng thắp sáng chánh điện</span>
            <strong data-testid="progress-value">
              {progress.toLocaleString("vi-VN")}{" "}
              <small>/ {milestone.toLocaleString("vi-VN")}</small>
            </strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Công đức chung"
            aria-valuemin={0}
            aria-valuemax={milestone}
            aria-valuenow={progress}
          >
            <span
              style={{
                width: `${Math.min(100, (progress / milestone) * 100)}%`,
              }}
            />
          </div>
        </div>
        {!preview && !overlay && (
          <div className="viewer-audio-control">
            <button
              aria-label={audio ? "Tắt âm thanh" : "Bật âm thanh"}
              onClick={async () => {
                if (audio) {
                  await sound.current?.destroy();
                  sound.current = new Soundscape();
                  setAudio(false);
                } else
                  try {
                    await sound.current?.enable();
                    setAudio(sound.current?.active ?? false);
                  } catch {
                    setError(
                      "Trình duyệt chưa cho phép âm thanh. Thử bấm lại.",
                    );
                  }
              }}
            >
              {audio ? <Volume2 /> : <VolumeX />}
            </button>
          </div>
        )}
        {error && (
          <p className="scene-notice" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
