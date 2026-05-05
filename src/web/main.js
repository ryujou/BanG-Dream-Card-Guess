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

render();
if (route !== "login") connect();

function normalizeRoute(pathname) {
  const routeName = pathname.replace(/^\/+/, "").split("/")[0];
  if (["player", "solo", "host", "settings", "login"].includes(routeName)) return routeName;
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
  else if (route === "solo") renderSolo();
  else if (route === "host") renderHost();
  else if (route === "settings") renderSettings();
  else renderPlayer();
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
            <button type="button" id="logoutButton">退出</button>
          </div>
        </div>

        <form id="settingsForm" class="settings-grid">
          ${selectField("mode", "模式", settings.mode, [
            ["single", "单人挑战"],
            ["versus", "双队互动"],
          ])}
          ${numberField("roundSeconds", "每题秒数", settings.roundSeconds, 10, 300)}
          ${numberField("questionsPerPlayer", "每人题数", settings.questionsPerPlayer, 1, 30)}
          ${numberField("cropSize", "裁剪尺寸", settings.cropSize, 60, 260)}
          ${numberField("candidateCount", "智能候选数", settings.candidateCount, 30, 300)}
          ${numberField("maxRecrops", "最大重切", settings.maxRecrops, 0, 20)}
          ${numberField("correctPoints", "答对加分", settings.correctPoints, 0, 100)}
          ${numberField("wrongPenalty", "答错扣分", settings.wrongPenalty, 0, 100)}
          ${numberField("autoNextDelay", "自动下一题延迟(ms)", settings.autoNextDelay, 300, 10000)}
          ${textField("teamAName", "A 队名称", game.teams?.A?.name || "A 队")}
          ${textField("teamBName", "B 队名称", game.teams?.B?.name || "B 队")}
          ${checkField("allowRecrop", "允许重切", settings.allowRecrop)}
          ${checkField("showPlayerRecrop", "玩家页显示重切", settings.showPlayerRecrop)}
          ${checkField("showTimer", "显示倒计时", settings.showTimer)}
          ${checkField("revealAfterJudge", "判定后揭晓答案", settings.revealAfterJudge)}
          ${checkField("streakBonus", "连击加分", settings.streakBonus)}
          ${checkField("autoNext", "自动下一题", settings.autoNext)}
          <div class="settings-actions">
            <button class="primary" type="submit">保存设置</button>
            <button type="button" id="resetGame">重置游戏</button>
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
      roundSeconds: form.get("roundSeconds"),
      questionsPerPlayer: form.get("questionsPerPlayer"),
      cropSize: form.get("cropSize"),
      candidateCount: form.get("candidateCount"),
      maxRecrops: form.get("maxRecrops"),
      correctPoints: form.get("correctPoints"),
      wrongPenalty: form.get("wrongPenalty"),
      autoNextDelay: form.get("autoNextDelay"),
      teamAName: form.get("teamAName"),
      teamBName: form.get("teamBName"),
      allowRecrop: form.has("allowRecrop"),
      showPlayerRecrop: form.has("showPlayerRecrop"),
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

  app.querySelector("#resetGame").addEventListener("click", () => command("reset"));
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
        <a class="community-link" href="https://qm.qq.com/q/6ytGE7qIWQ" target="_blank" rel="noreferrer">
          <span>湘潭同好会</span>
          <strong>加入群聊</strong>
        </a>
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
        ${game?.loading ? `<div class="crop-tile skeleton"></div>` : crop ? `<div class="crop-tile"><img src="${crop.image}" alt="裁剪卡面" /></div>` : `<div class="empty-state"><span>?</span></div>`}
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

function checkField(name, label, checked) {
  return `
    <label class="setting-check">
      <input name="${name}" type="checkbox" ${checked ? "checked" : ""} />
      <span>${label}</span>
    </label>
  `;
}

function escapeAttr(value) {
  return String(value).replace(/[&"]/g, (char) => ({ "&": "&amp;", '"': "&quot;" }[char]));
}
