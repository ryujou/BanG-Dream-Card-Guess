import { useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useStopwatch } from "../features/game/useStopwatch";
import { HOME_THEMES, resolveHomeTheme, themeHref } from "../lib/home-theme";
import styles from "./MiniGames.module.css";

const klotskiCharacters = { bangdream: "米歇尔", sekai: "天马司", bluearchive: "星野" };

function ArcadeFrame({
  title,
  number,
  description,
  src,
  portrait = false,
  landscape = false,
  children,
}: {
  title: string;
  number: string;
  description: string;
  src: string;
  portrait?: boolean;
  landscape?: boolean;
  children?: ReactNode;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const themeId = resolveHomeTheme(useLocation().search);
  const themed = (href: string) => themeHref(href, themeId);
  const [fullscreenError, setFullscreenError] = useState("");

  async function fullscreen() {
    try {
      await frame.current?.requestFullscreen();
      setFullscreenError("");
    } catch {
      setFullscreenError("当前浏览器不支持全屏，请使用下方游戏区域。");
    }
  }

  return (
    <main className={`${styles.page} ${landscape ? styles.landscapePage : ""}`} data-arcade-theme={themeId}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>{HOME_THEMES[themeId].arcadeLabel} / ARCADE {number}</span>
          <h1>
            {title}
            <span>。</span>
          </h1>
          <p>{description}</p>
        </div>
        <div className={styles.headerActions}>
          <Link to={themed("/")}>返回首页 ↗</Link>
          <button onClick={fullscreen}>全屏游玩 ⤢</button>
        </div>
      </header>
      {fullscreenError && (
        <p role="status" className={styles.notice}>
          {fullscreenError}
        </p>
      )}
      <div
        className={`${styles.frameStage} ${portrait ? styles.portraitStage : ""}`}
      >
        {portrait && (
          <aside className={styles.stageAside}>
            <span className={styles.eyebrow}>{themeId === "bluearchive" ? "WELCOME TO KIVOTOS" : "TURN UP THE VOLUME"}</span>
            <p>
              {themeId === "bluearchive" ? "老师，准备好" : "你的音符，"}
              <br />
              {themeId === "bluearchive" ? "一起出发了吗" : "就是主角"}<span>{themeId === "bluearchive" ? "？" : "。"}</span>
            </p>
            <span className={styles.stageCaption}>
              按住发射 · 滑动闪避
              <br />
              {themeId === "bluearchive" ? "三次训练，四种难度。" : "三个关卡，四种难度。"}
            </span>
            <Link to={themed("/scores")}>{themeId === "bluearchive" ? "查看训练成绩 ↗" : "看看大家的成绩 ↗"}</Link>
          </aside>
        )}
        <iframe
          ref={frame}
          className={`${styles.gameFrame} ${portrait ? styles.portraitFrame : landscape ? styles.landscapeFrame : styles.klotskiFrame}`}
          src={themed(src)}
          title={title}
          allow="autoplay"
          allowFullScreen
        />
      </div>
      {children}
      <nav className={styles.gameNav} aria-label="其他小游戏">
        <Link to={themed("/note-shooter")}>01 / 音符射手 ↗</Link>
        <Link to={themed("/games/bang-klotski")}>02 / 华容道 ↗</Link>
        <Link to={themed("/games/stopwatch-challenge")}>03 / 秒表挑战 ↗</Link>
        {themeId === "bluearchive" && <Link to={themed("/games/ba-mooncake")}>04 / 泡泡月饼大作战 ↗</Link>}
      </nav>
    </main>
  );
}

export function NoteShooterPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  return (
    <ArcadeFrame
      title="音符射手"
      number="01"
      description={themeId === "bluearchive" ? "基沃托斯的特别训练开始了。和学生们并肩出发。" : "把节奏化成音符。属于你的演出，现在开始。"}
      src="/note-shooter/bangdream.html?v=parity-20261031"
      portrait
    />
  );
}

export function KlotskiPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  return (
    <ArcadeFrame
      title="华容道"
      number="02"
      description={themeId === "bluearchive" ? "整理夏莱的通道，一起帮星野找到出口。" : `小小棋盘，大大默契。一起帮${klotskiCharacters[themeId]}找到出口。`}
      src="/games/bang-klotski/game.html?v=parity-20261031"
    />
  );
}

