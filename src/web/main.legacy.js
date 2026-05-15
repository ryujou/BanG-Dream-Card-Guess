/**
 * 该文件为 Vue3 重构前遗留备份，当前入口不再引用。
 * This file is a legacy backup before Vue 3 refactoring. It is no longer imported by the entry point.
 */
import "./styles.css";

const COMMUNITY_URL = "https://qm.qq.com/q/6ytGE7qIWQ";
const HOME_ANNOUNCEMENTS = [
  "官方公告：湘潭 BanG Dream! 同好会现场互动入口已开放",
  "玩家可进入玩家页参与猜卡互动",
  "主持请从主持页登录后开始本轮游戏",
  "点击右侧按钮加入湘潭 BanG Dream! 同好会群聊",
];
const route = normalizeRoute(location.pathname);
const app = document.querySelector("#app");
let snapshot = null;
let socket = null;
let connected = false;
let loginError = "";
let soloGuess = "";
let settingsDirty = false;
let settingsSaving = false;
let qrInfo = null;
let qrLoading = false;
let qrError = "";
let queueScores = null;
let queueScoresLoading = false;
let queueScoreError = "";
let queueScoreEvents = null;
let queueScoresUpdatedAt = 0;
let queueAnimationFrame = 0;
let wifiQr = loadWifiQr();
let previousStateKey = "";
let lastStageCropKey = "";
let settingsInteractionUntil = 0;
let audioContext = null;
let communityData = null;
let communityAdminRendering = false;
let stopwatchLoader = null;

const DIFFICULTY_PRESETS = {
  easy: { label: "简单", cropSize: 230, candidateCount: 90 },
  normal: { label: "普通", cropSize: 180, candidateCount: 120 },
  hard: { label: "困难", cropSize: 130, candidateCount: 170 },
};
const ATTRIBUTE_LABELS = {
  cool: "Cool",
  happy: "Happy",
  powerful: "Powerful",
  pure: "Pure",
};
const FACE_CROP_MODES = [
  ["auto", "跟随难度"],
  ["none", "不限制"],
  ["avoid", "避开人脸"],
  ["prefer", "优先人脸"],
  ["only", "只切人脸"],
];
const STOPWATCH_DEFAULT_SETTINGS = { targetSeconds: 10, toleranceSeconds: 0.02 };

render();
if (!["home", "login", "qr", "note-shooter", "scores", "community-admin", "stopwatch-challenge", "bang-klotski"].includes(route)) connect();
registerServiceWorker();
document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", handleGlobalShortcut);

