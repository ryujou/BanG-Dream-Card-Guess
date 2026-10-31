import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import styles from "./Home.module.css";
import { Reveal } from "../components/Reveal";
import { GameDirectory } from "../features/game/GameDirectory";
import { resolveHomeTheme, themeHref } from "../lib/home-theme";

export function GamesPage() {
  const themeId = resolveHomeTheme(useLocation().search);
  return (
    <main className="container page">
      <Reveal>
        <div className="page-heading">
          <p className="eyeline">LET'S PLAY</p>
          <h1>今天，来玩一局。</h1>
          <p>输入房间码和朋友一起猜卡，或者开启自己的挑战。</p>
        </div>
      </Reveal>
      <GameDirectory />
      <div className={styles.lobbyLinks}>
        <Link to={themeHref("/host", themeId)}>
          主持控制台 <ArrowUpRight size={18} />
        </Link>
        <Link to={themeHref("/scores", themeId)}>
          查看成绩榜 <ArrowUpRight size={18} />
        </Link>
      </div>
    </main>
  );
}
