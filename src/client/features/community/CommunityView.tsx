import { CalendarDays, UsersRound, Images, Clapperboard } from "lucide-react";
import { communityThemeIntro, HOME_THEMES, type HomeThemeId } from "../../lib/home-theme";
import { StageShapes, StageStar } from "../../components/StageShapes";
import { XiangtanScene } from "../../components/XiangtanScene";
import { isPastEvent, safeCommunityLink, type CommunityContent } from "./model";
import { CommunityPhotos } from "./CommunityPhotos";
import styles from "../../pages/Community.module.css";

export function CommunityView({ data, error, themeId }: { data: CommunityContent | null; error: string; themeId: HomeThemeId }) {
  const theme = HOME_THEMES[themeId];
  const photos = data?.photos || [];
  const safeLink = (value: string) => safeCommunityLink(value, location.origin);
  const populated =
    data &&
    (data.members.length ||
      data.events.length ||
      data.socialLinks.length ||
      data.photos.length ||
      data.bilibili?.length);
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.headingText}>
          <p className={styles.eyebrow}>XIANGTAN / {theme.wordmark} COMMUNITY</p>
          <h1>
            在湘潭，
            <br />
            <span className={styles.ribbon}>因为热爱相遇。</span>
          </h1>
          <p className={styles.handwritten}>See you at the next live!</p>
        </div>
        <div className={styles.stageArt}>
          <StageShapes />
          <img src="/brand/kasumi.png" alt="" className={styles.character} />
        </div>
      </header>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : !data ? (
        <p className={styles.empty}>正在加载同好会内容…</p>
      ) : (
        <>
          <div className={styles.cityIntro}>
            <img
              className={styles.cityWordmark}
              src="/brand/xiangtan-wordmark.svg"
              alt=""
            />
            <div className={styles.cityScenery}>
              <XiangtanScene />
            </div>
            {data.aboutUs && <p className={styles.about}>{communityThemeIntro(data.aboutUs, themeId)}</p>}
            <p className={styles.cityCaption}>万楼 · 湘江一桥 · 湘莲</p>
          </div>
          {!populated && (
            <section className={styles.firstStory}>
              <div className={styles.storyHeading}>
                <div>
                  <p className={styles.eyebrow}>OUR NEXT CHAPTER</p>
                  <h2>
                    一起，把故事写下去<span>。</span>
                  </h2>
                </div>
                <StageStar className={styles.storyStar} />
              </div>
              <p>线下见面的约定、一起度过的瞬间，都留在这里。</p>
              <div className={styles.storyGrid}>
                <article>
                  <CalendarDays aria-hidden="true" />
                  <h3>活动预告</h3>
                  <p>下一次见面，敬请期待</p>
                </article>
                <article>
                  <UsersRound aria-hidden="true" />
                  <h3>社团成员</h3>
                  <p>同好们的介绍将在这里更新</p>
                </article>
                <article>
                  <Images aria-hidden="true" />
                  <h3>活动返图</h3>
                  <p>相册等待新的共同回忆</p>
                </article>
                <article>
                  <Clapperboard aria-hidden="true" />
                  <h3>精彩视频</h3>
                  <p>那些值得重播的瞬间</p>
                </article>
              </div>
            </section>
          )}
          {(
            <section id="events" className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>01 / EVENTS</span>
                <h2>我们的活动</h2>
              </div>
              {!(data.events.length > 0) && <p className={styles.empty}>新的相聚，正在筹备。</p>}
              <div className={styles.events}>
                {data.events.map((event, index) => (
                  <article key={index} className={styles.event}>
                    {event.image && (
                      <img
                        src={safeLink(event.image)}
                        alt={event.title}
                        loading="lazy"
                      />
                    )}
                    <div>
                      <p className={styles.eyebrow}>
                        {event.date || "日期待公布"}
                        {isPastEvent(event.date) && " · 往期活动"}
                        {event.location && ` / ${event.location}`}
                      </p>
                      <h3>{isPastEvent(event.date) && event.title === "下次活动预告" ? "往期活动" : event.title}</h3>
                      <p>{isPastEvent(event.date) && "原活动公告："}{event.desc}</p>
                      {event.url && safeLink(event.url) && (
                        <a
                          href={safeLink(event.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          活动详情 ↗
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {(
            <section id="members" className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>02 / MEMBERS</span>
                <h2>一起发光的人</h2>
              </div>
              {!(data.members.length > 0) && <p className={styles.empty}>新的相遇，正在发生。</p>}
              <div className={styles.members}>
                {data.members.map((member, index) => (
                  <article key={index} className={styles.member}>
                    {member.image ? (
                      <img
                        src={safeLink(member.image)}
                        alt={`${member.name} 的头像`}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.initial}>
                        {member.name.slice(0, 1) || "✳"}
                      </div>
                    )}
                    <h3>{member.name}</h3>
                    <p>{member.desc}</p>
                    {member.url && safeLink(member.url) && (
                      <a
                        href={safeLink(member.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        个人主页 ↗
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
          {(
            <section id="photos" className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>03 / MEMORIES</span>
                <h2>把这一刻留下</h2>
              </div>
              <CommunityPhotos photos={photos} />
            </section>
          )}
          {!!data.bilibili?.length && (
            <section id="videos" className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>04 / VIDEO</span>
                <h2>再听一次心跳</h2>
              </div>
              <div className={styles.videos}>
                {data.bilibili.map((video, index) => (
                  <article key={`${video.bvid}-${index}`}>
                    <h3>{video.title || "活动视频"}</h3>
                    <iframe
                      src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(video.bvid)}&autoplay=0&danmaku=0`}
                      title={video.title || "Bilibili 活动视频"}
                      allow="fullscreen; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                    <a
                      href={`https://www.bilibili.com/video/${encodeURIComponent(video.bvid)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      在 B 站打开 ↗
                    </a>
                  </article>
                ))}
              </div>
            </section>
          )}
          {data.socialLinks.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <span>05 / FIND US</span>
                <h2>在更多地方遇见</h2>
              </div>
              <div className={styles.socials}>
                {data.socialLinks
                  .filter((link) => safeLink(link.url))
                  .map((link, index) => (
                    <a
                      key={index}
                      href={link.url === HOME_THEMES.bangdream.communityUrl ? theme.communityUrl : safeLink(link.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.title}
                      <span>↗</span>
                    </a>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