function normalizeRoute(pathname) {
  const segments = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const routeName = segments[0];
  if (!routeName) return "home";
  if (routeName === "play") return "player";
  if (routeName === "queue") return "note-shooter";
  if (routeName === "games" && segments[1] === "stopwatch-challenge") return "stopwatch-challenge";
  if (routeName === "games" && segments[1] === "bang-klotski") return "bang-klotski";
  if (["home", "player", "solo", "host", "settings", "login", "qr", "note-shooter", "scores", "community-admin", "stopwatch-challenge", "bang-klotski"].includes(routeName)) return routeName;
  return "home";
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/ws`);

  socket.addEventListener("open", () => {
    connected = true;
    socket.send(JSON.stringify({ type: "hello", role: route === "solo" ? "self" : route }));
    render();
  });

  socket.addEventListener("close", () => {
    connected = false;
    render();
    setTimeout(connect, 1200);
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "state") {
      maybePlayStateSound(message.state);
      snapshot = message.state;
      if (route === "settings") {
        if (settingsDirty || isSettingsInteractionActive()) return;
        if (settingsSaving) settingsSaving = false;
      }
      render();
    } else if (message.type === "authRequired" && ["host", "settings"].includes(route)) {
      location.href = "/login";
    } else if (message.type === "error") {
      alert(message.message || "操作失败");
      if (snapshot?.game) {
        snapshot.game.loading = false;
        if (snapshot.game.status === "loading") snapshot.game.status = "idle";
        render();
      }
    }
  });
}

function markSettingsInteraction(duration = 1800) {
  settingsInteractionUntil = Math.max(settingsInteractionUntil, Date.now() + duration);
}

function isSettingsInteractionActive() {
  return Date.now() < settingsInteractionUntil;
}

function command(command, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "command", command, payload }));
}

function render() {
  if (route === "home") renderHome();
  else if (route === "login") renderLogin();
  else if (route === "qr") renderQr();
  else if (route === "note-shooter") renderNoteShooter();
  else if (route === "scores") renderScores();
  else if (route === "solo") renderSolo();
  else if (route === "host") renderHost();
  else if (route === "settings") renderSettings();
  else if (route === "community-admin") renderCommunityAdmin();
  else if (route === "stopwatch-challenge") renderStopwatchChallenge();
  else if (route === "bang-klotski") renderBangKlotski();
  else renderPlayer();
}

async function renderHome() {
  if (!communityData) {
    try {
      const response = await fetch("/api/community");
      if (response.ok) communityData = await response.json();
    } catch (e) {
      console.error("Failed to load community data", e);
    }
  }

  const data = communityData || { aboutUs: "", members: [], events: [], socialLinks: [], photos: [] };
  
  app.innerHTML = `
    <main class="linktree-shell">
      <div class="linktree-container">
        <!-- Profile Header -->
        <header class="linktree-header">
          <div class="linktree-icon-grid">
            <img class="linktree-avatar" src="/icon5.png" alt="湘潭 BanG Dream! 同好会" />
            <img class="linktree-avatar" src="/icon4.png" alt="湘潭 BanG Dream! 同好会图标4" />
            <img class="linktree-avatar" src="/icon3.png" alt="湘潭 BanG Dream! 同好会图标3" />
          </div>
          <h1 class="linktree-title">湘潭 BanG Dream! 同好会</h1>
          ${data.aboutUs ? `<p class="linktree-bio">${escapeHtml(data.aboutUs)}</p>` : ''}
        </header>

        <!-- Primary Actions (Game Links) -->
        <section class="linktree-links">
          <a class="linktree-pill primary-pill" href="/player">
            <span class="pill-icon">🎮</span>
            <span class="pill-text">进入猜卡游戏 (玩家页)</span>
          </a>
          <a class="linktree-pill" href="/host">
            <span class="pill-icon">👑</span>
            <span class="pill-text">游戏控制台 (主持页)</span>
          </a>
          <a class="linktree-pill" href="/note-shooter">
            <span class="pill-icon">🎍</span>
            <span class="pill-text">打发时间: 音符射手</span>
          </a>
          <a class="linktree-pill" href="/games/stopwatch-challenge">
            <span class="pill-icon">⏱</span>
            <span class="pill-text">掐秒表挑战</span>
          </a>
          <a class="linktree-pill" href="/games/bang-klotski">
            <span class="pill-icon">🧩</span>
            <span class="pill-text">华容道小游戏</span>
          </a>
          <a class="linktree-pill" href="https://enldm.cyou/bangmap" target="_blank" rel="noreferrer">
            <span class="pill-icon">🗺️</span>
            <span class="pill-text">BanG Map 同好会地图</span>
          </a>
          <a class="linktree-pill highlight-pill" href="${COMMUNITY_URL}" target="_blank" rel="noreferrer">
            <span class="pill-icon">💬</span>
            <span class="pill-text">点击加入官方交流群</span>
          </a>
        </section>

        <!-- Custom Social Links -->
        ${data.socialLinks && data.socialLinks.length ? `
        <section class="linktree-section">
          <h2>更多平台</h2>
          <div class="linktree-links">
            ${data.socialLinks.map(link => `
              <a class="linktree-pill" href="${safeUrl(link.url)}" target="_blank" rel="noreferrer">
                <span class="pill-text">${escapeHtml(link.title)}</span>
              </a>
            `).join('')}
          </div>
        </section>` : ''}

        <!-- Members -->
        ${data.members && data.members.length ? `
        <section class="linktree-section">
          <h2>成员名单</h2>
          <div class="linktree-members">
            ${data.members.map(m => `
              <a class="member-pill" href="${safeUrl(m.url)}" target="_blank" rel="noreferrer">
                <strong>${escapeHtml(m.name)}</strong>
                <span>${escapeHtml(m.desc)}</span>
              </a>
            `).join('')}
          </div>
        </section>` : ''}

        <!-- Events -->
        ${data.events && data.events.length ? `
        <section class="linktree-section">
          <h2>近期活动</h2>
          <div class="linktree-events">
            ${data.events.map(e => `
              <div class="event-box">
                <div class="event-box-header">
                  <span class="event-date">${escapeHtml(e.date)}</span>
                  <span class="event-location">${escapeHtml(e.location)}</span>
                </div>
                <strong>${escapeHtml(e.title)}</strong>
                <p>${escapeHtml(e.desc)}</p>
              </div>
            `).join('')}
          </div>
        </section>` : ''}

        <!-- Photos -->
        ${data.photos && data.photos.length ? `
        <section class="linktree-section">
          <h2>活动回顾</h2>
          <div class="linktree-gallery">
            ${data.photos.map(p => `
              <img src="${safeUrl(p)}" alt="活动照片" loading="lazy" />
            `).join('')}
          </div>
        </section>` : ''}

        <footer class="linktree-footer">
          <img src="/icon.png" alt="logo" class="footer-logo" />
          <p>Powered by <a href="https://github.com/ryujou/BanG-Dream-Card-Guess" target="_blank" rel="noreferrer" style="color: inherit; font-weight: bold; text-decoration: none; border-bottom: 1px dashed currentColor; padding-bottom: 2px;">BanG Dream! Card Guess</a></p>
        </footer>
      </div>
    </main>
  `;
}

function renderQr() {
  if (!qrInfo && !qrLoading && !qrError) loadQrInfo();

  const fallbackPages = pageUrlsFromOrigin(location.origin);
  const info = qrInfo || {
    appMode: "booth",
    currentOrigin: location.origin,
    pages: fallbackPages,
    entries: [{ origin: location.origin, pages: fallbackPages, local: false }],
  };
  const primaryEntry = (info.entries || []).find((entry) => !entry.local) || {
    origin: info.currentOrigin,
    pages: info.pages || fallbackPages,
  };
  const pages = primaryEntry.pages || fallbackPages;
  const wifiText = wifiQr.ssid ? wifiQrText(wifiQr) : "";
  const qrCards = info.appMode === "solo"
    ? [
        { title: "自己玩模式", tag: "Solo", url: pages.solo },
        { title: "音符射手", tag: "Note Shooter", url: pages.noteShooter },
        { title: "入口总览", tag: "QR", url: pages.qr },
      ]
    : [
        { title: "玩家页", tag: "Player", url: pages.player },
        { title: "音符射手", tag: "Note Shooter", url: pages.noteShooter },
        { title: "主持登录", tag: "Host", url: pages.login },
        { title: "设置页", tag: "Setup", url: pages.settings },
      ];
  const lanEntries = (info.entries || []).filter((entry) => !entry.local);

  app.innerHTML = `
    <main class="qr-shell">
      <section class="qr-panel">
        <div class="qr-head">
          <div>
            <p class="eyebrow">Booth QR Codes</p>
            <h1>扫码入口</h1>
          </div>
          <div class="qr-actions">
            <button class="primary" id="printQr" type="button">打印</button>
            <a href="/note-shooter">音符射手</a>
            ${info.appMode === "solo" ? `<a href="/solo">自玩页</a>` : `<a href="/player">玩家页</a><a href="/login">主持登录</a>`}
          </div>
        </div>

        ${qrError ? `<div class="login-error">${escapeHtml(qrError)}</div>` : ""}
        <div class="qr-grid">
          ${qrCards.map(renderQrCard).join("")}
        </div>

        <div class="wifi-panel">
          <div>
            <strong>Wi-Fi 二维码</strong>
          </div>
          <form id="wifiForm" class="wifi-form">
            <input name="ssid" type="text" placeholder="Wi-Fi 名称" value="${escapeAttr(wifiQr.ssid)}" />
            <input name="password" type="text" placeholder="Wi-Fi 密码" value="${escapeAttr(wifiQr.password)}" />
            <select name="auth">
              <option value="WPA" ${wifiQr.auth === "WPA" ? "selected" : ""}>WPA/WPA2</option>
              <option value="nopass" ${wifiQr.auth === "nopass" ? "selected" : ""}>无密码</option>
            </select>
            <button class="primary" type="submit">生成 Wi-Fi 码</button>
          </form>
          ${wifiText ? `
            <div class="wifi-qr">
              <img src="/api/qr?text=${encodeURIComponent(wifiText)}" alt="Wi-Fi 二维码" />
              <code>${escapeHtml(wifiQr.ssid)}</code>
            </div>
          ` : ""}
        </div>

        ${lanEntries.length ? `
          <div class="qr-lan">
            <strong>检测到的局域网入口</strong>
            ${lanEntries.map((entry) => `<code>${escapeHtml(entry.pages?.player || `${entry.origin}/player`)}</code>`).join("")}
          </div>
        ` : ""}
      </section>
    </main>
  `;

  app.querySelector("#printQr")?.addEventListener("click", () => window.print());
  app.querySelector("#wifiForm")?.addEventListener("submit", handleWifiForm);
}

async function loadQrInfo() {
  qrLoading = true;
  try {
    const response = await fetch("/api/network");
    if (!response.ok) throw new Error("读取本机地址失败");
    qrInfo = await response.json();
  } catch (error) {
    qrError = error instanceof Error ? error.message : "读取本机地址失败";
  } finally {
    qrLoading = false;
    renderQr();
  }
}

function renderQrCard(item) {
  return `
    <article class="qr-card">
      <div>
        <span>${escapeHtml(item.tag)}</span>
        <h2>${escapeHtml(item.title)}</h2>
      </div>
      <img src="/api/qr?text=${encodeURIComponent(item.url)}" alt="${escapeAttr(item.title)}二维码" />
      <code>${escapeHtml(item.url)}</code>
    </article>
  `;
}

function pageUrlsFromOrigin(origin) {
  return {
    player: `${origin}/player`,
    noteShooter: `${origin}/note-shooter`,
    queue: `${origin}/note-shooter`,
    scores: `${origin}/scores`,
    login: `${origin}/login`,
    host: `${origin}/host`,
    settings: `${origin}/settings`,
    solo: `${origin}/solo`,
    qr: `${origin}/qr`,
  };
}

function renderNoteShooter() {
  cancelQueueLoop();
  app.innerHTML = `
    <main class="note-shooter-shell">
      <iframe
        class="note-shooter-frame"
        src="/note-shooter/bangdream.html"
        title="音符射手"
        allow="autoplay; fullscreen"
      ></iframe>
    </main>
  `;
}

function renderBangKlotski() {
  cancelQueueLoop();
  app.innerHTML = `
    <main class="bang-klotski-shell">
      <section class="bang-klotski-panel">
        <div class="bang-klotski-head">
          <div>
            <p class="eyebrow">Mini Game</p>
            <h1>BanG 华容道</h1>
          </div>
          <div class="qr-actions">
            <a href="/">返回首页</a>
          </div>
        </div>
        <div class="bang-klotski-frame-wrap">
          <iframe
            class="bang-klotski-frame"
            src="/games/bang-klotski/index.html"
            title="BanG Klotski Enhanced"
            allow="autoplay; fullscreen"
            loading="eager"
          ></iframe>
        </div>
        <p class="bang-klotski-credit">
          原仓库：<a href="https://github.com/KasumiAmi/BanGKlotski_Enhanced" target="_blank" rel="noreferrer">https://github.com/KasumiAmi/BanGKlotski_Enhanced</a>；本项目仅作为网页内嵌小游戏页面使用。
        </p>
      </section>
    </main>
  `;
}

function renderQueue() {
  renderNoteShooter();
}

function renderStopwatchChallenge() {
  app.innerHTML = `
    <main class="stopwatch-page" data-mode="idle">
      <section class="stopwatch-card stopwatch-card-minimal">
        <div class="stopwatch-display-wrap">
          <div class="stopwatch-target">加载中...</div>
        </div>
      </section>
    </main>
  `;
  if (!stopwatchLoader) stopwatchLoader = import("./stopwatch-challenge.js");
  stopwatchLoader
    .then((mod) => {
      if (route !== "stopwatch-challenge") return;
      mod.mountStopwatchChallenge(app);
    })
    .catch(() => {
      if (route !== "stopwatch-challenge") return;
      app.innerHTML = `<main class="login-shell"><section class="login-panel"><h1>加载失败</h1><p>请刷新后重试</p></section></main>`;
    });
}

function renderQueueLeaderboard(items) {
  if (!items.length) return `<div class="muted">暂无成绩</div>`;
  return `
    <ol class="queue-rank-list">
      ${items.map((item, index) => `
        <li>
          <span>${index + 1}</span>
          <strong>${escapeHtml(item.username)}</strong>
          <b>${Number(item.score) || 0}</b>
        </li>
      `).join("")}
    </ol>
  `;
}

function renderQueueRecent(items) {
  if (!items.length) return `<div class="muted">暂无记录</div>`;
  return `
    <div class="queue-recent-list">
      ${items.slice(0, 8).map((item) => `
        <div>
          <span>${escapeHtml(item.username)}</span>
          <strong>${Number(item.score) || 0}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderScores() {
  if (!queueScores && !queueScoresLoading && !queueScoreError) loadQueueScores();
  startQueueScoreStream();

  const leaderboard = queueScores?.leaderboard || [];
  const recent = queueScores?.recent || [];
  const updatedText = queueScoresUpdatedAt ? new Date(queueScoresUpdatedAt).toLocaleTimeString() : "等待同步";

  app.innerHTML = `
    <main class="queue-shell scores-shell">
      <section class="queue-panel scores-panel">
        <div class="queue-head scores-head">
          <div>
            <p class="eyebrow">Live Scores</p>
            <h1>成绩榜</h1>
          </div>
          <div class="qr-actions">
            <a href="/note-shooter">音符射手</a>
            <a href="/qr">二维码</a>
            <a href="/player">玩家页</a>
          </div>
        </div>

        <div class="score-live-meta">
          <strong>${queueScoresLoading ? "同步中" : "实时同步"}</strong>
          <span>最后更新 ${escapeHtml(updatedText)}</span>
          <span>总记录 ${Number(queueScores?.total) || 0}</span>
        </div>
        ${queueScoreError ? `<div class="login-error">${escapeHtml(queueScoreError)}</div>` : ""}

        <div class="scores-layout">
          <section class="score-main-board">
            <div class="queue-board-head">
              <strong>排行榜</strong>
              <button id="refreshQueueScores" type="button">刷新</button>
            </div>
            ${queueScoresLoading && !leaderboard.length ? `<div class="muted">读取中...</div>` : renderScoreLeaderboard(leaderboard, true)}
          </section>
          <aside class="score-recent-board">
            <div class="queue-board-head">
              <strong>最近成绩</strong>
              <span class="live-dot">LIVE</span>
            </div>
            ${renderScoreRecent(recent, true)}
          </aside>
        </div>
      </section>
    </main>
  `;

  app.querySelector("#refreshQueueScores")?.addEventListener("click", () => loadQueueScores(true));
  app.querySelector(".scores-layout")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-score]");
    if (!button) return;
    event.preventDefault();
    deleteNoteShooterScore({
      id: button.dataset.deleteScore || "",
      playerId: button.dataset.deletePlayer || "",
      scope: button.dataset.deleteScope || "",
    });
  });
}

function renderScoreLeaderboard(items, canDelete = false) {
  if (!items.length) return `<div class="muted">暂无成绩</div>`;
  return `
    <ol class="score-rank-list">
      ${items.map((item, index) => `
        <li class="${index < 3 ? "is-top" : ""}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(item.username)}</strong>
          <b>${Number(item.score) || 0}</b>
          <em>${formatQueueDuration(item.duration)}</em>
          ${canDelete ? `<button class="score-delete" type="button" data-delete-score="${escapeAttr(item.id)}" data-delete-player="${escapeAttr(item.playerId)}" data-delete-scope="player" aria-label="删除 ${escapeAttr(item.username)} 的全部成绩">删除</button>` : ""}
        </li>
      `).join("")}
    </ol>
  `;
}

function renderScoreRecent(items, canDelete = false) {
  if (!items.length) return `<div class="muted">暂无记录</div>`;
  return `
    <div class="score-recent-list">
      ${items.map((item) => `
        <article>
          <div>
            <strong>${escapeHtml(item.username)}</strong>
            <span>${formatQueueTime(item.at)}</span>
          </div>
          <b>${Number(item.score) || 0}</b>
          ${canDelete ? `<button class="score-delete" type="button" data-delete-score="${escapeAttr(item.id)}" aria-label="删除 ${escapeAttr(item.username)} 的成绩">删除</button>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

async function deleteNoteShooterScore({ id, playerId = "", scope = "" }) {
  if (!id && !playerId) return;
  try {
    const response = await apiFetch("/api/note-shooter-scores", {
      method: "DELETE",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ id, playerId, scope }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      if (response.status === 401) {
        location.href = `/login?next=${encodeURIComponent("/scores")}`;
        return;
      }
      throw new Error(result.message || "删除失败");
    }
    queueScores = result;
    queueScoresUpdatedAt = Date.now();
    queueScoreError = "";
    await loadQueueScores(true);
  } catch (error) {
    queueScoreError = error instanceof Error ? error.message : "删除失败";
  } finally {
    if (route === "scores") renderScores();
  }
}

function formatQueueDuration(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return seconds ? `${seconds}s` : "-";
}

function formatQueueTime(value) {
  const time = Number(value);
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleTimeString();
}

function startQueueScoreStream() {
  if (queueScoreEvents || !("EventSource" in window)) return;
  queueScoreEvents = new EventSource("/api/note-shooter-scores/events");
  queueScoreEvents.addEventListener("scores", (event) => {
    try {
      queueScores = JSON.parse(event.data);
      queueScoresUpdatedAt = Date.now();
      queueScoreError = "";
      if (route === "scores") renderScores();
    } catch {
      queueScoreError = "成绩数据解析失败";
    }
  });
  queueScoreEvents.onerror = () => {
    queueScoreError = "实时连接暂时中断，正在自动重连";
    if (route === "scores") renderScores();
  };
}

async function loadQueueScores(force = false) {
  if (queueScoresLoading && !force) return;
  queueScoresLoading = true;
  queueScoreError = "";
  try {
    const response = await fetch(`/api/note-shooter-scores?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("读取排行榜失败");
    queueScores = await response.json();
  } catch (error) {
    queueScoreError = error instanceof Error ? error.message : "读取排行榜失败";
  } finally {
    queueScoresLoading = false;
    if (route === "scores") renderScores();
  }
}

function cancelQueueLoop() {
  if (queueAnimationFrame) cancelAnimationFrame(queueAnimationFrame);
  queueAnimationFrame = 0;
}

function renderSolo() {
  const game = snapshot?.game;
  const settings = snapshot?.settings;
  const current = game?.current;
  const revealed = ["revealed", "finished"].includes(game?.status);
  const canPlay = game?.status === "playing";

  app.innerHTML = `
    <main class="shell player-shell">
      <section class="game-panel player-panel solo-panel">
        ${renderTopbar(game, settings, true)}
        ${revealed && current ? renderRevealStage(current, game) : renderStage(game)}
        <form class="solo-answer" id="soloAnswer">
          <input name="guess" type="text" placeholder="输入角色名或昵称" autocomplete="off" ${canPlay ? "" : "disabled"} value="${escapeAttr(soloGuess)}" />
          <button class="primary" type="submit" ${canPlay ? "" : "disabled"}>提交答案</button>
        </form>
        <div class="solo-controls">
          <button class="primary" data-command="start">${current ? "下一题" : "开始"}</button>
          <button data-command="recrop" ${!canPlay || !settings?.allowRecrop || game.recrops >= settings.maxRecrops ? "disabled" : ""}>重切 ${Math.max(0, (settings?.maxRecrops || 0) - (game?.recrops || 0))}</button>
          <button data-command="reveal" ${!current || game?.status === "idle" ? "disabled" : ""}>揭晓</button>
          <button class="danger" data-command="stop" ${game?.status === "idle" ? "disabled" : ""}>停止游戏</button>
          <button data-command="reset">重置</button>
        </div>
        <div class="player-result"><strong>${game?.message || "点击开始"}</strong></div>
      </section>
    </main>
  `;

  app.querySelector("#soloAnswer").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    soloGuess = "";
    command("selfGuess", { guess: form.get("guess") || "" });
  });

  app.querySelector("#soloAnswer input").addEventListener("input", (event) => {
    soloGuess = event.currentTarget.value;
  });

  app.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      soloGuess = "";
      command(button.dataset.command);
    });
  });
  bindFullscreenButton();
}

function renderLogin() {
  const nextPath = safeNextPath(new URLSearchParams(location.search).get("next"));
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-panel">
        <p class="eyebrow">Host Login</p>
        <h1>主持登录</h1>
        <form id="loginForm" class="login-form">
          <label class="setting-field">
            <span>主持密码</span>
            <input name="password" type="password" autocomplete="current-password" placeholder="输入主持密码" autofocus />
          </label>
          ${loginError ? `<div class="login-error">${escapeHtml(loginError)}</div>` : ""}
          <button class="primary" type="submit">登录</button>
          <a class="text-link" href="/player">返回玩家页</a>
        </form>
      </section>
    </main>
  `;

  app.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    loginError = "";

    const response = await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: form.get("password") || "" }),
    });

    if (response.ok) {
      location.href = nextPath;
      return;
    }

    loginError = "密码错误";
    renderLogin();
  });
}

function safeNextPath(value) {
  const next = String(value || "/host");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/host";
}

function renderPlayer() {
  const game = snapshot?.game;
  const settings = snapshot?.settings;
  const current = game?.current;
  const revealed = ["revealed", "finished"].includes(game?.status);
  const showRecropButton = settings?.showPlayerRecrop !== false;
  const canRecrop = game?.status === "playing" && settings?.allowRecrop && game.recrops < settings.maxRecrops;
  const recropsLeft = Math.max(0, (settings?.maxRecrops || 0) - (game?.recrops || 0));

  app.innerHTML = `
    <main class="shell player-shell">
      <section class="game-panel player-panel">
        ${renderTopbar(game, settings, true)}
        ${revealed && current ? renderRevealStage(current, game) : renderStage(game)}
        ${revealed || !showRecropButton ? "" : `
          <div class="player-controls">
            <button data-command="recrop" ${canRecrop ? "" : "disabled"}>重切 ${recropsLeft}</button>
          </div>
        `}
        ${revealed && current ? "" : `<div class="player-result"><strong>${game?.message || "等待主持开始"}</strong></div>`}
      </section>
    </main>
  `;

  app.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => command(button.dataset.command));
  });
  bindFullscreenButton();
}

