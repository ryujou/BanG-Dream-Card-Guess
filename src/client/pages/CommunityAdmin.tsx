import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useCommunity } from "../features/community/useCommunity";
import { CommunityEditor } from "../features/community/CommunityEditor";
import styles from "./Community.module.css";

export function CommunityAdminPage() {
  const auth = useAuth();
  const allowed = auth.user?.role === "super_admin";
  const { data, error, loading } = useCommunity(!auth.loading && allowed);
  return <main className={`${styles.page} ${styles.adminPage}`}>
    <header className={styles.adminHeader}>
      <div>
        <p className={styles.eyebrow}>COMMUNITY / EDITOR</p>
        <h1>
          内容管理<span>。</span>
        </h1>
        <p>把最近的见面、成员和回忆分享给大家。</p>
      </div>
      <Link className={styles.secondary} to="/community">
        查看社区页面 ↗
      </Link>
    </header>
    {(error || auth.error) && <p className={styles.error} role="alert">{error || auth.error}</p>}
    {auth.loading ? <p className={styles.empty}>正在加载…</p> : !allowed ? (
      <div className={styles.empty}><h2>此页面仅限管理员</h2>
        {!auth.user ? <Link to="/login?next=/community-admin" className={styles.button}>登录 ↗</Link> : <Link to="/host" className={styles.button}>回到主持控制台 ↗</Link>}
      </div>
    ) : loading || !data ? <p className={styles.empty}>{error ? "内容加载失败。" : "正在加载…"}</p> : <CommunityEditor initial={data} />}
  </main>;
}
