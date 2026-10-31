import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Reveal } from "../../components/Reveal";
import { HomeGameArt } from "../../components/HomeGameArt";
import { MusicStaff, Lightning } from "../../components/PosterGraphics";
import { HOME_THEMES, resolveHomeTheme, themeHref } from "../../lib/home-theme";
import styles from "../../pages/Home.module.css";

export function JoinRoom({ compact = false }: { compact?: boolean }) {
  const themeId = resolveHomeTheme(useLocation().search);
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  return (
    <form
      className={`${styles.join} ${compact ? styles.compact : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim())
          navigate(
            themeHref(`/player?room=${encodeURIComponent(code.trim().toUpperCase())}`, themeId),
          );
      }}
    >
      <label
        className="sr-only"
        htmlFor={compact ? "compact-room" : "room-code"}
      >
        房间码
      </label>
      <input
        id={compact ? "compact-room" : "room-code"}
        aria-label="房间码"
        placeholder={compact ? "房间码" : "输入 6 位房间码"}
        maxLength={6}
        minLength={6}
        pattern="[a-zA-Z2-9]{6}"
        required
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        autoComplete="off"
      />
      <button className="button pink" type="submit">
        加入房间 <ArrowRight size={18} />
      </button>
    </form>
  );
}

export function GameDirectory({ home = false }: { home?: boolean }) {
  const themeId = resolveHomeTheme(useLocation().search);
  const themed = (href: string) => themeHref(href, themeId);
  const theme = HOME_THEMES[themeId];
  const cardTitle = theme.guessTitle;
  const isBlueArchive = themeId === "bluearchive";
  if (home) return (
    <div className={`${styles.homeGames} ${isBlueArchive ? styles.homeGamesWithMooncake : ""}`}>
      <Reveal className={styles.homeGame}>
        <div className={styles.gameIllustration} aria-hidden="true">
          <HomeGameArt kind="cards" themeId={themeId} />
        </div>
        <h3>{cardTitle}</h3><p>多人房间 · 单人挑战</p>
        <JoinRoom compact />
        <Link className={styles.homeSolo} to={themed("/solo")}>单人挑战 <ArrowUpRight size={14} /></Link>
      </Reveal>
      {[
        { name: "音符射手", text: isBlueArchive ? "白子的战术训练" : "跟随节奏，击中音符", kind: "music" as const, to: "/note-shooter", color: "#697cdb", tint: "#e6edff", note: isBlueArchive ? "白子陪你挑战高分！" : "用节奏，击穿高分！" },
        { name: "秒表挑战", text: isBlueArchive ? "阿洛娜的计时课堂" : "考验你的反应速度", kind: "timer" as const, to: "/games/stopwatch-challenge", color: "#ffb52f", tint: "#fff3c8", note: isBlueArchive ? "老师，抓住这一刻！" : "极限一秒，挑战自我！" },
        { name: "华容道", text: isBlueArchive ? "帮助学生解开谜题" : "移动方块，解开谜题", kind: "blocks" as const, to: "/games/bang-klotski", color: "#51c58b", tint: "#e4f9e9", note: isBlueArchive ? "星野陪你找到出口！" : "开动脑筋，完成挑战！" },
        ...(isBlueArchive ? [{ name: "泡泡月饼大作战", text: "瞄准月饼，连消得分", kind: "mooncake" as const, to: "/games/ba-mooncake", color: "#6f71d9", tint: "#eeefff", note: "横屏出发，挑战高分！" }] : []),
      ].map(({ name, text, kind, to, color, tint, note }, i) => (
        <Reveal key={to} delay={i * .06} className={styles.homeGame}>
          <div className={styles.gameContents} style={{ "--game-color": color, "--game-tint": tint } as React.CSSProperties}>
            <div className={styles.gameIllustration}><HomeGameArt kind={kind} themeId={themeId} /></div>
            <h3>{name}</h3><p>{text}</p>
            <Link className={styles.gameButton} to={themed(to)} aria-label={`开始${name}`}>开始游戏 <ArrowRight size={16} /></Link>
            <small>{note}</small>
          </div>
        </Reveal>
      ))}
    </div>
  );
  return (
    <div className={styles.gamesGrid}>
      <Reveal className={styles.cardGame}>
        <img
          src={theme.guessPreview}
          alt={`${cardTitle}插画`}
          loading="lazy"
        />
        <div>
          <h3>{cardTitle}</h3>
          <p>多人房间 · 单人挑战</p>
          <JoinRoom />
          <Link className={styles.soloLink} to={themed("/solo")}>
            单人挑战 <ArrowUpRight size={18} />
          </Link>
        </div>
        <img
          className={styles.bandLogo}
          src={themeId === "bangdream" ? "/brand/poppin-party-logo.webp" : theme.cursor.main}
          alt=""
          aria-hidden="true"
          loading="lazy"
        />
      </Reveal>
      <div className={styles.gameList}>
        {[
          {
            name: "音符射手",
            text: isBlueArchive ? "白子的战术训练" : "跟随节奏，击中音符",
            kind: "music" as const,
            to: "/note-shooter",
            color: "#ff2377",
          },
          {
            name: "秒表挑战",
            text: isBlueArchive ? "阿洛娜的计时课堂" : "考验你的反应速度",
            kind: "timer" as const,
            to: "/games/stopwatch-challenge",
            color: "#ffbe00",
          },
          {
            name: "华容道",
            text: isBlueArchive ? "帮助学生解开谜题" : "移动方块，解开谜题",
            kind: "blocks" as const,
            to: "/games/bang-klotski",
            color: "#2cca72",
          },
          ...(isBlueArchive ? [{
            name: "泡泡月饼大作战",
            text: "瞄准月饼，连消得分",
            kind: "mooncake" as const,
            to: "/games/ba-mooncake",
            color: "#6f71d9",
          }] : []),
        ].map(({ name, text, kind, to, color }, i) => (
          <Reveal delay={i * 0.08} key={to}>
            <Link
              className={`${styles.gameRow} ${kind === "mooncake" ? styles.mooncakeRow : ""}`}
              to={themed(to)}
              style={{ "--game-color": color } as React.CSSProperties}
            >
              <HomeGameArt kind={kind} themeId={themeId} className={styles.gameIcon} />
              <div>
                <h3>{name}</h3>
                <p>{text}</p>
              </div>
              {kind === "music" ? (
                <MusicStaff className={styles.rowDecoration} />
              ) : (
                <Lightning className={styles.rowDecoration} />
              )}
              <ArrowRight className={styles.rowArrow} />
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