function renderHost() {
  const game = snapshot?.game;
  const settings = snapshot?.settings;
  const current = game?.current;
  const canPlay = game?.status === "playing";
  const canReveal = current && game?.status !== "idle";
  const stopwatchSettings = {
    targetSeconds: Number(settings?.stopwatchTargetSeconds) || STOPWATCH_DEFAULT_SETTINGS.targetSeconds,
    toleranceSeconds: Number(settings?.stopwatchToleranceSeconds) || STOPWATCH_DEFAULT_SETTINGS.toleranceSeconds,
  };

  app.innerHTML = `
    <main class="shell host-shell">
      <section class="game-panel">
        ${renderTopbar(game, settings)}
        ${renderStage(game, { showStatus: true })}
        <div class="host-controls">
          <button class="primary" data-command="start">开始/下一题</button>
          <button data-command="recrop" ${!canPlay || !settings?.allowRecrop || game.recrops >= settings.maxRecrops ? "disabled" : ""}>重切 ${Math.max(0, (settings?.maxRecrops || 0) - (game?.recrops || 0))}</button>
          <button data-command="reveal" ${!canReveal ? "disabled" : ""}>揭晓</button>
          <button class="success" data-command="correct" ${!canPlay ? "disabled" : ""}>答对</button>
          <button class="danger" data-command="wrong" ${!canPlay ? "disabled" : ""}>答错</button>
          <button data-command="skip" ${!canPlay ? "disabled" : ""}>跳过</button>
          <button data-command="undo" ${!game?.canUndo ? "disabled" : ""}>撤销判定</button>
          <button class="danger" data-command="stop" ${game?.status === "idle" ? "disabled" : ""}>停止游戏</button>
        </div>
        <div class="shortcut-strip">
          <span>空格 下一题</span>
          <span>R 重切</span>
          <span>V 揭晓</span>
          <span>Enter 答对</span>
          <span>Backspace 答错</span>
          <span>S 跳过</span>
          <span>U 撤销</span>
          <span>Esc 停止</span>
        </div>
        ${settings?.mode === "versus" ? renderTeamSwitch(settings, game) : ""}
      </section>

      <aside class="side-panel">
        <div class="answer-card host-answer-card">
          ${current ? renderAnswerVisual(current, "答案") : `<div class="answer-placeholder">?</div>`}
        </div>
        <section class="compact-panel">
          <div class="panel-title">
            <span>主持信息</span>
            <div class="panel-links">
              <a class="text-link" href="/settings">设置</a>
              <a class="text-link" href="/qr">二维码</a>
              <button class="link-button" id="logoutButton" type="button">退出</button>
            </div>
          </div>
          <div class="answer-list">
            <span>正确答案</span>
            <strong>${current?.displayName || "未开始"}</strong>
            <small>${current?.acceptedAnswers?.slice(0, 10).join(" / ") || ""}</small>
          </div>
          <form id="hostStopwatchSettingsForm" class="host-mini-settings">
            <strong>掐秒表挑战设置</strong>
            <label class="setting-field">
              <span>目标时间（秒）</span>
              <input name="targetSeconds" type="number" min="1" max="99.99" step="0.01" value="${stopwatchSettings.targetSeconds.toFixed(2)}" />
            </label>
            <label class="setting-field">
              <span>允许误差（秒）</span>
              <input name="toleranceSeconds" type="number" min="0.01" max="99.99" step="0.01" value="${stopwatchSettings.toleranceSeconds.toFixed(2)}" />
            </label>
            <div class="host-mini-settings-actions">
              <button class="primary" type="submit">保存设置</button>
              <button id="hostStopwatchResetButton" type="button">重置默认</button>
            </div>
            <p id="hostStopwatchSettingsError" class="host-mini-settings-error"></p>
          </form>
          ${renderHistory(game)}
          <button class="reset-button" data-command="reset">重置本轮</button>
        </section>
      </aside>
    </main>
  `;

  app.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => command(button.dataset.command));
  });

  app.querySelectorAll("[data-team]").forEach((button) => {
    button.addEventListener("click", () => command("team", { team: button.dataset.team }));
  });

  app.querySelector("#logoutButton")?.addEventListener("click", async () => {
    await apiFetch("/api/logout", { method: "POST" });
    location.href = "/login";
  });

  app.querySelector("#hostStopwatchSettingsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const errorElement = app.querySelector("#hostStopwatchSettingsError");
    const targetRaw = String(form.get("targetSeconds") || "").trim();
    const toleranceRaw = String(form.get("toleranceSeconds") || "").trim();
    const target = Number(targetRaw);
    const tolerance = Number(toleranceRaw);

    if (!isStopwatchDecimal(targetRaw) || !Number.isFinite(target) || target < 1 || target > 99.99) {
      errorElement.textContent = "目标时间必须是 1.00 到 99.99 的正数，最多两位小数。";
      return;
    }
    if (!isStopwatchDecimal(toleranceRaw) || !Number.isFinite(tolerance) || tolerance <= 0) {
      errorElement.textContent = "允许误差必须是大于 0 的数字，最多两位小数。";
      return;
    }
    if (tolerance > target) {
      errorElement.textContent = "允许误差不能大于目标时间。";
      return;
    }

    command("settings", { stopwatchTargetSeconds: target, stopwatchToleranceSeconds: tolerance });
    errorElement.textContent = "已保存（服务端同步）";
  });

  app.querySelector("#hostStopwatchResetButton")?.addEventListener("click", () => {
    command("settings", {
      stopwatchTargetSeconds: STOPWATCH_DEFAULT_SETTINGS.targetSeconds,
      stopwatchToleranceSeconds: STOPWATCH_DEFAULT_SETTINGS.toleranceSeconds,
    });
  });
}

