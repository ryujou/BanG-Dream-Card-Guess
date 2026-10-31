import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowLeft, Eye, EyeOff, LogIn } from "lucide-react";
import { errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { resolveHomeTheme, themeHref } from "../lib/home-theme";
import { Reveal } from "../components/Reveal";
import styles from "./Login.module.css";

export function LoginPage() {
  const [params] = useSearchParams();
  const themeId = resolveHomeTheme(params.toString());
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const rawNext = params.get("next") || themeHref("/host", themeId);
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(rawNext) ? rawNext : "/host";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to={next} replace />;
  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate(next, { replace: true });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.layout}>
      <section className={styles.poster}>
        <span>
          LET'S
          <br />
          <em>MAKE</em>
          <br />
          SOME
          <br />
          NOISE.
        </span>
        <p>让热爱，在湘潭相遇。</p>
        <img src="/brand/kasumi.png" alt="户山香澄" />
      </section>
      <Reveal className={styles.formSection}>
        <Link className="text-link" to={themeHref("/", themeId)}>
          <ArrowLeft size={16} />
          返回首页
        </Link>
        <LogIn className={styles.loginIcon} />
        <h1>舞台交给你。</h1>
        <p>主持与管理员登录</p>
        <form onSubmit={handleLogin}>
          <label htmlFor="username">
            账号
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label htmlFor="password">
            密码
            <div className={styles.password}>
              <input
                id="password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={visible ? "隐藏密码" : "显示密码"}
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <button className="button pink" disabled={busy} type="submit">
            {busy ? "正在登录" : "进入主持台"} <ArrowRight size={19} />
          </button>
        </form>
        <p className={styles.playerHint}>
          来玩游戏？
          <Link to="/games">
            直接加入房间，无需登录 <ArrowUpRightIcon />
          </Link>
        </p>
      </Reveal>
    </main>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M5 19 19 5M5 5h14v14" />
    </svg>
  );
}
