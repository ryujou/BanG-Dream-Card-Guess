import { Suspense, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import { Check, LogOut, Menu, UserRound, X } from "lucide-react";
import { Brand, Star } from "./components/Brand";
import { CharacterCursor } from "./components/CharacterCursor";
import { HOME_THEMES, buildHomeThemeSearch, homeThemeStyle, resolveHomeTheme, themeHref, type HomeThemeId } from "./lib/home-theme";
import { useAuth } from "./lib/auth";
import { errorText } from "./lib/api";
import { AppRoutes } from "./routes";
export default function App() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const { user, logout: signOut } = useAuth();
  const [menu, setMenu] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const isHome = location.pathname === "/" || location.pathname === "/home";
  const themeId = resolveHomeTheme(location.search);
  const theme = HOME_THEMES[themeId];
  const themed = (href: string) => themeHref(href, themeId);
  useEffect(() => {
    document.documentElement.dataset.gameTheme = themeId;
    return () => { delete document.documentElement.dataset.gameTheme; };
  }, [themeId]);
  useEffect(() => {
    const previous = document.title;
    document.title = `湘潭 ${theme.brand} 同好会`;
    return () => { document.title = previous; };
  }, [isHome, theme.brand]);
  function changeTheme(next: HomeThemeId) {
    if (themeId === next) return;
    navigate({ pathname: location.pathname, search: buildHomeThemeSearch(location.search, next), hash: location.hash });
  }
  useEffect(() => {
    setMenu(false);
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    const src = import.meta.env.VITE_UMAMI_SCRIPT_URL,
      id = import.meta.env.VITE_UMAMI_WEBSITE_ID;
    if (!src || !id) return;
    const script = document.createElement("script");
    script.defer = true;
    script.src = src;
    script.setAttribute("data-website-id", id);
    document.head.appendChild(script);
    return () => script.remove();
  }, []);
  async function logout() {
    setError("");
    try {
      await signOut();
      navigate(themed("/"));
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      {isHome && <CharacterCursor themeId={themeId} character={theme.cursor} />}
      <a className="skip-link" href="#main-content">
        跳转到内容
      </a>
      <header className={`site-header ${isHome ? "home-header" : ""}`}
        style={isHome ? homeThemeStyle(theme) : undefined}
        data-home-theme={isHome ? themeId : undefined}
        onKeyDown={(event) => {
          if (menu && event.key === "Escape") {
            setMenu(false);
            menuToggle.current?.focus();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false);
        }}
      >
        <Brand name={theme.brand} to={themed("/")} />
        {isHome && (
          <div className="home-theme-switch" role="group" aria-label="首页主题">
            {(Object.keys(HOME_THEMES) as HomeThemeId[]).map(id => (
              <button type="button" key={id} data-theme={id} aria-pressed={themeId === id} onClick={() => changeTheme(id)}>
                <Check size={14} aria-hidden="true" />{HOME_THEMES[id].label}
              </button>
            ))}
          </div>
        )}
        <div className="header-actions">
          <Link className="host-link" to={user ? themed("/host") : themed(`/login?next=${encodeURIComponent(themed("/host"))}`)}>
            <UserRound size={19} />
            <span>{user ? user.displayName : "主持登录"}</span>
          </Link>
          {user && (
            <button
              className="icon-button logout"
              onClick={() => void logout()}
              aria-label="退出登录"
            >
              <LogOut size={17} />
            </button>
          )}
          <button
            ref={menuToggle}
            className="icon-button menu-toggle"
            onClick={() => setMenu((v) => !v)}
            aria-label={menu ? "关闭菜单" : "打开菜单"}
            aria-expanded={menu}
            aria-controls="primary-navigation"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
        <nav id="primary-navigation" className={menu ? "nav is-open" : "nav"} aria-label="主要导航">
          <NavLink to={themed("/games")}>游戏</NavLink>
          <NavLink to={themed("/community")}>活动</NavLink>
          <NavLink to={themed("/shop")}>周边</NavLink>
          <NavLink to={themed("/stats")}>访问地图</NavLink>
          <Link className="mobile-host" to={user ? themed("/host") : themed(`/login?next=${encodeURIComponent(themed("/host"))}`)}>
            {user ? "主持台" : "主持登录"}
          </Link>
          {user && (
            <button className="mobile-logout" onClick={() => void logout()}>
              <LogOut size={17} aria-hidden="true" />退出登录
            </button>
          )}
        </nav>
      </header>
      {error && (
        <p className="alert container" role="alert">
          {error}
        </p>
      )}
      <div id="main-content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Suspense
              fallback={
                <div className="page-loading" role="status">
                  <span className="spinner" />
                  {themeId === "bluearchive" ? "正在准备夏莱…" : "正在准备舞台…"}
                </div>
              }
            >
              <AppRoutes location={location} />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
      {location.pathname !== "/" && (
        <footer className="site-footer">
          <Brand name={theme.brand} to={themed("/")} />
          <p>因为{themeId === "bluearchive" ? "热爱" : "音乐"}，让湘潭的我们相遇。</p>
          <span className="footer-signature">
            {themeId === "bluearchive" ? "Stories for" : "Live for"}
            <br />A brighter tomorrow.
            <Star />
          </span>
          <small>
            {theme.brand} 非官方同好会 · 角色及游戏素材版权归原权利方所有
          </small>
        </footer>
      )}
    </MotionConfig>
  );
}