function isStopwatchDecimal(value) {
  return /^\d+(\.\d{1,2})?$/.test(value);
}

function renderSettings() {
  const settings = snapshot?.settings || {};
  const game = snapshot?.game || {};
  const meta = snapshot?.meta || {};
  const health = snapshot?.health || {};
  const bands = meta.bands || [];
  const rarities = meta.rarities || [1, 2, 3, 4, 5];
  const attributes = meta.attributes || ["cool", "happy", "powerful", "pure"];

  app.innerHTML = `
    <main class="settings-shell">
      <section class="settings-panel">
        <div class="settings-head">
          <div>
            <p class="eyebrow">Booth Settings</p>
            <h1>设置</h1>
          </div>
          <div class="nav-links">
            <a href="/player">玩家页</a>
            <a href="/host">主持页</a>
            <a href="/qr">二维码</a>
            <a href="/community-admin">同好会主页编辑</a>
            <button type="button" id="logoutButton">退出</button>
          </div>
        </div>

        <form id="settingsForm" class="settings-grid">
          ${selectField("mode", "模式", settings.mode, [
            ["single", "单人挑战"],
            ["versus", "双队互动"],
          ])}
          ${selectField("difficulty", "难度预设", settings.difficulty, Object.entries(DIFFICULTY_PRESETS).map(([id, preset]) => [id, preset.label]))}
          ${selectField("faceCropMode", "人脸策略", settings.faceCropMode, FACE_CROP_MODES)}
          ${numberField("roundSeconds", "每题秒数", settings.roundSeconds, 10, 300)}
          ${numberField("questionsPerPlayer", "每人题数", settings.questionsPerPlayer, 1, 30)}
          ${numberField("cropSize", "裁剪尺寸", settings.cropSize, 60, 260)}
          ${numberField("candidateCount", "智能候选数", settings.candidateCount, 30, 300)}
          ${numberField("maxRecrops", "最大重切", settings.maxRecrops, 0, 20)}
          ${numberField("avoidRecentCards", "卡面去重窗口", settings.avoidRecentCards, 0, 200)}
          ${numberField("avoidRecentCharacters", "角色去重窗口", settings.avoidRecentCharacters, 0, 40)}
          ${numberField("correctPoints", "答对加分", settings.correctPoints, 0, 100)}
          ${numberField("wrongPenalty", "答错扣分", settings.wrongPenalty, 0, 100)}
          ${numberField("autoNextDelay", "自动下一题延迟(ms)", settings.autoNextDelay, 300, 10000)}
          ${textField("teamAName", "A 队名称", game.teams?.A?.name || "A 队")}
          ${textField("teamBName", "B 队名称", game.teams?.B?.name || "B 队")}
          ${checkGroup("cardVariants", "特训状态 (都选或都不选等于混合)", settings.cardVariants, [["normal", "特训前"], ["trained", "特训后"]])}
          ${checkGroup("cardCharacterLimits", "卡面人数 (都选或都不选等于不限)", settings.cardCharacterLimits, [["single", "单人"], ["multiple", "多人"]])}
          ${checkGroup("cardBands", "乐队筛选", settings.cardBands, bands.map((band) => [band.id, band.name]))}
          ${checkGroup("cardRarities", "稀有度筛选", settings.cardRarities?.map(String), rarities.map((rarity) => [String(rarity), `${rarity} 星`]))}
          ${checkGroup("cardAttributes", "属性筛选", settings.cardAttributes, attributes.map((attribute) => [attribute, ATTRIBUTE_LABELS[attribute] || attribute]))}
          ${checkField("allowRecrop", "允许重切", settings.allowRecrop)}
          ${checkField("showPlayerRecrop", "玩家页显示重切", settings.showPlayerRecrop)}
          ${checkField("soundEnabled", "启用音效", settings.soundEnabled)}
          ${checkField("showTimer", "显示倒计时", settings.showTimer)}
          ${checkField("revealAfterJudge", "判定后揭晓答案", settings.revealAfterJudge)}
          ${checkField("streakBonus", "连击加分", settings.streakBonus)}
          ${checkField("autoNext", "自动下一题", settings.autoNext)}
          ${renderHealthPanel(health)}
          <div class="settings-actions">
            <button class="primary" type="submit">保存设置</button>
            <button type="button" id="resetGame">重置游戏</button>
            <button type="button" id="exportSettings">导出设置</button>
            <button type="button" id="importSettings">导入设置</button>
            <input id="importSettingsFile" type="file" accept="application/json" hidden />
          </div>
        </form>
      </section>
  </main>
  `;

  const settingsForm = app.querySelector("#settingsForm");
  settingsForm.addEventListener("pointerdown", (event) => {
    if (event.target.closest("select, input, button, label")) markSettingsInteraction(5000);
  }, true);
  settingsForm.addEventListener("focusin", () => markSettingsInteraction(300000));
  settingsForm.addEventListener("focusout", () => {
    settingsInteractionUntil = Date.now() + 600;
  });
  settingsForm.querySelectorAll("select").forEach((select) => {
    select.addEventListener("keydown", () => markSettingsInteraction(5000));
    select.addEventListener("change", () => {
      settingsInteractionUntil = Date.now() + 800;
    });
  });

  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    settingsDirty = false;
    settingsSaving = true;
      command("settings", {
        mode: form.get("mode"),
        difficulty: form.get("difficulty"),
        faceCropMode: form.get("faceCropMode"),
        roundSeconds: form.get("roundSeconds"),
      questionsPerPlayer: form.get("questionsPerPlayer"),
      cropSize: form.get("cropSize"),
      candidateCount: form.get("candidateCount"),
      maxRecrops: form.get("maxRecrops"),
      avoidRecentCards: form.get("avoidRecentCards"),
      avoidRecentCharacters: form.get("avoidRecentCharacters"),
      correctPoints: form.get("correctPoints"),
      wrongPenalty: form.get("wrongPenalty"),
      autoNextDelay: form.get("autoNextDelay"),
      teamAName: form.get("teamAName"),
      teamBName: form.get("teamBName"),
      cardVariants: form.getAll("cardVariants"),
      cardCharacterLimits: form.getAll("cardCharacterLimits"),
      cardBands: form.getAll("cardBands"),
      cardRarities: form.getAll("cardRarities"),
      cardAttributes: form.getAll("cardAttributes"),
      allowRecrop: form.has("allowRecrop"),
      showPlayerRecrop: form.has("showPlayerRecrop"),
      soundEnabled: form.has("soundEnabled"),
      showTimer: form.has("showTimer"),
      revealAfterJudge: form.has("revealAfterJudge"),
      streakBonus: form.has("streakBonus"),
      autoNext: form.has("autoNext"),
    });
  });

  settingsForm.addEventListener("input", () => {
    settingsDirty = true;
  });

  settingsForm.addEventListener("change", () => {
    settingsDirty = true;
  });

  app.querySelector("select[name='difficulty']").addEventListener("change", (event) => {
    const preset = DIFFICULTY_PRESETS[event.currentTarget.value];
    if (!preset) return;
    app.querySelector("input[name='cropSize']").value = preset.cropSize;
    app.querySelector("input[name='candidateCount']").value = preset.candidateCount;
    settingsDirty = true;
  });

  app.querySelector("#resetGame").addEventListener("click", () => command("reset"));
  app.querySelector("#exportSettings").addEventListener("click", exportSettings);
  app.querySelector("#importSettings").addEventListener("click", () => app.querySelector("#importSettingsFile").click());
  app.querySelector("#importSettingsFile").addEventListener("change", importSettingsFile);
  app.querySelector("#logoutButton").addEventListener("click", async () => {
    await apiFetch("/api/logout", { method: "POST" });
    location.href = "/login";
  });
}

