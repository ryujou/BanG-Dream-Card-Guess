import { lazy } from "react";
import { Link, Navigate, Route, Routes, type Location } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { HomePage } from "./pages/Home";
import { GamesPage } from "./pages/Games";
import { HOME_THEMES, resolveHomeTheme, themeHref } from "./lib/home-theme";

const Host = lazy(() =>
  import("./pages/Host").then((m) => ({ default: m.HostPage })),
);
const Game = lazy(() =>
  import("./pages/Game").then((m) => ({ default: m.GamePage })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.SettingsPage })),
);
const Qr = lazy(() =>
  import("./pages/Qr").then((m) => ({ default: m.QrPage })),
);
const Login = lazy(() =>
  import("./pages/Login").then((m) => ({ default: m.LoginPage })),
);
const Community = lazy(() =>
  import("./pages/Community").then((m) => ({ default: m.CommunityPage })),
);
const CommunityAdmin = lazy(() =>
  import("./pages/CommunityAdmin").then((m) => ({ default: m.CommunityAdminPage })),
);
const Admin = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminUsersPage })),
);
const Shop = lazy(() =>
  import("./pages/Shop").then((m) => ({ default: m.ShopPage })),
);
const Product = lazy(() =>
  import("./pages/Product").then((m) => ({ default: m.ProductPage })),
);
const Cart = lazy(() =>
  import("./pages/Cart").then((m) => ({ default: m.CartPage })),
);
const Checkout = lazy(() =>
  import("./pages/Checkout").then((m) => ({ default: m.CheckoutPage })),
);
const Stats = lazy(() =>
  import("./pages/Stats").then((m) => ({ default: m.StatsPage })),
);
const Scores = lazy(() =>
  import("./pages/Scores").then((m) => ({ default: m.ScoresPage })),
);
const Diagnostics = lazy(() =>
  import("./pages/Diagnostics").then((m) => ({ default: m.DiagnosticsPage })),
);
const NoteShooter = lazy(() =>
  import("./pages/MiniGames").then((m) => ({ default: m.NoteShooterPage })),
);
const Klotski = lazy(() =>
  import("./pages/MiniGames").then((m) => ({ default: m.KlotskiPage })),
);
const Stopwatch = lazy(() =>
  import("./pages/MiniGames").then((m) => ({ default: m.StopwatchPage })),
);
const Mooncake = lazy(() =>
  import("./pages/MiniGames").then((m) => ({ default: m.MooncakePage })),
);

export function AppRoutes({ location }: { location: Location }) {
  const themeId = resolveHomeTheme(location.search);
  const theme = HOME_THEMES[themeId];
  const themed = (href: string) => themeHref(href, themeId);
  return (
    <Routes location={location}>
                <Route path="/" element={<HomePage theme={theme} themeId={themeId} />} />
                <Route path="/home" element={<Navigate to={`/${location.search}${location.hash}`} replace />} />
                <Route path="/games" element={<GamesPage />} />
                <Route
                  path="/join"
                  element={<Navigate to={`/games${location.search}${location.hash}`} replace />}
                />
                <Route path="/player" element={<Game />} />
                <Route
                  path="/play"
                  element={
                    <Navigate to={`/player${location.search}`} replace />
                  }
                />
                <Route path="/solo" element={<Game role="self" />} />
                <Route path="/host" element={<Host />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/qr" element={<Qr />} />
                <Route path="/login" element={<Login />} />
                <Route path="/community" element={<Community />} />
                <Route path="/community-admin" element={<CommunityAdmin />} />
                <Route path="/admin/users" element={<Admin />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/shop/:id" element={<Product />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/scores" element={<Scores />} />
                <Route path="/diagnostics" element={<Diagnostics />} />
                <Route path="/note-shooter" element={<NoteShooter />} />
                <Route
                  path="/queue"
                  element={<Navigate to="/note-shooter" replace />}
                />
                <Route path="/games/bang-klotski" element={<Klotski />} />
                <Route path="/games/ba-mooncake" element={<Mooncake />} />
                <Route
                  path="/bang-klotski"
                  element={<Navigate to="/games/bang-klotski" replace />}
                />
                <Route
                  path="/games/stopwatch-challenge"
                  element={<Stopwatch />}
                />
                <Route
                  path="/stopwatch-challenge"
                  element={<Navigate to="/games/stopwatch-challenge" replace />}
                />
                <Route
                  path="*"
                  element={
                    <main className="container page">
                      <div className="page-heading">
                        <h1>这里还没有舞台。</h1>
                        <p>页面不存在，回到首页继续探索。</p>
                        <Link className="button pink" to={themed("/")}>
                          回到首页 <ArrowUpRight size={18} />
                        </Link>
                      </div>
                    </main>
                  }
                />
              </Routes>
  );
}
