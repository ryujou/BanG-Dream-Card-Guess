import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Expand, RotateCcw, Settings2, Wifi, WifiOff, X, Eye, SkipForward, Undo2, Square, QrCode, Play } from "lucide-react";
import { useGame, useHostShortcuts } from "../features/game/useGame";
import { useGameSound } from "../features/game/useGameSound";
import { gameView, statusLabels } from "../features/game/game-rules";
import { JoinRoom } from "../features/game/GameDirectory";
import { HOME_THEMES, resolveHomeTheme, themeHref, buildHomeThemeSearch } from "../lib/home-theme";
import { GameRail, TimerDecoration, ScoreLightning } from "../components/GameDecoration";
import styles from "./Game.module.css";
const RevealScene = lazy(() => import("../motion/RevealScene"));

export function GamePage({
  role = "player",
}: {
  role?: "host" | "player" | "self";
}) {
  const [params] = useSearchParams();
  const route = useLocation();
  const navigate = useNavigate();
  const themeId = resolveHomeTheme(route.search);
  const theme = HOME_THEMES[themeId];
  const imageLabel = themeId === "bluearchive" ? "记忆大厅" : "卡面";
  const themed = (href: string) => themeHref(href, themeId);
  const code = (params.get("room") || "").toUpperCase();
  const { state, connected, error, command, reconnect } = useGame(role, code, themeId);
  useEffect(() => {
    if (state?.room.theme && state.room.theme !== themeId)
      navigate({ pathname: route.pathname, search: buildHomeThemeSearch(route.search, state.room.theme) }, { replace: true });
  }, [state?.room.theme, themeId, route.pathname, route.search, navigate]);
  const reduced = useReducedMotion();
  const [guess, setGuess] = useState("");
  const [fullscreenError, setFullscreenError] = useState("");
  const [resetting, setResetting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const isHost = role === "host",
    isSolo = role === "self";
  const game = state?.game;
  const settings = state?.settings;
  useGameSound(state);
  const { timerText, canPlay, canRecrop, revealed } = gameView(state);
  useHostShortcuts(isHost, command);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      setFullscreenError("当前浏览器不支持全屏，请使用横屏浏览。");
    }
  }
  if (!isSolo && !code)
    return (
      <main className="container page">
        <div className="page-heading">
          <h1>一起，猜中这一刻。</h1>
          <p>输入主持提供的房间码，马上进入现场。</p>
        </div>
        <JoinRoom />
        <Link className="text-link" to={themed("/solo")} style={{ marginTop: 32 }}>
          也可以单人挑战 <ArrowRight size={18} />
        </Link>
      </main>
    );
  return (
    <main className={styles.gamePage}>
      <div className={styles.gameTop}>
        <Link to={themed(isHost ? "/host" : "/games")}>
          <ArrowLeft size={18} />
          {isHost ? "我的房间" : "返回游戏大厅"}
        </Link>
        <div className={styles.connection}>
          {connected ? <Wifi size={18} /> : <WifiOff size={18} />}
          <span>{connected ? "已连接" : "连接中"}</span>
          <i />
          <strong>
            {isSolo ? (
              "单人舞台"
            ) : (
              <>
                房间 <em>{code}</em>
              </>
            )}
          </strong>
        </div>
      </div>
      {(error || fullscreenError) && (
        <div className={`alert ${styles.gameAlert}`} role="alert">
          {error || fullscreenError}
          {!connected && <button onClick={reconnect}>重新连接</button>}
        </div>
      )}
      <div className={styles.gameLayout} ref={stageRef}>
        <section className={styles.stage}>
          <div className={styles.stageRail}>
            <GameRail themeId={themeId} />
          </div>
          <div className={styles.stageContent}>
            <h1>猜中这一刻。</h1>
            <p className={styles.stageDescription}>
              {game?.message === "答题中"
                ? themeId === "bluearchive" ? "从记忆大厅的局部场景，猜猜是哪位学生吧！" : `来自${theme.brand}的某张卡面局部，猜猜看是哪一张吧！`
                : game?.message || "正在连接你的舞台…"}
            </p>
            <div
              className={`${styles.cropFrame} ${revealed ? styles.revealed : ""}`}
            >
              {game?.current ? (
                <img
                  key={
                    revealed ? game.current.imageUrl : game.current.crop.image
                  }
                  src={
                    revealed ? game.current.imageUrl : game.current.crop.image
                  }
                  alt={revealed ? game.current.displayName : `本题${imageLabel}局部`}
                  className={styles.cardImage}
                />
              ) : (
                <div className={styles.waitStage}>
                  <span>?</span>
                  <p>
                    {game?.loading
                      ? `${imageLabel}准备中…`
                      : isHost || isSolo
                        ? "准备好，就开始吧。"
                        : "等待主持开启这一轮。"}
                  </p>
                </div>
              )}
              {game?.loading && (
                <div className={styles.loadingOverlay}>
                  <span className="spinner" />
                  {`正在准备${imageLabel}…`}
                </div>
              )}
              {revealed && !reduced && (
                <Suspense fallback={null}>
                  <RevealScene
                    key={`${game?.total}-${game?.current?.displayName}`}
                  />
                </Suspense>
              )}
            </div>
            {revealed && game?.current && (
              <motion.h2
                className={styles.answer}
                initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {game.current.displayName}
              </motion.h2>
            )}
            {isSolo && canPlay && (
              <form
                className={styles.guessForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  command("selfGuess", { guess });
                  setGuess("");
                }}
              >
                <label className="sr-only" htmlFor="solo-guess">
                  角色名字或昵称
                </label>
                <input
                  id="solo-guess"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="输入角色名字或昵称"
                  autoComplete="off"
                  required
                />
                <button className="button pink" disabled={!connected}>
                  提交 <ArrowRight size={18} />
                </button>
              </form>
            )}
            <div className={styles.stageActions}>
              {isSolo && (
                <button
                  className="button pink"
                  disabled={!connected || game?.loading}
                  onClick={() => command(game?.current ? "next" : "start")}
                >
                  <Play size={19} />
                  {game?.current ? "下一题" : "开始挑战"}
                </button>
              )}
              {(isHost || isSolo || settings?.showPlayerRecrop) && (
                <button
                  className="button"
                  disabled={!connected || !canRecrop || game?.loading}
                  onClick={() => command("recrop")}
                >
                  <RotateCcw size={20} />
                  换个局部
                </button>
              )}
              {isSolo && (
                <>
                  <button
                    className="button outline"
                    disabled={!game?.current || game?.loading}
                    onClick={() => command("reveal")}
                  >
                    <Eye size={19} />
                    揭晓
                  </button>
                  <button
                    className="button outline"
                    disabled={!connected || !game?.current}
                    onClick={() => {
                      command("stop");
                      setGuess("");
                    }}
                  >
                    <Square size={19} />
                    停止游戏
                  </button>
                  <button
                    className="button outline"
                    disabled={!connected}
                    onClick={() => setResetting(true)}
                  >
                    <Undo2 size={19} />
                    重置本局
                  </button>
                </>
              )}
              <button
                className="button outline"
                onClick={() => void fullscreen()}
              >
                <Expand size={20} />
                全屏
              </button>
            </div>
            {isHost && (
              <div className={styles.hostControls}>
                <button
                  disabled={!connected || game?.loading}
                  onClick={() => command("next")}
                  className="button pink"
                >
                  <Play size={17} />
                  开始 / 下一题
                </button>
                <button
                  disabled={!game?.current || game?.loading}
                  onClick={() => command("reveal")}
                  className="button outline"
                >
                  <Eye size={17} />
                  揭晓
                </button>
                <button
                  disabled={!revealed}
                  onClick={() => command("hideAnswer")}
                  className="button outline"
                >
                  隐藏答案
                </button>
                <button
                  disabled={!canPlay}
                  onClick={() => command("correct")}
                  className="button success"
                >
                  <Check size={17} />
                  答对
                </button>
                <button
                  disabled={!canPlay}
                  onClick={() => command("wrong")}
                  className="button outline"
                >
                  <X size={17} />
                  答错
                </button>
                <button
                  disabled={!canPlay}
                  onClick={() => command("skip")}
                  className="button outline"
                >
                  <SkipForward size={17} />
                  跳过
                </button>
                <button
                  disabled={!game?.canUndo}
                  onClick={() => command("undo")}
                  className="button outline"
                >
                  <Undo2 size={17} />
                  撤销
                </button>
                <button
                  disabled={!game?.current}
                  onClick={() => command("stop")}
                  className="button outline"
                >
                  <Square size={17} />
                  停止
                </button>
                <button
                  disabled={!!game?.current || !game?.total}
                  onClick={() => command("reset")}
                  className="button outline"
                >
                  清空本局
                </button>
              </div>
            )}
          </div>
        </section>
        <aside className={styles.scoreboard}>
          <div className={styles.timer}>
            <span>
              {settings?.showTimer === false ? "本局状态" : "剩余时间"}
            </span>
            <strong
              className={
                settings?.showTimer === false
                  ? styles.timerStatus
                  : styles.timerDigits
              }
            >
              {settings?.showTimer === false
                ? statusLabels[game?.status || "idle"]
                : timerText}
            </strong>
            <TimerDecoration themeId={themeId} />
            {themeId !== "bangdream" ? (
              <svg className={styles.timerLogo} viewBox="0 0 160 60" aria-hidden="true">
                <text x="0" y="42" fontSize="36" fontWeight="900">{theme.brand}</text>
              </svg>
            ) : <img
              className={styles.timerLogo}
              src="/brand/bang-dream-logo.png"
              alt=""
              aria-hidden="true"
            />}
          </div>
          {settings?.mode === "versus" && !isSolo ? (
            <div className={styles.teams}>
              <ScoreLightning />
              {(["A", "B"] as const).map((team) => (
                <div
                  key={team}
                  className={
                    settings.currentTeam === team ? styles.currentTeam : ""
                  }
                >
                  <span>
                    {settings.currentTeam === team ? "当前作答" : "下一棒"}
                  </span>
                  <h3>{game?.teams[team].name}</h3>
                  <strong>{game?.teams[team].score ?? 0}</strong>
                  <p className={styles.teamCheer}>
                    {settings.currentTeam === team
                      ? "继续加油！"
                      : "再接再厉！"}
                  </p>
                  {isHost && (
                    <button
                      className="text-link"
                      onClick={() => command("team", { team })}
                    >
                      切换到本队
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.soloScore}>
              <span>当前得分</span>
              <strong>{game?.score ?? 0}</strong>
              <p>
                连续答对 <b>{game?.streak ?? 0}</b> 题 · 已完成{" "}
                {game?.total ?? 0} 题
              </p>
            </div>
          )}
          {isHost && (
            <div className={styles.hostAnswer}>
              <span>主持专用 · 本题答案</span>
              <h3>{game?.current?.displayName || "等待开始"}</h3>
              <p>{game?.current?.acceptedAnswers.join(" / ")}</p>
              <div>
                <Link to={themed(`/settings?room=${code}`)}>
                  <Settings2 size={16} />
                  房间设置
                </Link>
                <Link to={themed(`/qr?room=${code}`)}>
                  <QrCode size={16} />
                  邀请玩家
                </Link>
              </div>
            </div>
          )}
          {!isHost && (
            <div className={styles.scoreFooter}>
              <b>湘潭 {theme.brand} 同好会</b>
              <span>{themeId === "bluearchive" ? "STORIES CONNECT US." : "MUSIC BRINGS US TOGETHER."}</span>
              <i aria-hidden="true" />
            </div>
          )}
        </aside>
        {isSolo && resetting && (
          <div className="modal-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-solo-title"
              className="modal"
            >
              <h2 id="reset-solo-title">重置单人挑战？</h2>
              <p>当前题目、得分和本局记录将清空，重新开始一场挑战。</p>
              <div className="actions">
                <button
                  className="button outline"
                  onClick={() => setResetting(false)}
                >
                  取消
                </button>
                <button
                  className="button pink"
                  disabled={!connected}
                  onClick={() => {
                    command("reset");
                    setGuess("");
                    setResetting(false);
                  }}
                >
                  确认重置
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
      <section className={styles.history}>
        <div>
          <h2>本局记录</h2>
          <span>
            已完成 <strong>{game?.total ?? 0}</strong> 题
          </span>
        </div>
        {!game?.history.length ? (
          <p className={styles.historyEmpty}>你的高光时刻，就从下一题开始。</p>
        ) : (
          <ol>
            {game.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span>
                  {String(game.history.length - index).padStart(2, "0")}
                </span>
                <span>{isSolo ? "单人" : `${entry.team} 队`}</span>
                <strong>{entry.name || "答案未揭晓"}</strong>
                <em
                  className={
                    entry.result === "correct" ? styles.correct : styles.wrong
                  }
                >
                  {(
                    {
                      correct: "正确",
                      wrong: "答错",
                      skip: "跳过",
                      timeout: "超时",
                    } as Record<string, string>
                  )[entry.result] || entry.result}
                </em>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