function renderTopbar(game, settings, showCommunityLink = false) {
  return `
    <div class="topbar">
      <div>
        <p class="eyebrow">BanG Dream! Card Guess</p>
        <h1>邦邦猜</h1>
        ${connected ? "" : `<span class="screen-label">离线</span>`}
      </div>
      ${showCommunityLink ? `
        <div class="player-top-actions">
          <a class="community-link" href="${COMMUNITY_URL}" target="_blank" rel="noreferrer">
            <span>湘潭同好会</span>
            <strong>加入群聊</strong>
          </a>
          <a class="community-link queue-link" href="/note-shooter">
            <span>音符射手</span>
            <strong>开源小游戏</strong>
          </a>
          <button class="fullscreen-button" id="fullscreenButton" type="button" aria-label="进入全屏">
            <span>全屏</span>
          </button>
        </div>
      ` : ""}
      <div class="scoreboard" aria-label="score">
        <div><span>${game?.score ?? 0}</span><small>得分</small></div>
        <div><span>${game?.streak ?? 0}</span><small>连击</small></div>
        <div><span>${game?.total ?? 0}</span><small>回合</small></div>
      </div>
      ${settings?.mode === "versus" ? `
        <div class="team-score">
          <span>${game?.teams?.A?.name || "A 队"} ${game?.teams?.A?.score || 0}</span>
          <span>${game?.teams?.B?.name || "B 队"} ${game?.teams?.B?.score || 0}</span>
        </div>
      ` : ""}
    </div>
  `;
}

