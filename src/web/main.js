import "./styles.css";

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
let wifiQr = loadWifiQr();
let previousStateKey = "";
let lastStageCropKey = "";
let audioContext = null;

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
const IMAGE_VARIANTS = [
  ["mixed", "随机"],
  ["normal", "训练前"],
  ["trained", "训练后"],
];
const FACE_CROP_MODES = [
  ["auto", "跟随难度"],
  ["none", "不限制"],
  ["avoid", "避开人脸"],
  ["prefer", "优先人脸"],
  ["only", "只切人脸"],
];

render();
if (!["login", "qr"].includes(route)) connect();
registerServiceWorker();
document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", handleGlobalShortcut);

function normalizeRoute(pathname) {
  const routeName = pathname.replace(/^\/+/, "").split("/")[0];
  if (["player", "solo", "host", "settings", "login", "qr"].includes(routeName)) return routeName;
  return "player";
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
      if (route === "settings" && settingsDirty) return;
      if (route === "settings" && settingsSaving) settingsSaving = false;
      render();
    } else if (message.type === "authRequired" && ["host", "settings"].includes(route)) {
      location.href = "/login";
    }
  });
}

function command(command, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "command", command, payload }));
}

function render() {
  if (route === "login") renderLogin();
  else if (route === "qr") renderQr();
  else if (route === "solo") renderSolo();
  else if (route === "host") renderHost();
  else if (route === "settings") renderSettings();
  else renderPlayer();
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
        { title: "自己玩模式", tag: "Solo", url: pages.solo, note: "扫码直接进入单人答题页" },
        { title: "入口总览", tag: "QR", url: pages.qr, note: "重新打开这张二维码页" },
      ]
    : [
        { title: "玩家页", tag: "Player", url: pages.player, note: "给玩家或展示屏扫码打开" },
        { title: "主持登录", tag: "Host", url: pages.login, note: "主持扫码后输入密码进入后台" },
        { title: "设置页", tag: "Setup", url: pages.settings, note: "开场前调整规则和显示选项" },
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
            <span>填入现场热点信息后，可以和玩家入口一起打印。</span>
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
        <p>${escapeHtml(item.note)}</p>
      </div>
      <img src="/api/qr?text=${encodeURIComponent(item.url)}" alt="${escapeAttr(item.title)}二维码" />
      <code>${escapeHtml(item.url)}</code>
    </article>
  `;
}

function pageUrlsFromOrigin(origin) {
  return {
    player: `${origin}/player`,
    login: `${origin}/login`,
    host: `${origin}/host`,
    settings: `${origin}/settings`,
    solo: `${origin}/solo`,
    qr: `${origin}/qr`,
  };
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
          ${loginError ? `<div class="login-error">${loginError}</div>` : ""}
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

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: form.get("password") || "" }),
    });

    if (response.ok) {
      location.href = "/host";
      return;
    }

    loginError = "密码错误";
    renderLogin();
  });
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
        </div>
        <div class="shortcut-strip">
          <span>空格 下一题</span>
          <span>R 重切</span>
          <span>V 揭晓</span>
          <span>Enter 答对</span>
          <span>Backspace 答错</span>
          <span>S 跳过</span>
          <span>U 撤销</span>
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
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  });
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
          ${selectField("cardImageVariant", "卡面版本", settings.cardImageVariant, IMAGE_VARIANTS)}
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

  app.querySelector("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    settingsDirty = false;
    settingsSaving = true;
    command("settings", {
      mode: form.get("mode"),
      difficulty: form.get("difficulty"),
      faceCropMode: form.get("faceCropMode"),
      cardImageVariant: form.get("cardImageVariant"),
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

  app.querySelector("#settingsForm").addEventListener("input", () => {
    settingsDirty = true;
  });

  app.querySelector("#settingsForm").addEventListener("change", () => {
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
    await fetch("/api/logout", { method: "POST" });
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
          <a class="community-link" href="https://qm.qq.com/q/6ytGE7qIWQ" target="_blank" rel="noreferrer">
            <span>湘潭同好会</span>
            <strong>加入群聊</strong>
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
          <span>${item.result === "correct" ? "✓" : "!"}</span>
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
      <div><span>筛选卡池</span><strong>${health.filteredCards ?? "--"}</strong></div>
      <div><span>本地缓存</span><strong>${health.cachedSets ?? "--"}/${health.totalCards ?? "--"}</strong></div>
      <div><span>缓存比例</span><strong>${health.cachePercent ?? "--"}%</strong></div>
      <div><span>玩家连接</span><strong>${health.roleCounts?.player ?? 0}</strong></div>
      <div><span>主持连接</span><strong>${health.roleCounts?.host ?? 0}</strong></div>
      <div><span>下一题预载</span><strong>${health.preloaded ? "就绪" : "等待"}</strong></div>
      <div><span>人脸框数据</span><strong>${health.faceBoxImages ?? 0}</strong></div>
      <div><span>当前人脸策略</span><strong>${faceModeLabel(health.effectiveFaceCropMode)}</strong></div>
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
