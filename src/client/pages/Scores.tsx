import { useScores } from "../features/scores/useScores";
import { ScoreTable } from "../features/scores/ScoreTable";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resolveHomeTheme, themeHref } from "../lib/home-theme";
import type { ScoreItem, ScoreState } from "../../shared/types";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import styles from "./Scores.module.css";

export function ScoresPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  const { state, setState, connected, error, setError } = useScores();
  const auth = useAuth();
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"leaderboard" | "recent">("leaderboard");
  const [deleting, setDeleting] = useState<ScoreItem | "all" | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await api(
        deleting === "all"
          ? "/api/scores"
          : `/api/scores/${encodeURIComponent(deleting.id)}`,
        { method: "DELETE" },
      );
      setState(await api<ScoreState>("/api/scores"));
      setDeleting(null);
      setStatus("成绩已删除。");
    } catch (error) {
      setError(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setBusy(false);
    }
  }
  const entries = state?.[tab] || [];
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>NOTE SHOOTER / LIVE SCORES</p>
          <h1>
            把名字留在榜上<span>。</span>
          </h1>
          <p>音符射手成绩，实时同步。</p>
        </div>
        <Link className={styles.button} to={themeHref("/note-shooter", themeId)}>
          去挑战 ↗
        </Link>
      </header>
      <div className={styles.meta}>
        <span>
          <i className={connected ? styles.online : styles.offline} />
          {connected ? "实时连接中" : "实时连接中断，正在重连"}
        </span>
        <span>
          {state
            ? `${state.total.toLocaleString("zh-CN")} 条成绩记录`
            : "正在读取成绩"}
        </span>
        {auth?.user?.role === "super_admin" && (
          <button onClick={() => setDeleting("all")}>清空全部记录</button>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className={styles.status} role="status">
          {status}
        </p>
      )}
      {deleting && (
        <section className={styles.confirm}>
          <h2>
            {deleting === "all"
              ? "清空全部成绩记录？"
              : `删除 ${deleting.username} 的这条成绩？`}
          </h2>
          <p>删除后，排行榜将重新计算。</p>
          <div>
            <button className={styles.danger} disabled={busy} onClick={remove}>
              {busy ? "正在删除…" : "确认删除"}
            </button>
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              取消
            </button>
          </div>
        </section>
      )}
      <div className={styles.tabs} role="tablist" aria-label="成绩视图">
        <button
          role="tab"
          aria-selected={tab === "leaderboard"}
          onClick={() => setTab("leaderboard")}
        >
          最佳成绩 <span>BEST</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "recent"}
          onClick={() => setTab("recent")}
        >
          最近挑战 <span>RECENT</span>
        </button>
      </div>
      {!state ? (
        <p className={styles.empty}>
          {error ? "成绩暂时无法显示。" : "正在加载成绩…"}
        </p>
      ) : !entries.length ? (
        <section className={styles.empty}>
          <span>01</span>
          <h2>第一名，等你来写</h2>
          <p>完成一次音符射手挑战，成绩就会出现在这里。</p>
          <Link className={styles.button} to={themeHref("/note-shooter", themeId)}>
            开始挑战 ↗
          </Link>
        </section>
      ) : (
        <ScoreTable entries={entries} tab={tab} canDelete={!!auth.user} onDelete={setDeleting} />
      )}
    </main>
  );
}