function renderStage(game) {
  const crop = game?.current?.crop;
  const cropKey = crop ? `${game?.current?.imageUrl || ""}:${crop.x}:${crop.y}:${crop.size}` : "";
  const isNewCrop = Boolean(cropKey && cropKey !== lastStageCropKey);
  if (cropKey) lastStageCropKey = cropKey;
  const status = statusText(game?.status);
  return `
    <div class="stage">
      <div class="status-strip">
        <div class="timer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3 2"></path>
          </svg>
          <span>${game?.leftSeconds ?? "--"}</span>
        </div>
        <div class="round-state">${status}</div>
      </div>
      <div class="crop-grid" aria-live="polite">
        ${game?.loading ? `<div class="crop-tile skeleton"></div>` : crop ? `<div class="crop-tile ${isNewCrop ? "is-new-crop" : ""}"><img src="${crop.image}" alt="裁剪卡面" /></div>` : `<div class="empty-state"><span>?</span></div>`}
      </div>
    </div>
  `;
}

function renderRevealStage(current, game) {
  return `
    <div class="reveal-stage">
      ${renderAnswerVisual(current, game?.message || "答案揭晓", true)}
    </div>
  `;
}

function renderAnswerVisual(current, badge, showCropMarker = false) {
  const marker = showCropMarker && current.crop && current.imageWidth && current.imageHeight
    ? `
      <span
        class="crop-marker"
        style="
          left: ${(current.crop.x / current.imageWidth) * 100}%;
          top: ${(current.crop.y / current.imageHeight) * 100}%;
          width: ${(current.crop.size / current.imageWidth) * 100}%;
          height: ${(current.crop.size / current.imageHeight) * 100}%;
        "
      ></span>
    `
    : "";

  return `
    <div class="answer-visual">
      <img class="answer-backdrop" src="${current.imageUrl}" alt="" aria-hidden="true" />
      <div
        class="answer-frame"
        style="
          --image-ratio: ${(current.imageWidth || 1) / (current.imageHeight || 1)};
          aspect-ratio: ${current.imageWidth || 1} / ${current.imageHeight || 1};
        "
      >
        <img class="answer-image" src="${current.imageUrl}" alt="${current.displayName || "答案"}" />
        ${marker}
      </div>
    </div>
    <div class="answer-meta">
      <span>${badge}</span>
      <strong>${current.displayName || ""}</strong>
    </div>
  `;
}

function renderTeamSwitch(settings, game) {
  return `
    <div class="team-switch">
      <button data-team="A" class="${settings.currentTeam === "A" ? "is-active" : ""}">${game.teams.A.name}</button>
      <button data-team="B" class="${settings.currentTeam === "B" ? "is-active" : ""}">${game.teams.B.name}</button>
    </div>
  `;
}

