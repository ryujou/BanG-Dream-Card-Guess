import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { useAuth } from "../lib/auth";
import styles from "./Diagnostics.module.css";

interface Diagnostics {
  uptime: number;
  rooms: number;
  soloGames: number;
  clients: number;
  users: number;
  scores: number;
  cardCount: number;
  publicOrigin: string;
  memory: { systemAllocated: number; heapUsed: number };
  errors: (string | { message: string; at?: number })[];
}
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

export function DiagnosticsPage() {
  const auth = useAuth();
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(0);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      setData(await api<Diagnostics>("/api/diagnostics"));
      setUpdatedAt(Date.now());
    } catch (error) {
      setError(error instanceof Error ? error.message : "诊断信息加载失败。");
    } finally {
      setBusy(false);
    }
  }, []);
  async function copyDiagnostics() {
    setError("");
    setStatus("");
    try {
      await copyText(JSON.stringify(data, null, 2));
      setStatus("诊断信息已复制。");
    } catch {
      setError("浏览器未允许复制，请展开下方诊断 JSON 手动复制。");
    }
  }
  useEffect(() => {
    if (auth.loading) return;
    if (auth.user?.role === "super_admin") void load();
    else setBusy(false);
  }, [auth.loading, auth.user, load]);
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>SYSTEM / DIAGNOSTICS</p>
          <h1>
            运行状态<span>。</span>
          </h1>
          <p>查看当前服务、房间和资源状态。</p>
        </div>
        {auth.user?.role === "super_admin" && (
          <button className={styles.button} disabled={busy} onClick={load}>
            {busy ? "正在刷新…" : "刷新状态 ↻"}
          </button>
        )}
      </header>
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
      {busy && !data ? (
        <p className={styles.empty}>正在读取运行状态…</p>
      ) : auth.user?.role !== "super_admin" ? (
        <section className={styles.empty}>
          <h2>此页面仅限管理员</h2>
          {!auth.user ? (
            <Link to="/login?next=/diagnostics" className={styles.button}>
              登录 ↗
            </Link>
          ) : (
            <Link to="/host" className={styles.button}>
              返回主持控制台 ↗
            </Link>
          )}
        </section>
      ) : data ? (
        <>
          <div className={styles.statusLine}>
            <span>
              <i /> 服务已响应
            </span>
            <span>
              更新于 {new Date(updatedAt).toLocaleTimeString("zh-CN")}
            </span>
          </div>
          <div className={styles.metrics}>
            {[
              { label: "活动房间", value: data.rooms },
              { label: "单人游戏", value: data.soloGames },
              { label: "实时连接", value: data.clients },
              { label: "本地卡面", value: data.cardCount },
            ].map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value.toLocaleString("zh-CN")}</strong>
              </div>
            ))}
          </div>
          <section className={styles.section}>
            <h2>服务信息</h2>
            <dl className={styles.details}>
              <div>
                <dt>运行时间</dt>
                <dd>{duration(data.uptime)}</dd>
              </div>
              <div>
                <dt>公网地址</dt>
                <dd>{data.publicOrigin || "未配置"}</dd>
              </div>
              <div>
                <dt>账号数量</dt>
                <dd>{data.users}</dd>
              </div>
              <div>
                <dt>成绩记录</dt>
                <dd>{data.scores}</dd>
              </div>
              <div>
                <dt>Go 系统分配内存</dt>
                <dd>{megabytes(data.memory.systemAllocated)}</dd>
              </div>
              <div>
                <dt>已用堆内存</dt>
                <dd>{megabytes(data.memory.heapUsed)}</dd>
              </div>
            </dl>
          </section>
          <section className={styles.section}>
            <h2>
              当前问题 <span>{data.errors.length}</span>
            </h2>
            {data.errors.length ? (
              <ul className={styles.errors}>
                {data.errors.map((item, index) => (
                  <li key={index}>
                    {typeof item === "string" ? (
                      item
                    ) : (
                      <>
                        {item.message}
                        {item.at && (
                          <time>
                            {new Date(item.at).toLocaleString("zh-CN")}
                          </time>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.noErrors}>当前没有报告的问题。</p>
            )}
          </section>
          <section className={styles.section}>
            <div className={styles.jsonHeading}>
              <h2>诊断信息</h2>
              <button className={styles.button} onClick={copyDiagnostics}>
                复制诊断信息
              </button>
            </div>
            <details className={styles.json}>
              <summary>查看诊断 JSON</summary>
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </details>
          </section>
        </>
      ) : null}
    </main>
  );
}
