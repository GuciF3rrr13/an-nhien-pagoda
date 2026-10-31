import { useEffect, useState } from "react";
import type {
  LeaderboardEntry,
  Snapshot,
} from "../../../packages/shared/src/index.ts";

type BoardKind = "gifts" | "participation";
const titles: Record<BoardKind, string> = {
  gifts: "Quà tặng · điểm",
  participation: "Tham gia · lượt",
};

function LeaderboardRows({ entries }: { entries: LeaderboardEntry[] }) {
  if (!entries.length)
    return <p className="thanks-empty">Chưa có lượt ghi nhận trong phiên.</p>;
  return (
    <ol className="thanks-list">
      {entries.slice(0, 5).map((entry, index) => (
        <li key={entry.userId}>
          <span className="thanks-rank">{index + 1}</span>
          <span className="thanks-name">{entry.userName}</span>
          <strong>{entry.score.toLocaleString("vi-VN")}</strong>
        </li>
      ))}
    </ol>
  );
}

/** Compact stream board; rotates only when motion is permitted. */
export function StreamThanks({ state }: { state?: Snapshot }) {
  const [kind, setKind] = useState<BoardKind>("gifts");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () =>
        setKind((current) => (current === "gifts" ? "participation" : "gifts")),
      12000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const entries =
    kind === "gifts" ? state?.session.gifts : state?.session.participation;
  return (
    <section className="stream-thanks" aria-label="Bảng tri ân">
      <div className="stream-thanks-heading">
        <strong>Bảng tri ân</strong>
        <span>{titles[kind]}</span>
      </div>
      <LeaderboardRows entries={entries ?? []} />
      <small>
        {state?.session.source === "tiktok"
          ? "Phiên TikTok LIVE"
          : "Phiên mô phỏng"}
      </small>
    </section>
  );
}

export function AdminLeaderboards({ state }: { state?: Snapshot }) {
  return (
    <section
      className="panel admin-thanks"
      aria-labelledby="admin-thanks-title"
    >
      <div className="panel-heading">
        <h2 id="admin-thanks-title">Bảng tri ân</h2>
        <span className="tag">
          {state?.session.source === "tiktok" ? "TikTok LIVE" : "Mô phỏng"}
        </span>
      </div>
      <p className="description">
        Phiên bắt đầu{" "}
        {state
          ? new Date(state.session.startedAt).toLocaleString("vi-VN")
          : "—"}
        . Điểm hoa tính theo điểm đóng góp đã cấu hình, không phải tiền hay xu.
      </p>
      <div className="admin-thanks-columns">
        <div>
          <h3>Quà tặng · điểm hoa</h3>
          <LeaderboardRows entries={state?.session.gifts ?? []} />
        </div>
        <div>
          <h3>Tham gia miễn phí · lượt</h3>
          <LeaderboardRows entries={state?.session.participation ?? []} />
        </div>
      </div>
    </section>
  );
}