function renderHistory(game) {
  if (!game?.history?.length) return `<div class="muted">暂无记录</div>`;
  return `
    <div class="history">
      ${game.history.map((item) => `
        <div class="history-item ${item.result}">
          <span>${item.result === "correct" ? "?" : "!"}</span>
          <strong>${item.name}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function statusText(status) {
  return {
    idle: "READY",
    loading: "LOADING",
    playing: "PLAYING",
    revealed: "ANSWER",
    finished: "DONE",
  }[status] || "READY";
}

function numberField(name, label, value, min, max) {
  return `
    <label class="setting-field">
      <span>${label}</span>
      <input name="${name}" type="number" min="${min}" max="${max}" value="${value ?? ""}" />
    </label>
  `;
}

function textField(name, label, value) {
  return `
    <label class="setting-field">
      <span>${label}</span>
      <input name="${name}" type="text" value="${escapeAttr(value)}" />
    </label>
  `;
}

function selectField(name, label, value, options) {
  return `
    <label class="setting-field">
      <span>${label}</span>
      <select name="${name}">
        ${options.map(([id, text]) => `<option value="${id}" ${id === value ? "selected" : ""}>${text}</option>`).join("")}
      </select>
    </label>
  `;
}

function checkGroup(name, label, selected, options) {
  const selectedSet = new Set((selected || []).map(String));
  return `
    <fieldset class="setting-group">
      <legend>${label}</legend>
      <div>
        ${options.map(([id, text]) => `
          <label>
            <input name="${name}" type="checkbox" value="${escapeAttr(id)}" ${selectedSet.has(String(id)) ? "checked" : ""} />
            <span>${escapeHtml(text)}</span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `;
}

function checkField(name, label, checked) {
  return `
    <label class="setting-check">
      <input name="${name}" type="checkbox" ${checked ? "checked" : ""} />
      <span>${label}</span>
    </label>
  `;
}

function renderHealthPanel(health) {
  return `
    <section class="health-panel">
      <div><span>筛选卡池</span><strong>${escapeHtml(String(health.filteredCards ?? "--"))}</strong></div>
      <div><span>本地缓存</span><strong>${escapeHtml(String(health.cachedSets ?? "--"))}/${escapeHtml(String(health.totalCards ?? "--"))}</strong></div>
      <div><span>缓存比例</span><strong>${escapeHtml(String(health.cachePercent ?? "--"))}%</strong></div>
      <div><span>玩家连接</span><strong>${escapeHtml(String(health.roleCounts?.player ?? 0))}</strong></div>
      <div><span>主持连接</span><strong>${escapeHtml(String(health.roleCounts?.host ?? 0))}</strong></div>
      <div><span>下一题预载</span><strong>${health.preloaded ? "就绪" : "等待"}</strong></div>
      <div><span>人脸框数据</span><strong>${escapeHtml(String(health.faceBoxImages ?? 0))}</strong></div>
      <div><span>当前人脸策略</span><strong>${escapeHtml(String(faceModeLabel(health.effectiveFaceCropMode)))}</strong></div>
    </section>
  `;
}

function faceModeLabel(mode) {
  return FACE_CROP_MODES.find(([id]) => id === mode)?.[1] || mode || "--";
}

function exportSettings() {
  const payload = {
    settings: snapshot?.settings || {},
    teams: snapshot?.game?.teams || {},
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bangbangcai-settings.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importSettingsFile(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;

  try {
    const value = JSON.parse(await file.text());
    const imported = value.settings || value;
    const teams = value.teams || {};
    settingsDirty = false;
    settingsSaving = true;
    command("importSettings", {
      ...imported,
      teamAName: teams.A?.name || imported.teamAName,
      teamBName: teams.B?.name || imported.teamBName,
    });
  } catch {
    alert("设置文件格式不正确");
  } finally {
    event.currentTarget.value = "";
  }
}

function bindFullscreenButton() {
  app.querySelector("#fullscreenButton")?.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Some mobile browsers only allow fullscreen from installed PWA mode.
    }
  });
}

function handleGlobalShortcut(event) {

  if (route !== "host") return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

  const key = event.key.toLowerCase();
  if (["BUTTON", "A"].includes(document.activeElement?.tagName) && key === "enter") return;
  const shortcuts = {
    " ": "start",
    arrowright: "start",
    r: "recrop",
    v: "reveal",
    enter: "correct",
    backspace: "wrong",
    s: "skip",
    u: "undo",
    escape: "stop",
  };

  if (key === "1" || key === "2") {
    command("team", { team: key === "1" ? "A" : "B" });
    event.preventDefault();
    return;
  }

  const shortcut = shortcuts[key];
  if (!shortcut) return;
  command(shortcut);
  event.preventDefault();
}

function maybePlayStateSound(nextState) {
  if (!snapshot || !nextState?.settings?.soundEnabled) {
    previousStateKey = stateSoundKey(nextState);
    return;
  }

  const nextKey = stateSoundKey(nextState);
  if (!nextKey || nextKey === previousStateKey) return;
  previousStateKey = nextKey;

  const message = nextState.game?.message || "";
  if (message.includes("正确")) playTone([660, 880], 0.12);
  else if (message.includes("错误") || message.includes("时间到")) playTone([220, 160], 0.16);
  else if (nextState.game?.status === "revealed") playTone([520, 780], 0.1);
  else if (nextState.game?.status === "playing") playTone([440], 0.08);
}

function stateSoundKey(state) {
  return `${state?.game?.status || ""}:${state?.game?.message || ""}:${state?.game?.total || 0}`;
}

function unlockAudio() {
  if (!audioContext && window.AudioContext) audioContext = new AudioContext();
  audioContext?.resume?.();
}

function playTone(frequencies, duration) {
  unlockAudio();
  if (!audioContext) return;
  const now = audioContext.currentTime;
  frequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + index * duration);
    gain.gain.exponentialRampToValueAtTime(0.08, now + index * duration + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (index + 1) * duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + index * duration);
    oscillator.stop(now + (index + 1) * duration + 0.02);
  });
}

function loadWifiQr() {
  try {
    return { ssid: "", password: "", auth: "WPA", ...JSON.parse(localStorage.getItem("bangbangcai:wifi") || "{}") };
  } catch {
    return { ssid: "", password: "", auth: "WPA" };
  }
}

function handleWifiForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  wifiQr = {
    ssid: form.get("ssid") || "",
    password: form.get("password") || "",
    auth: form.get("auth") || "WPA",
  };
  localStorage.setItem("bangbangcai:wifi", JSON.stringify(wifiQr));
  renderQr();
}

function wifiQrText(value) {
  const auth = value.auth === "nopass" ? "nopass" : "WPA";
  return `WIFI:T:${auth};S:${escapeWifi(value.ssid)};P:${auth === "nopass" ? "" : escapeWifi(value.password)};;`;
}

function escapeWifi(value) {
  return String(value).replace(/([\\;,":])/g, "\\$1");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function apiFetch(input, init = {}) {
  const nextInit = { ...init };
  const method = String(nextInit.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = getCookieValue("bbc_csrf");
    if (csrf) nextInit.headers = { ...(nextInit.headers || {}), "X-CSRF-Token": csrf };
  }
  return fetch(input, nextInit);
}

function getCookieValue(name) {
  const cookie = document.cookie || "";
  const pairs = cookie.split(";").map((item) => item.trim());
  for (const pair of pairs) {
    if (!pair.startsWith(`${name}=`)) continue;
    return decodeURIComponent(pair.slice(name.length + 1));
  }
  return "";
}

let jsonEditorAssetsLoaded = false;
async function ensureJsonEditorAssets() {
  if (jsonEditorAssetsLoaded && window.JSONEditor) return;
  await import("@json-editor/json-editor/src/style.css");
  const mod = await import("@json-editor/json-editor/dist/jsoneditor.js");
  window.JSONEditor = window.JSONEditor || mod.default || mod.JSONEditor;
  if (!window.JSONEditor) throw new Error("JSONEditor load failed");
  jsonEditorAssetsLoaded = true;
}

function escapeAttr(value) {
  return String(value).replace(/[&"]/g, (char) => ({ "&": "&amp;", '"': "&quot;" }[char]));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function translateZh(key) {
  const map = {
    "Add row": "添加行",
    "Delete Last row": "删除最后一行",
    "Delete All": "全部删除",
    "Delete": "删除",
    "Move up": "上移",
    "Move down": "下移",
    // Array item labels
    "item": "项", "items": "项",
    // Button text labels
    "delete": "删除", "add": "添加",
    // Icon names used as button text when iconlib=null
    "moveup": "上移", "movedown": "下移",
    "remove": "删除", "copy": "复制",
    "edit": "编辑", "collapse": "收起", "expand": "展开",
    "up": "上移", "down": "下移",
    // Button titles (tooltips) — _title_short variants used as fallback when iconlib=null
    "button_add_row_title": "添加 {{0}}", "button_add_row_title_short": "添加",
    "button_delete_last_title": "删除最后一个 {{0}}",
    "button_delete_row_title": "删除 {{0}}", "button_delete_row_title_short": "删除",
    "button_move_up_title": "上移", "button_move_down_title": "下移",
    "button_move_up_title_short": "上移", "button_move_down_title_short": "下移",
    // Variant / legacy keys
    "button_delete": "删除", "button_delete_row": "删除",
    "button_move_down": "下移", "button_move_up": "上移",
    "button_add": "添加", "button_add_row": "添加 {{0}}",
    "button_delete_all": "全部删除",
    // Editor labels
    "not_set": "未设置", "choose": "选择...",
    // Collapse / expand
    "collapsed": "已收起", "button_collapse": "收起", "button_expand": "展开", "expand": "展开",
    // All validation errors
    "error_notset": "此属性必须设置", "error_notempty": "此项不能为空",
    "error_enum": "值必须在可选项中", "error_const": "值必须为固定常量",
    "error_anyOf": "值必须符合至少一条规则",
    "error_oneOf": "值必须恰好符合一条规则，当前符合 {{0}} 条",
    "error_not": "值不能符合此规则",
    "error_type_union": "值必须为允许的类型之一", "error_type": "值必须是 {{0}} 类型",
    "error_disallow_union": "值不能为禁止的类型之一", "error_disallow": "值不能是 {{0}} 类型",
    "error_multipleOf": "值必须是 {{0}} 的倍数",
    "error_maximum_excl": "值必须小于 {{0}}", "error_maximum_incl": "值最大为 {{0}}",
    "error_minimum_excl": "值必须大于 {{0}}", "error_minimum_incl": "值最小为 {{0}}",
    "error_maximum": "值最大为 {{0}}", "error_minimum": "值最小为 {{0}}",
    "error_maxLength": "最多 {{0}} 个字符", "error_minLength": "最少 {{0}} 个字符",
    "error_maxItems": "最多 {{0}} 项", "error_minItems": "最少 {{0}} 项",
    "error_maxProperties": "最多 {{0}} 个属性", "error_minProperties": "最少 {{0}} 个属性",
    "error_pattern": "值格式不匹配", "error_additionalItems": "不允许额外项目",
    "error_additionalProperties": "不允许额外属性",
    "error_dependency": "依赖条件不满足", "error_uniqueItems": "存在重复项",
    "error_format": "格式不正确", "error_required": "此项为必填",
    // Confirmation
    "are_you_sure_delete": "确定要删除吗？",
  };
  return map[key] || key;
}

async function renderCommunityAdmin() {
  if (communityAdminRendering) return;
  communityAdminRendering = true;
  const game = snapshot?.game;
  const settings = snapshot?.settings;
  
  if (!communityData) {
    try {
      const response = await fetch("/api/community");
      if (response.ok) communityData = await response.json();
    } catch (e) {
      console.error(e);
    }
  }
  
  const data = communityData || { aboutUs: "", members: [], events: [], socialLinks: [], photos: [] };

  app.innerHTML = `
    <main class="settings-shell">
      <section class="settings-panel linktree-admin-panel">
        ${renderTopbar(game, settings, false)}
        
        <div class="community-admin-header">
          <h2>主页可视化编辑</h2>
          <p>在这里修改主页的所有信息，修改完成后记得点击底部的保存按钮。</p>
        </div>

        <div id="jsonEditorContainer" class="json-editor-container"></div>
        
        <div class="admin-actions">
          <div class="upload-group">
            <label class="btn secondary">
              <span class="icon">📷</span> 上传照片墙图片...
              <input type="file" id="uploadImage" accept="image/*" style="display: none;" />
            </label>
            <span id="uploadStatus"></span>
          </div>
          
          <div class="save-group">
            <button id="saveCommunityBtn" class="btn primary">
              <span class="icon">💾</span> 立即保存发布
            </button>
            <span id="saveStatus"></span>
          </div>
        </div>
      </section>
    </main>
  `;

  // Dynamically load JSON Editor from CDN with fallback URLs
  if (!window.JSONEditor) {
    try {
      await ensureJsonEditorAssets();
    } catch (error) {
      alert(error instanceof Error ? error.message : "JSONEditor 资源加载失败");
      communityAdminRendering = false;
      return;
    }

    // Monkey-patch translate method to force Chinese for ALL keys
    const origTranslate = window.JSONEditor.prototype.translate;
    window.JSONEditor.prototype.translate = function (key, variables) {
      const zh = translateZh(key);
      if (zh !== key) {
        return variables ? zh.replace(/\{\{(\d+)\}\}/g, (_, i) => variables[i] || "") : zh;
      }
      return origTranslate.call(this, key, variables);
    };

    // Monkey-patch getButton — when iconlib=null, icon names become visible text
    // but they're not passed through translate(), so we pre-translate them
    const origGetButton = window.JSONEditor.prototype.getButton;
    window.JSONEditor.prototype.getButton = function (text, icon, title, variables) {
      if (text) {
        const zhText = translateZh(text);
        if (zhText !== text) text = zhText;
      }
      if (!this.options.iconlib && !text && icon) {
        var zhIcon = translateZh(icon);
        if (zhIcon !== icon) text = zhIcon;
      }
      if (title) {
        const zhTitle = translateZh(title);
        if (zhTitle !== title) title = zhTitle;
      }
      return origGetButton.call(this, text, icon, title, variables);
    };
  }

  const container = document.getElementById("jsonEditorContainer");
  const editor = new window.JSONEditor(container, {
    theme: "html",
    iconlib: null,
    disable_edit_json: true,
    disable_properties: true,
    disable_collapse: true,
    schema: {
      type: "object",
      title: "主页内容",
      properties: {
        aboutUs: {
          type: "string",
          title: "关于我们 (简介)",
          format: "textarea"
        },
        socialLinks: {
          type: "array",
          title: "更多社交平台链接",
          format: "table",
          items: {
            type: "object",
            properties: {
              title: { type: "string", title: "平台名称" },
              url: { type: "string", title: "链接地址" }
            }
          }
        },
        members: {
          type: "array",
          title: "成员名单",
          format: "table",
          items: {
            type: "object",
            properties: {
              name: { type: "string", title: "成员名字" },
              desc: { type: "string", title: "头衔/简介" },
              url: { type: "string", title: "个人主页链接" }
            }
          }
        },
        events: {
          type: "array",
          title: "近期活动预告",
          items: {
            type: "object",
            properties: {
              title: { type: "string", title: "活动标题" },
              date: { type: "string", title: "日期" },
              location: { type: "string", title: "地点" },
              desc: { type: "string", title: "详细描述", format: "textarea" }
            }
          }
        },
        photos: {
          type: "array",
          title: "照片墙 (图片直链)",
          items: {
            type: "string",
            title: "图片 URL",
            format: "url"
          }
        }
      }
    },
    startval: data
  });

  document.getElementById("uploadImage").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const status = document.getElementById("uploadStatus");
    status.textContent = "上传中...";
    
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        const res = await apiFetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 })
        });
        const json = await res.json();
        if (json.url) {
          status.textContent = "上传成功！请将下方的链接填入上面的【照片墙】中: " + json.url;
        } else {
          status.textContent = "上传失败: " + json.error;
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      status.textContent = "错误: " + err.message;
    }
  });

  document.getElementById("saveCommunityBtn").addEventListener("click", async () => {
    const status = document.getElementById("saveStatus");
    status.textContent = "保存中...";
    
    const errors = editor.validate();
    if (errors.length) {
      status.textContent = "请修正表单中的错误";
      status.style.color = "var(--color-error)";
      return;
    }

    try {
      const parsed = editor.getValue();
      const res = await apiFetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      if (res.ok) {
        communityData = parsed;
        status.textContent = "保存成功！";
        status.style.color = "var(--color-primary)";
      } else {
        const err = await res.json();
        status.textContent = "保存失败: " + err.error;
        status.style.color = "var(--color-error)";
      }
    } catch (e) {
      status.textContent = "保存出错。";
      status.style.color = "var(--color-error)";
    }
  });
  communityAdminRendering = false;
}

function safeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  try {
    const url = new URL(raw, location.origin);
    if (!["http:", "https:"].includes(url.protocol)) return "#";
    return escapeAttr(url.href);
  } catch {
    return "#";
  }
}





