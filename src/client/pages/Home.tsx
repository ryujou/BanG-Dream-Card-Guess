import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Users,
  Image,
  Play,
  ShoppingBag,
  MapPin,
  X,
} from "lucide-react";
import type { Community } from "../../shared/types";
import { useCommunity } from "../features/community/useCommunity";
import { communityThumbnail, isPastEvent } from "../features/community/model";
import { Brand, Star } from "../components/Brand";
import { StageParticles } from "../components/StageParticles";
import { XiangtanScene } from "../components/XiangtanScene";
import { GameDirectory } from "../features/game/GameDirectory";
import { Reveal } from "../components/Reveal";
import {
  MusicStaff,
} from "../components/PosterGraphics";
import styles from "./Home.module.css";
import products from "../data/products.json";
import { communityThemeIntro, homeThemeStyle, themeHref, type HomeTheme, type HomeThemeId } from "../lib/home-theme";
import { HeroCharacters } from "../components/HeroCharacters";

export function HomePage({ theme, themeId }: { theme: HomeTheme; themeId: HomeThemeId }) {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(preference.matches);
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  const { scrollY } = useScroll();
  const shift = useTransform(scrollY, [0, 900], [0, -20]);
  const { data: community, error: communityError } = useCommunity();
  const [playingVideo, setPlayingVideo] = useState<
    NonNullable<Community["bilibili"]>[number] | null
  >(null);
  const videoDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (playingVideo) videoDialog.current?.showModal();
  }, [playingVideo]);
  const event = community?.events[0];
  const isBlueArchive = themeId === "bluearchive";
  const pastEvent = event ? isPastEvent(event.date) : false;
  return (
    <main className={styles.home} style={homeThemeStyle(theme)} data-home-theme={themeId}>
      <section className={styles.hero}>
        <MusicStaff className={styles.heroStaff} />
        <StageParticles colors={theme.particles} />
        <span className={styles.heroLive} aria-hidden="true">
          {isBlueArchive ? "BLUE" : "LIVE"}
        </span>
        <div className={styles.heroCopy}>
          <motion.h1
            initial={{ y: reduced ? 0 : 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            让热爱，
            <br />
            <span>在湘潭相遇。</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.7 }}
          >
            一起聊{isBlueArchive ? "剧情" : "音乐"}、玩游戏，遇见身边的{theme.fans}。
          </motion.p>
          <div className={styles.heroActions}>
            <Link className="button pink" to={themeHref("/games", themeId)}>
              {themeId === "bluearchive" ? "开始猜图" : "开始猜卡"} <ArrowRight />
            </Link>
            <a
              className="button outline"
              href={theme.communityUrl}
              target="_blank"
              rel="noreferrer"
            >
              加入同好会 <ArrowUpRight size={18} />
            </a>
          </div>
          <div className={styles.heroCaption}>
            <span>{isBlueArchive ? "故事让我们相遇！" : "音乐让我们相遇！"}</span>
            <small>{theme.wordmark}<br />{isBlueArchive ? "OUR STORIES CONNECT US" : "MUSIC CONNECTS PEOPLE"}</small>
          </div>
        </div>
        <motion.div
          className={styles.heroArt}
          style={{ y: reduced ? 0 : shift }}
        >
          <HeroCharacters key={themeId} themeId={themeId} reduced={reduced} />
        </motion.div>
        <Star className={styles.heroStar} />
        <span className={styles.heroClub} aria-hidden="true">
          {theme.wordmark}
          <br />
          XIANGTAN
          <br />
          FAN COMMUNITY
        </span>
        <span className={styles.heroNote}>
          {isBlueArchive ? "Stories for" : "Music for"}
          <br />a brighter tomorrow.
        </span>
      </section>
      <div className={styles.gamesBand}>
        <section className={`container ${styles.games}`} id="games">
          <Reveal className={styles.gamesHeading}>
            <div><h2 className={styles.sectionTitle}>今天，<em>来玩一局。</em></h2>
            <p>{isBlueArchive ? "在基沃托斯相遇，开启更多有趣的挑战。" : "音乐不止于聆听，还有更多有趣的玩法。"}<br />在这里，和同好们一起享受游戏的快乐！</p></div>
            <span aria-hidden="true">PLAY<br />{isBlueArchive ? "STORIES" : "MUSIC"}<br />TOGETHER</span>
          </Reveal>
          <GameDirectory home />
        </section>
      </div>
      <section className={`container ${styles.community}`}>
        {communityError && (
          <p className="alert" role="alert">
            社团内容暂时无法加载：{communityError}
          </p>
        )}
        <Reveal className={styles.communityTitle}>
          <div className={styles.cityDecoration} aria-hidden="true"><XiangtanScene colors={theme.particles} /></div>
          <h2>我们的<em>同好会</em></h2>
          <p>
            {communityThemeIntro(community?.aboutUs || "", themeId) ||
              (isBlueArchive ? "在这里，我们聊剧情、玩游戏、分享基沃托斯的故事，也期待与你在湘潭相遇。" : "在这里，我们聊音乐、玩游戏、分享喜欢的一切，也期待与你在湘潭相遇。")}
          </p>
          <Link className="text-link" to={themeHref("/community", themeId)}>
            认识我们 <ArrowUpRight size={18} />
          </Link>
        </Reveal>
        <Reveal className={styles.communityTiles}>
          <Link to={themeHref("/community#events", themeId)}>
            <h3>
              <CalendarDays /> 活动
            </h3>
            <div className={`${styles.emptyTile} ${event ? styles.eventPreview : ""}`}>
              {event ? <>
                <span className={styles.eventDate}><CalendarDays size={16} />{event.date || "日期待公布"}</span>
                <strong>{pastEvent && event.title === "下次活动预告" ? "往期活动" : event.title}</strong>
                {event.location && <span className={styles.eventLocation}><MapPin size={15} />{event.location}</span>}
                <p>{pastEvent && "原活动公告："}{event.desc}</p>
              </> : <><CalendarDays /><p><span className={styles.emptyPhrase}>新的相聚，</span><span className={styles.emptyPhrase}>正在筹备。</span></p></>}
            </div>
          </Link>
          <Link to={themeHref("/community#members", themeId)}>
            <h3>
              <Users /> 成员
            </h3>
            <div className={`${styles.emptyTile} ${community?.members.length ? styles.memberPreview : ""}`}>
              {community?.members.length ? community.members.slice(0, 4).map((member, index) => (
                <div className={styles.memberMini} key={`${member.name}-${index}`} title={member.name}>
                  {member.image ? <img src={communityThumbnail(member.image)} alt={`${member.name} 的头像`} loading="lazy" /> : <span className={styles.memberInitial}>{member.name.slice(0, 1)}</span>}
                  <span>{member.name}</span>
                </div>
              )) : <><Users /><p><span className={styles.emptyPhrase}>新的相遇，</span><span className={styles.emptyPhrase}>正在发生。</span></p></>}
            </div>
          </Link>
          <Link to={themeHref("/community#photos", themeId)}>
            <h3>
              <Image /> 相册
            </h3>
            <div className={styles.emptyTile}>
              {community?.photos[0] ? (
                <img
                  src={
                    community.photos[0].thumbnail || communityThumbnail(community.photos[0].url)
                  }
                  alt="同好会相册"
                  loading="lazy"
                />
              ) : (
                <>
                  <Image />
                  <p><span className={styles.emptyPhrase}>回忆，</span><span className={styles.emptyPhrase}>正在积累中。</span></p>
                </>
              )}
            </div>
          </Link>
          <div className={styles.videoPreview}>
            <Link to={themeHref("/community#videos", themeId)}>
              <h3>
                <Play /> 社团视频
              </h3>
            </Link>
            <div className={`${styles.emptyTile} ${styles.videoTile}`}>
              <button
                type="button"
                className={styles.videoArtwork}
                disabled={!community?.bilibili?.length}
                onClick={() =>
                  setPlayingVideo(community?.bilibili?.[0] || null)
                }
                aria-label="播放社团视频"
              >
                <img
                  src={
                    communityThumbnail(community?.bilibili?.[0]?.cover ||
                    "/brand/film-live-stage.jpg")
                  }
                  alt={
                    community?.bilibili?.length
                      ? "社团视频封面"
                      : "BanG Dream! 官方演出画面"
                  }
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <Play />
              </button>
              <p>{community?.bilibili?.[0]?.title || (isBlueArchive ? "故事，连接着我们。" : "音乐，连接着我们。")}</p>
              <small>
                {community?.bilibili?.length ? "观看社团视频" : "暂无视频"}
              </small>
            </div>
          </div>
        </Reveal>
      </section>
      <section className={`container ${styles.shop}`}>
        <Reveal>
          <div className={styles.shopHeading}>
            <h2>
              <ShoppingBag /> 社团周边
            </h2>
            <Link className="text-link" to={themeHref("/shop", themeId)}>
              查看周边 <ArrowRight size={20} />
            </Link>
          </div>
          <div className={styles.productPreview}>
            {products.slice(0, 5).map((product) => (
              <Link key={product.id} to={themeHref(`/shop/${product.id}`, themeId)}>
                <img src={product.image} alt={product.name} loading="lazy" />
                <div>
                  <span>{product.name.replace("镭射亚克力钥匙扣 ", "")}</span>
                  <strong>¥{product.price.toFixed(2)}</strong>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>
      <footer className={`container ${styles.links}`}>
        <div className={styles.footerBrand}>
          <Brand name={theme.brand} to={themeHref("/", themeId)} />
          <p>因为{isBlueArchive ? "热爱" : "音乐"}，让湘潭的我们相遇。</p>
        </div>
        <a href="https://enldm.cyou/bangmap" target="_blank" rel="noreferrer">
          <MapPin />
          <span>
            <strong>BanG Map</strong>
            <small>探索邦邦相关地点</small>
          </span>
          <ArrowUpRight />
        </a>
        <Link to={themeHref("/stats", themeId)}>
          <MapPin />
          <span>
            <strong>访问地图</strong>
            <small>看看大家从哪里来</small>
          </span>
          <ArrowUpRight />
        </Link>
        <a href={theme.communityUrl} target="_blank" rel="noreferrer">
          <Users />
          <span>
            <strong>加入同好会</strong>
            <small>{theme.communityGroup ? `QQ 群：${theme.communityGroup}` : "一起聊音乐、一起玩"}</small>
          </span>
          <ArrowUpRight />
        </a>
        <div className={styles.footerSignature}>
          Live for
          <br />A brighter tomorrow.
          <Star />
        </div>
      </footer>
      {playingVideo && (
        <dialog
          ref={videoDialog}
          className={styles.videoDialog}
          aria-labelledby="video-dialog-title"
          onClose={() => setPlayingVideo(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget)
              videoDialog.current?.close();
          }}
        >
          <div className={styles.videoDialogHeading}>
            <h2 id="video-dialog-title">{playingVideo.title || "社团视频"}</h2>
            <button
              className="icon-button"
              aria-label="关闭视频"
              onClick={() => videoDialog.current?.close()}
            >
              <X />
            </button>
          </div>
          <iframe
            title={playingVideo.title || playingVideo.bvid}
            src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(playingVideo.bvid)}&autoplay=0&danmaku=0`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
          <div className={styles.videoSelection}>
            {community?.bilibili?.map((video) => (
              <button
                key={video.bvid}
                aria-pressed={video.bvid === playingVideo.bvid}
                onClick={() => setPlayingVideo(video)}
              >
                {video.title || video.bvid}
              </button>
            ))}
          </div>
        </dialog>
      )}
    </main>
  );
}

