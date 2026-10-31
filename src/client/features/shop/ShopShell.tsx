import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { resolveHomeTheme, themeHref } from "../../lib/home-theme";
import { StageShapes } from "../../components/StageShapes";
import styles from "../../pages/Shop.module.css";

export function ShopShell({
  title,
  label,
  children,
  count,
  poster = false,
}: {
  title: string;
  label: string;
  children: ReactNode;
  count?: number;
  poster?: boolean;
}) {
  const themeId = resolveHomeTheme(useLocation().search);
  return (
    <main className={styles.page}>
      <header className={`${styles.heading} ${poster ? styles.poster : ""}`}>
        <div className={styles.headingText}>
          <p className={styles.eyebrow}>{label}</p>
          <h1 aria-label={title}>
            {poster ? (
              <>
                把热爱
                <br />
                <span className={styles.ribbon}>带回家。</span>
              </>
            ) : (
              <>
                {title}
                <span>.</span>
              </>
            )}
          </h1>
          {poster && (
            <p className={styles.handwritten}>Take a little love with you.</p>
          )}
        </div>
        {poster && (
          <div className={styles.stageArt}>
            <StageShapes shop />
          </div>
        )}
        <Link className={styles.cartLink} to={themeHref("/cart", themeId)}>
          购物清单 <b>{count ?? ""}</b> ↗
        </Link>
      </header>
      {children}
    </main>
  );
}