export function StopwatchPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  const themed = (href: string) => themeHref(href, themeId);
  const { settings, ready, notice, mode, display, pad, round, start, stop, reset, error, result } = useStopwatch();
  const resultMessage = themeId !== "bluearchive" ? result
    : mode === "win" ? "计时任务完成，老师！"
    : mode === "lose" ? error < 0 ? "稍早了一点，老师再试一次。" : "稍晚了一点，老师再试一次。"
    : mode === "holding" ? "和伙伴一起数拍，松开时定格。" : "准备好了吗，老师？开始夏莱的计时训练吧。";

  return (
    <main className={styles.page} data-arcade-theme={themeId}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>{HOME_THEMES[themeId].arcadeLabel} / ARCADE 03</span>
          <h1>
            秒表挑战<span>。</span>
          </h1>
          <p>{themeId === "bluearchive" ? "老师，跟上伙伴的节拍，把时间停在约定的一刻。" : "不快一拍，不慢一拍。把心跳停在刚刚好的瞬间。"}</p>
        </div>
        <Link className={styles.backLink} to={themed("/")}>
          返回首页 ↗
        </Link>
      </header>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <section
        className={styles.stopwatchStage}
        data-mode={mode}
        aria-label="秒表挑战舞台"
      >
        <div className={styles.stopwatchHeading}>
          <span>{themeId === "bluearchive" ? "SCHALE TIMING" : "FEEL THE BEAT."}</span>
          <span>HOLD / RELEASE</span>
        </div>
        <div className={styles.timerBody}>
          <div className={styles.target}>
            <span>TARGET TIME</span>
            <strong>
              {settings.targetSeconds.toFixed(2)}
              <small>SEC</small>
            </strong>
            <p>允许误差 ±{settings.toleranceSeconds.toFixed(2)} 秒</p>
          </div>
          <div className={styles.timerCenter}>
            <span className={styles.timerLabel}>
              {mode === "holding" ? "LIVE TIMING" : "YOUR TIME"}
            </span>
            <div className={styles.timerDigits}>
              <output ref={display} aria-label="当前计时秒数">
                0.00
              </output>
              <span>s</span>
            </div>
            <p className={styles.timerResult} aria-live="polite">
              {resultMessage}
            </p>
            <p className={styles.delta}>
              {mode === "win" || mode === "lose"
                ? `与目标相差 ${error > 0 ? "+" : ""}${error.toFixed(3)} 秒`
                : " "}
            </p>
          </div>
          <button
            ref={pad}
            className={styles.holdPad}
            disabled={!ready}
            aria-label="按住开始计时，松开结束"
            aria-pressed={mode === "holding"}
            onPointerDown={(event) => {
              if (event.button !== 0 || round.current.source) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              start(`pointer:${event.pointerId}`);
            }}
            onPointerUp={(event) => stop(`pointer:${event.pointerId}`)}
            onPointerCancel={(event) => stop(`pointer:${event.pointerId}`)}
            onLostPointerCapture={(event) => stop(`pointer:${event.pointerId}`)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span>
              {!ready ? "准备中" : mode === "holding" ? "松开" : "按住"}
            </span>
            <small>{mode === "holding" ? "TO STOP" : "TO START"}</small>
            <i aria-hidden="true">↗</i>
          </button>
        </div>
        <div className={styles.stopwatchFooter}>
          <span>按住按钮或空格键开始，松开结束。</span>
          <button onClick={reset} disabled={mode === "holding"}>
            重置计时 ↺
          </button>
        </div>
      </section>
      <div className={styles.gameNote}>
        <span>01 / 按住，开始你的节拍</span>
        <span>02 / 让时间自然流动</span>
        <span>03 / 松开，看看你的默契</span>
      </div>
      <nav className={styles.gameNav} aria-label="其他小游戏">
        <Link to={themed("/note-shooter")}>01 / 音符射手 ↗</Link>
        <Link to={themed("/games/bang-klotski")}>02 / 华容道 ↗</Link>
        {themeId === "bluearchive" && <Link to={themed("/games/ba-mooncake")}>04 / 泡泡月饼大作战 ↗</Link>}
      </nav>
    </main>
  );
}

export function MooncakePage() {
  const location = useLocation();
  if (resolveHomeTheme(location.search) !== "bluearchive") {
    return <Navigate to={themeHref(`${location.pathname}${location.search}${location.hash}`, "bluearchive")} replace />;
  }
  return (
    <ArcadeFrame
      title="泡泡月饼大作战"
      number="04"
      description="和学生们一起瞄准发射，消除泡泡月饼，挑战高分。建议横屏或全屏游玩。"
      src="/games/ba-mooncake/index.html"
      landscape
    >
      <p className={styles.gameAttribution}>
        非官方试玩，分数仅用于当前页面，不发放官方奖励。
        <a href="https://github.com/ryujou/bluearchive-mooncake-local" target="_blank" rel="noopener noreferrer">项目来源</a>
        {" · "}
        <a href="https://bluearchive-cn.com/webview/midautumn2026/" target="_blank" rel="noopener noreferrer">素材来源</a>
      </p>
    </ArcadeFrame>
  );
}
