import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useIsPresent } from "motion/react";
import { ArrowRight, ArrowUpRight, Plus, QrCode, Play, Settings2 } from "lucide-react";
import type { RoomSummary } from "../../shared/types";
import { useRooms } from "../features/game/useRooms";
import { useAuth } from "../lib/auth";
import { resolveHomeTheme, themeHref } from "../lib/home-theme";
import { Reveal } from "../components/Reveal";
import { ChangePassword } from "../components/ChangePassword";
import { GamePage } from "./Game";
import { statusLabels } from "../features/game/game-rules";
import styles from "./Game.module.css";

export function HostPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const routeLocation = useLocation();
  const present = useIsPresent();
  if (loading) return <div className="page container">正在确认登录状态…</div>;
  if (!user)
    return present ? (
      <Navigate
        to={themeHref(`/login?next=${encodeURIComponent(routeLocation.pathname + routeLocation.search)}`, resolveHomeTheme(routeLocation.search))}
        replace
      />
    ) : null;
  return params.get("room") ? <GamePage role="host" /> : <RoomList />;
}

function RoomList() {
  const themeId = resolveHomeTheme(useLocation().search);
  const navigate = useNavigate();
  const { rooms, error, busy, renameError, setRenameError, reload: load, create: createRoom, close: closeRoom, rename: renameRoom } = useRooms();
  const [name, setName] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<RoomSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const { user } = useAuth();
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const room = await createRoom(name, themeId);
    if (room) navigate(themeHref(`/host?room=${room.code}`, room.theme || "bangdream"));
  }
  async function close(code: string) {
    if (await closeRoom(code)) setClosing(null);
  }
  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (renaming && await renameRoom(renaming.code, renameValue)) setRenaming(null);
  }
  return (
    <main className="container page">
      <Reveal>
        <div className="page-heading">
          <h1>
            你的舞台，<em>准备开场。</em>
          </h1>
          <p>{user?.displayName}，创建一个房间，邀请朋友一起猜卡。</p>
        </div>
      </Reveal>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <form className={styles.createRoom} onSubmit={create}>
        <label htmlFor="room-name">房间名称</label>
        <input
          id="room-name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：周末猜卡时间"
        />
        <button className="button pink" disabled={busy}>
          <Plus size={20} />
          {busy ? "正在创建" : "创建房间"}
        </button>
      </form>
      <div className={styles.roomHeading}>
        <h2>
          {user?.role === "super_admin" ? "全部房间" : "我的房间"}{" "}
          <span>{rooms.length}</span>
        </h2>
        <button className="text-link" onClick={() => void load()}>
          刷新
        </button>
      </div>
      {!rooms.length && (
        <div className="empty-state">
          <Play />
          <h3>舞台还空着，等你开场。</h3>
          <p>创建房间后，把房间码或二维码发给朋友。</p>
        </div>
      )}
      <div className={styles.roomList}>
        {rooms.map((room) => (
          <article className={styles.room} key={room.code}>
            <div>
              <span className={styles.roomCode}>{room.code}</span>
              <h3>{room.name}</h3>
              <p>
                {statusLabels[room.status]} · {room.players} 位玩家
              </p>
            </div>
            <div className={styles.roomActions}>
              <Link className="button" to={themeHref(`/host?room=${room.code}`, room.theme || "bangdream")}>
                进入主持台 <ArrowRight size={17} />
              </Link>
              <Link
                className="button outline"
                to={themeHref(`/qr?room=${room.code}`, room.theme || "bangdream")}
                aria-label="房间二维码"
              >
                <QrCode size={20} />
              </Link>
              <button
                className="text-link"
                onClick={() => {
                  setRenaming(room);
                  setRenameValue(room.name);
                  setRenameError("");
                }}
              >
                更名
              </button>
              <button
                className="text-link danger-text"
                onClick={() => setClosing(room.code)}
              >
                关闭
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.adminLinks}>
        <Link to="/settings">
          默认游戏设置 <Settings2 size={16} />
        </Link>
        {user?.role === "super_admin" && (
          <>
            <Link to="/admin/users">
              账号管理 <ArrowUpRight size={16} />
            </Link>
            <Link to="/community-admin">
              社团内容管理 <ArrowUpRight size={16} />
            </Link>
            <Link to="/diagnostics">
              运行诊断 <ArrowUpRight size={16} />
            </Link>
          </>
        )}
      </div>
      <ChangePassword />
      {renaming && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-title"
            className="modal"
          >
            <h2 id="rename-title">房间更名</h2>
            <form className={styles.renameForm} onSubmit={rename}>
              <label htmlFor="rename-room">房间 {renaming.code} 的名称</label>
              <input
                id="rename-room"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={40}
                required
                autoFocus
              />
              {renameError && (
                <p className="alert" role="alert">
                  {renameError}
                </p>
              )}
              <div className="actions">
                <button
                  type="button"
                  className="button outline"
                  onClick={() => setRenaming(null)}
                  disabled={busy}
                >
                  取消
                </button>
                <button
                  className="button pink"
                  disabled={busy || !renameValue.trim()}
                >
                  {busy ? "正在保存" : "保存名称"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {closing && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-title"
            className="modal"
          >
            <h2 id="close-title">关闭房间 {closing}？</h2>
            <p>该房间的所有玩家将断开，进行中的对局结束。</p>
            <div className="actions">
              <button
                className="button outline"
                onClick={() => setClosing(null)}
              >
                取消
              </button>
              <button className="button" onClick={() => void close(closing)}>
                关闭房间
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

