import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Copy } from "lucide-react";
import { api, errorText } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { HOME_THEMES, resolveHomeTheme, themeHref } from "../lib/home-theme";
import styles from "./Game.module.css";

export function QrPage() {
  const [params] = useSearchParams();
  const themeId = resolveHomeTheme(useLocation().search);
  const code = params.get("room");
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<{ publicOrigin: string }>("/api/network")
      .then((data) => setOrigin(data.publicOrigin))
      .catch((e) => setError(errorText(e)));
  }, []);
  const url =
    origin + themeHref(code ? `/player?room=${encodeURIComponent(code)}` : "/games", themeId);
  async function copy() {
    try {
      await copyText(url);
      setCopied(true);
      setError("");
    } catch {
      setError("请选中下方地址手动复制");
    }
  }
  return (
    <main className="container page">
      <div className="page-heading">
        <h1>
          扫码，<em>一起开场。</em>
        </h1>
        <p>用同一网络下的手机打开链接，加入这场游戏。</p>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className={styles.qrPanel}>
        {origin ? (
          <img
            src={`/api/qr?text=${encodeURIComponent(url)}`}
            alt="加入游戏二维码"
            width={280}
            height={280}
          />
        ) : (
          <span className="spinner" />
        )}
        <div>
          <span>邀请朋友加入</span>
          <h2>{code ? `房间 ${code}` : `湘潭 ${HOME_THEMES[themeId].brand} 同好会`}</h2>
          <a href={url}>{url}</a>
          <button
            className="button"
            onClick={() => void copy()}
            disabled={!origin}
          >
            <Copy size={17} />
            {copied ? "已复制" : "复制链接"}
          </button>
        </div>
      </div>
    </main>
  );
}
