import { Eye, Globe2, MapPin, Users } from "lucide-react";
import { XiangtanScene } from "../components/XiangtanScene";
import { countryName, regionName } from "../features/stats/model";
import { useStats } from "../features/stats/useStats";
import styles from "./Stats.module.css";

export function StatsPage() {
  const { stats, map, error, mapError } = useStats();
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>WHERE WE MEET / 访问统计</p>
        <h1>
          热爱，<span>没有距离。</span>
        </h1>
        <p>看看同好们从哪里来到这里。</p>
        <div className={styles.cityDecoration} aria-hidden="true"><XiangtanScene /></div>
      </header>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : !stats ? (
        <p className={styles.empty}>正在加载访问统计…</p>
      ) : !stats.configured ? (
        <section className={styles.empty}>
          <span>✳</span>
          <h2>统计尚未开放</h2>
          <p>访问来源地图将在统计服务配置完成后展示。</p>
        </section>
      ) : (
        <>
          <div className={styles.totals}>
            <div>
              <span><Eye aria-hidden="true" />访问次数</span>
              <strong>{stats.pageviews.toLocaleString("zh-CN")}</strong>
            </div>
            <div>
              <span><Users aria-hidden="true" />访客</span>
              <strong>{stats.visitors.toLocaleString("zh-CN")}</strong>
            </div>
            <div>
              <span><Globe2 aria-hidden="true" />国家与地区</span>
              <strong>{stats.countries.length}</strong>
            </div>
          </div>
          <section className={styles.mapPanel}>
            <div className={styles.mapLabel}>
              <h2><Globe2 aria-hidden="true" />同一份热爱，来自世界各地</h2>
              <span>
                <i /> 访问量由浅至深
              </span>
            </div>
            {map ? (
              <div
                className={styles.map}
                dangerouslySetInnerHTML={{ __html: map }}
              />
            ) : (
              <p className={styles.empty}>{mapError || "正在绘制地图…"}</p>
            )}
          </section>
          <div className={styles.tables}>
            <section>
              <h2><Globe2 aria-hidden="true" />国家 / 地区</h2>
              <table>
                <thead>
                  <tr>
                    <th>来源</th>
                    <th>访客</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.countries.map((row) => (
                    <tr key={row.code}>
                      <td>{countryName(row)}</td>
                      <td>{row.count.toLocaleString("zh-CN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!stats.countries.length && (
                <p className={styles.noData}>暂无国家与地区数据</p>
              )}
            </section>
            <section>
              <h2><MapPin aria-hidden="true" />省份 / 州</h2>
              <table>
                <thead>
                  <tr>
                    <th>来源</th>
                    <th>访客</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.regions.map((row) => (
                    <tr key={row.code}>
                      <td>{regionName(row)}</td>
                      <td>{row.count.toLocaleString("zh-CN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!stats.regions.length && (
                <p className={styles.noData}>暂无省份与州数据</p>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
