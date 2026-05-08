// BanG Dream! Card Guess - HTTP/WebSocket server
import { createServer } from "node:http";
import { readFileSync, existsSync, createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Jimp } from "jimp";
import QRCode from "qrcode";
import { WebSocketServer } from "ws";

import {
  dataDir, settingsStorePath, faceBoxesStorePath,
  BESTDORI_ORIGIN, BESTDORI_BASE,
  BAND_OPTIONS, BAND_BY_CHARACTER, RARITY_OPTIONS, ATTRIBUTE_OPTIONS,
  DIFFICULTY_PRESETS, FACE_CROP_MODES, MIME,
  defaultSettings, readPersistedConfig, readFaceBoxStore,
  arraySetting, numberArraySetting,
  persistedTeamName, roundConfigKey, effectiveFaceCropMode,
} from "./src/server/config.mjs";
import { AUTH_TOKEN, AUTH_COOKIE, HOST_PASSWORD, authenticatedSessions, isAuthenticated, verifyPassword } from "./src/server/auth.mjs";
import { smartCrop, faceBoxesFor } from "./src/server/crop.mjs";
import { originList, pageUrls, networkState, lanHosts } from "./src/server/network.mjs";
import {
  readQueueScores, writeQueueScores, readNoteShooterScores, writeNoteShooterScores,
  handleQueueScoreEvents, broadcastQueueScores,
  handleNoteShooterScoreEvents, broadcastNoteShooterScores,
  handleNoteShooterApi,
  queueScoreState, noteShooterScoreState,
  parseRequestPayload, readRequestBody,
  normalizeNoteShooterPlayerId, normalizeQueueUsername,
} from "./src/server/scores.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const publicDir = path.join(__dirname, "public");
const cardCacheDir = path.join(publicDir, "cards");
const resourceDir = path.join(__dirname, "resource");
const APP_MODE = process.env.APP_MODE === "solo" || process.argv.includes("--solo") ? "solo" : "booth";

// --- Data loading ---
const cards = JSON.parse(readFileSync(path.join(resourceDir, "all5_2.json"), "utf-8"));
const nicknames = JSON.parse(readFileSync(path.join(resourceDir, "nickname.json"), "utf-8"));
const faceBoxStore = readFaceBoxStore();
const cardPool = Object.entries(cards)
  .map(([id, card]) => ({ ...card, id }))
  .filter((card) => card?.resourceSetName && nicknames[String(card.characterId)]?.length);

// --- Settings ---
const persistedConfig = readPersistedConfig();
const settings = { ...defaultSettings, ...(persistedConfig.settings || {}) };
const persistLock = { timer: null };

// --- Game state ---
const game = {
  status: "idle", leftSeconds: settings.roundSeconds, loading: false,
  score: 0, streak: 0, total: 0, recrops: 0,
  cropHistory: [], recentCards: [], recentCharacters: [], undoStack: [],
  current: null, history: [],
  teams: { A: { name: persistedTeamName?.("A", "A 队") || "A 队", score: 0 }, B: { name: persistedTeamName?.("B", "B 队") || "B 队", score: 0 } },
  roundKey: "",
};
let timer = null;
let autoNextTimer = null;
let roundToken = 0;
let preparedRound = null;
let preparedRoundKey = "";
const clients = new Map();

// --- HTTP server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1`);

  // API routes
  if (url.pathname === "/api/health") return sendJson(res, healthSnapshot());
  if (url.pathname === "/api/network") return sendJson(res, networkState(req));
  if (url.pathname === "/api/queue-scores" && req.method === "GET") return sendJson(res, queueScoreState());
  if (url.pathname === "/api/queue-scores/events") return handleQueueScoreEvents(req, res);
  if (url.pathname === "/api/queue-scores" && req.method === "POST") {
    const body = parseRequestPayload(req, await readRequestBody(req));
    const username = normalizeQueueUsername(body.username);
    const score = Math.max(0, Math.min(999999, Math.floor(Number(body.score))));
    const duration = Math.max(0, Math.min(3600, Math.floor(Number(body.duration || 0))));
    if (!username || !Number.isFinite(score)) return sendJson(res, { ok: false, message: "用户名或分数无效" }, 400);
    const scores = readQueueScores();
    scores.unshift({ id: randomBytes(8).toString("hex"), username, score, duration, at: Date.now() });
    await writeQueueScores(scores);
    broadcastQueueScores();
    return sendJson(res, { ok: true, ...queueScoreState(scores) });
  }
  if (url.pathname.startsWith("/note-shooter-api/")) return handleNoteShooterApi(url, req, res);
  if (url.pathname === "/api/note-shooter-scores" && req.method === "GET") return sendJson(res, noteShooterScoreState());
  if (url.pathname === "/api/note-shooter-scores/events") return handleNoteShooterScoreEvents(req, res);
  if (url.pathname === "/api/note-shooter-scores" && req.method === "DELETE") {
    const body = parseRequestPayload(req, await readRequestBody(req));
    const password = String(body.password || "");
    const id = String(body.id || "").trim();
    const playerId = normalizeNoteShooterPlayerId(body.playerId);
    const scope = String(body.scope || "");

    if (!isAuthenticated(req) && !verifyPassword(password)) return sendJson(res, { ok: false, message: "权限不足" }, 401);
    if (!id && !playerId) return sendJson(res, { ok: false, message: "缺少成绩 ID" }, 400);

    const scores = readNoteShooterScores();
    const nextScores = scope === "player" && playerId
      ? scores.filter((entry) => entry.player_id !== playerId)
      : scores.filter((entry) => entry.id !== id);
    await writeNoteShooterScores(nextScores);
    broadcastNoteShooterScores();
    return sendJson(res, { ok: true });
  }
  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = parseRequestPayload(req, await readRequestBody(req));
    if (verifyPassword(body.password)) {
      authenticatedSessions.add(AUTH_TOKEN);
      res.setHeader("Set-Cookie", `${AUTH_COOKIE}=${AUTH_TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
      return sendJson(res, { ok: true });
    }
    return sendJson(res, { ok: false }, 403);
  }
  if (url.pathname === "/api/logout" && req.method === "POST") {
    authenticatedSessions.clear();
    return sendJson(res, { ok: true });
  }
  if (url.pathname === "/api/qr" && req.method === "GET") {
    const text = url.searchParams.get("text") || "";
    if (!text || text.length > 1024) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Missing or too long QR text");
    }
    try {
      const svg = await QRCode.toString(text, { type: "svg", width: 320, margin: 1, color: { dark: "#334462", light: "#FFFFFFFF" } });
      res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-cache" });
      return res.end(svg);
    } catch { return sendJson(res, { error: "生成失败" }, 500); }
  }

  // Bestdori proxy
  if (url.pathname.startsWith("/bestdori/")) return proxyBestdori(url, res);

  // Static files (public/ or dist/)
  return serveStatic(req.url, res);
});

// --- WebSocket ---
const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  let authenticated = isAuthenticated(req);

  ws.on("message", async (raw) => {
    try {
      const message = JSON.parse(String(raw));
      if (message.type === "hello") {
        const requestedRole = message.role || "player";
        if (requestedRole === "self" && APP_MODE === "solo") {
          clients.set(ws, { role: "self", authenticated: false });
        } else if (["host", "settings"].includes(requestedRole) && !authenticated) {
          clients.set(ws, { role: "player", authenticated: false });
          ws.send(JSON.stringify({ type: "authRequired" }));
        } else {
          clients.set(ws, { role: requestedRole, authenticated });
        }
        sendState(ws);
        return;
      }
      if (message.type === "auth") {
        authenticated = verifyPassword(message.password || "");
        const role = clients.get(ws)?.role || "player";
        clients.set(ws, { role, authenticated });
        ws.send(JSON.stringify({ type: "authResult", ok: authenticated }));
        if (authenticated) sendState(ws);
        return;
      }
      if (message.type === "command") {
        await handleCommand(ws, message.command, message.payload || {});
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "操作失败" }));
    }
  });
  ws.on("close", () => clients.delete(ws));
  sendState(ws);
});

// --- Command handler ---
async function handleCommand(ws, command, payload) {
  const client = clients.get(ws);
  const soloAllowed = APP_MODE === "solo" && client?.role === "self" && ["start", "next", "recrop", "reveal", "stop", "reset", "selfGuess"].includes(command);
  const playerAllowed = APP_MODE === "booth" && client?.role === "player" && command === "recrop";
  if (!client?.authenticated && !soloAllowed && !playerAllowed) throw new Error("请先登录主持端");

  switch (command) {
    case "start":
    case "next": await startRound(); break;
    case "recrop": await recrop(); break;
    case "correct": finishRound("correct"); break;
    case "wrong": finishRound("wrong"); break;
    case "skip": finishRound("skip"); break;
    case "undo": undoLastJudgement(); break;
    case "stop": stopGame(); break;
    case "reveal": clearAutoNext(); game.status = "revealed"; game.message = "答案揭晓"; stopTimer(); broadcast(); break;
    case "selfGuess": judgeSelfGuess(payload.guess); break;
    case "hideAnswer": if (game.status === "revealed") game.status = "playing"; game.message = "答案已隐藏"; broadcast(); break;
    case "reset": resetGame(); break;
    case "settings": updateSettings(payload); break;
    case "importSettings": updateSettings(payload); await saveSettings(); break;
    default: throw new Error(`未知命令: ${command}`);
  }
}

// --- Game functions ---
async function recrop() {
  if (!game.current || game.status !== "playing" || game.loading || !settings.allowRecrop || game.recrops >= settings.maxRecrops) return;
  game.loading = true;
  game.message = "重新裁剪中";
  broadcast();
  const image = await Jimp.read(game.current.sourceBuffer);
  const crop = await smartCrop(image, settings.cropSize, settings, game.cropHistory, game.current.faceBoxes || []);
  game.cropHistory.push(crop);
  game.current.crop = crop;
  game.recrops += 1;
  game.loading = false;
  game.message = "已重切";
  broadcast();
}

function finishRound(result) {
  if (!game.current || game.status !== "playing") return;
  clearAutoNext();
  game.undoStack.unshift(captureUndoState());
  game.undoStack = game.undoStack.slice(0, 8);
  stopTimer();
  game.total += 1;
  game.status = settings.revealAfterJudge ? "revealed" : "finished";
  if (result === "correct") {
    const bonus = settings.streakBonus ? game.streak : 0;
    const points = settings.correctPoints + bonus;
    game.score += points;
    game.streak += 1;
    if (settings.mode === "versus") game.teams[settings.currentTeam].score += points;
    game.message = "回答正确";
  } else {
    game.score = Math.max(0, game.score - settings.wrongPenalty);
    game.streak = 0;
    game.message = result === "wrong" ? "回答错误" : result === "timeout" ? "时间到" : "已跳过";
  }
  game.history.unshift({ result, name: game.current.displayName, team: settings.currentTeam, at: Date.now() });
  game.history = game.history.slice(0, 12);
  broadcast();
  if (settings.autoNext) {
    const token = roundToken;
    autoNextTimer = setTimeout(() => {
      autoNextTimer = null;
      if (token === roundToken && (game.status === "revealed" || game.status === "finished")) startRound();
    }, settings.autoNextDelay);
  }
}

function captureUndoState() {
  return {
    status: game.status, leftSeconds: game.leftSeconds, loading: game.loading,
    score: game.score, streak: game.streak, total: game.total,
    recrops: game.recrops,
    cropHistory: game.cropHistory.map((item) => ({ ...item })),
    recentCards: [...game.recentCards], recentCharacters: [...game.recentCharacters],
    current: game.current,
    history: game.history.map((item) => ({ ...item })),
    teams: { A: { ...game.teams.A }, B: { ...game.teams.B } },
    message: game.message,
  };
}

function undoLastJudgement() {
  const undo = game.undoStack.shift();
  if (!undo) return;
  stopTimer();
  clearAutoNext();
  Object.assign(game, undo);
  game.undoStack = game.undoStack.slice(0, 8);
  if (game.status === "playing") startTimer();
  broadcast();
}

function stopGame() {
  stopTimer();
  clearAutoNext();
  game.status = "stopped";
  game.message = "游戏已停止";
  game.current = null;
  broadcast();
}

function judgeSelfGuess(guess) {
  if (APP_MODE !== "solo" || !game.current || game.status !== "playing") return;
  const answer = normalizeAnswer(guess);
  if (!answer) { game.message = "请输入角色名或昵称"; broadcast(); return; }
  const match = game.current.acceptedAnswers.some((accepted) => accepted.toLowerCase() === answer.toLowerCase());
  finishRound(match ? "correct" : "wrong");
}

function normalizeAnswer(value) {
  return String(value || "").trim();
}

function resetGame() {
  stopTimer();
  clearAutoNext();
  game.status = "idle";
  game.score = 0;
  game.streak = 0;
  game.total = 0;
  game.current = null;
  game.history = [];
  game.undoStack = [];
  game.recrops = 0;
  game.cropHistory = [];
  game.recentCards = [];
  game.recentCharacters = [];
  game.teams = { A: { name: persistedTeamName?.("A", "A 队") || "A 队", score: 0 }, B: { name: persistedTeamName?.("B", "B 队") || "B 队", score: 0 } };
  game.message = "已重置";
  broadcast();
}

async function updateSettings(next) {
  const prevDifficulty = settings.difficulty;
  const prevSolo = settings.mode;

  if (next.mode !== undefined) settings.mode = ["single", "versus"].includes(next.mode) ? next.mode : settings.mode;
  if (next.difficulty !== undefined) settings.difficulty = ["easy", "normal", "hard"].includes(next.difficulty) ? next.difficulty : settings.difficulty;
  if (next.faceCropMode !== undefined) settings.faceCropMode = FACE_CROP_MODES.includes(next.faceCropMode) ? next.faceCropMode : settings.faceCropMode;
  if (next.roundSeconds !== undefined) settings.roundSeconds = Math.max(5, Math.min(600, Number(next.roundSeconds) || settings.roundSeconds));
  if (next.questionsPerPlayer !== undefined) settings.questionsPerPlayer = Math.max(1, Math.min(50, Number(next.questionsPerPlayer) || settings.questionsPerPlayer));
  if (next.cropSize !== undefined) settings.cropSize = Math.max(60, Math.min(260, Number(next.cropSize) || settings.cropSize));
  if (next.candidateCount !== undefined) settings.candidateCount = Math.max(10, Math.min(500, Number(next.candidateCount) || settings.candidateCount));
  if (next.maxRecrops !== undefined) settings.maxRecrops = Math.max(0, Math.min(10, Number(next.maxRecrops) || 0));
  if (next.correctPoints !== undefined) settings.correctPoints = Math.max(0, Number(next.correctPoints) || 0);
  if (next.wrongPenalty !== undefined) settings.wrongPenalty = Math.max(0, Number(next.wrongPenalty) || 0);
  if (next.autoNextDelay !== undefined) settings.autoNextDelay = Math.max(500, Math.min(30000, Number(next.autoNextDelay) || 1800));
  for (const key of ["allowRecrop", "showPlayerRecrop", "soundEnabled", "streakBonus", "showTimer", "revealAfterJudge", "autoNext"]) {
    if (next[key] !== undefined) settings[key] = !!next[key];
  }
  if (next.cardBands !== undefined) settings.cardBands = arraySetting(next.cardBands, defaultSettings.cardBands, BAND_OPTIONS.map((b) => b.id));
  if (next.cardRarities !== undefined) settings.cardRarities = numberArraySetting(next.cardRarities, defaultSettings.cardRarities, RARITY_OPTIONS);
  if (next.cardAttributes !== undefined) settings.cardAttributes = arraySetting(next.cardAttributes, defaultSettings.cardAttributes, ATTRIBUTE_OPTIONS);
  if (next.cardImageVariant !== undefined) settings.cardImageVariant = ["normal", "trained", "mixed"].includes(next.cardImageVariant) ? next.cardImageVariant : settings.cardImageVariant;
  if (next.avoidRecentCards !== undefined) settings.avoidRecentCards = Math.max(0, Math.min(200, Number(next.avoidRecentCards) || 0));
  if (next.avoidRecentCharacters !== undefined) settings.avoidRecentCharacters = Math.max(0, Math.min(100, Number(next.avoidRecentCharacters) || 0));

  if (next.teams) {
    if (next.teams.A?.name !== undefined) game.teams.A.name = String(next.teams.A.name).trim().slice(0, 20) || "A 队";
    if (next.teams.B?.name !== undefined) game.teams.B.name = String(next.teams.B.name).trim().slice(0, 20) || "B 队";
  }
  if (next.currentTeam !== undefined) settings.currentTeam = ["A", "B"].includes(next.currentTeam) ? next.currentTeam : settings.currentTeam;

  const diffChanged = prevDifficulty !== settings.difficulty;
  const modeChanged = prevSolo !== settings.mode;

  if (diffChanged) {
    const preset = DIFFICULTY_PRESETS[settings.difficulty];
    if (preset) { settings.cropSize = preset.cropSize; settings.candidateCount = preset.candidateCount; }
  }

  broadcast();

  if (diffChanged || modeChanged) { preparedRound = null; stopTimer(); clearAutoNext(); game.status = "idle"; game.current = null; game.message = "配置已更新，题目已重置"; broadcast(); }
}

async function saveSettings() {
  // write settings + team names to disk
  clearTimeout(persistLock.timer);
  persistLock.timer = setTimeout(async () => {
    try {
      await mkdir(dataDir, { recursive: true });
      await writeFile(settingsStorePath, JSON.stringify({ settings, teams: { A: { name: game.teams.A.name }, B: { name: game.teams.B.name } } }, null, 2));
    } catch { /* ignore */ }
  }, 800);
}

// --- Card picking ---
function filteredCardPool() {
  const bandSet = new Set(settings.cardBands || []);
  const raritySet = new Set((settings.cardRarities || []).map(Number));
  const attributeSet = new Set(settings.cardAttributes || []);

  const filtered = cardPool.filter((card) => {
    const band = BAND_BY_CHARACTER.get(Number(card.characterId));
    if (bandSet.size && !bandSet.has(band)) return false;
    if (raritySet.size && !raritySet.has(Number(card.rarity))) return false;
    if (attributeSet.size && !attributeSet.has(card.attribute)) return false;
    if (settings.cardImageVariant === "trained" && !card.stat?.training) return false;
    return true;
  });

  return filtered.length ? filtered : cardPool;
}

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function pickRoundCard() {
  const pool = filteredCardPool();
  const recentCards = new Set(game.recentCards.slice(0, settings.avoidRecentCards));
  const recentCharacters = new Set(game.recentCharacters.slice(0, settings.avoidRecentCharacters));
  const passes = [
    (card) => !recentCards.has(String(card.id)) && !recentCharacters.has(Number(card.characterId)),
    (card) => !recentCards.has(String(card.id)),
    () => true,
  ];
  for (const pass of passes) {
    const candidates = pool.filter(pass);
    if (candidates.length) return pick(candidates);
  }
  return pick(pool);
}

function rememberRound(round) {
  game.recentCards.unshift(String(round.cardId));
  game.recentCharacters.unshift(Number(round.characterId));
  game.recentCards = unique(game.recentCards).slice(0, Math.max(4, settings.avoidRecentCards + 8));
  game.recentCharacters = unique(game.recentCharacters).slice(0, Math.max(4, settings.avoidRecentCharacters + 4));
}

async function fetchCardResource(card) {
  const variants = settings.cardImageVariant === "trained"
    ? ["card_after_training.png", "card_normal.png"]
    : settings.cardImageVariant === "normal"
      ? ["card_normal.png", "card_after_training.png"]
      : Math.random() > 0.5
        ? ["card_after_training.png", "card_normal.png"]
        : ["card_normal.png", "card_after_training.png"];

  for (const file of variants) {
    const cacheRelativePath = `${card.resourceSetName}_rip/${file}`;
    const cachePath = path.join(cardCacheDir, cacheRelativePath);
    const imageUrl = `/cards/${cacheRelativePath.replaceAll("\\", "/")}`;
    const url = `${BESTDORI_BASE}/${card.resourceSetName}_rip/${file}`;

    if (existsSync(cachePath)) {
      return {
        buffer: readFileSync(cachePath),
        imageUrl,
        cacheRelativePath: cacheRelativePath.replaceAll("\\", "/"),
        variant: file === "card_after_training.png" ? "trained" : "normal",
      };
    }
    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("image")) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, buffer);
      return { buffer, imageUrl, cacheRelativePath: cacheRelativePath.replaceAll("\\", "/"), variant: file === "card_after_training.png" ? "trained" : "normal" };
    } catch { continue; }
  }
  throw new Error("下载卡面失败");
}

async function createRound() {
  const card = pickRoundCard();
  const names = nicknames[String(card.characterId)];
  const { buffer, imageUrl, variant, cacheRelativePath } = await fetchCardResource(card);
  const faceBoxes = faceBoxesFor(faceBoxStore, cacheRelativePath);
  const image = await Jimp.read(buffer);
  const crop = await smartCrop(image, settings.cropSize, settings, [], faceBoxes);

  return {
    cardId: card.id,
    characterId: card.characterId,
    displayName: names[7] || names[0],
    acceptedAnswers: names,
    imageUrl,
    variant,
    rarity: card.rarity,
    attribute: card.attribute,
    band: BAND_BY_CHARACTER.get(Number(card.characterId)) || "",
    faceBoxes,
    faceCropMode: effectiveFaceCropMode(settings),
    imageWidth: image.bitmap.width,
    imageHeight: image.bitmap.height,
    sourceBuffer: buffer,
    crop,
  };
}

function prepareNextRound() {
  const key = roundConfigKey(settings);
  if (preparedRound && preparedRoundKey === key) return;
  preparedRoundKey = key;
  preparedRound = createRound().catch((error) => {
    console.warn(`预加载失败: ${error instanceof Error ? error.message : error}`);
    return null;
  });
}

async function takePreparedRound() {
  const key = roundConfigKey(settings);
  if (!preparedRound || preparedRoundKey !== key) return null;
  const round = await preparedRound;
  preparedRound = null;
  preparedRoundKey = "";
  return round;
}

function clearPreparedRound() {
  preparedRound = null;
  preparedRoundKey = "";
}

async function startRound() {
  const token = roundToken + 1;
  roundToken = token;
  clearAutoNext();
  stopTimer();

  game.status = "loading";
  game.loading = true;
  game.leftSeconds = settings.roundSeconds;
  game.recrops = 0;
  game.cropHistory = [];
  game.current = null;
  game.message = "加载下一题";
  broadcast();

  let round = null;
  try {
    round = await takePreparedRound() || await createRound();
  } catch (error) {
    if (token === roundToken) {
      game.status = "idle";
      game.loading = false;
      game.message = error instanceof Error ? error.message : "题目加载失败";
      broadcast();
    }
    return;
  }
  if (token !== roundToken || !round) return;

  rememberRound(round);
  game.cropHistory = [round.crop].filter(Boolean);
  game.current = round;
  game.status = "playing";
  game.loading = false;
  game.leftSeconds = settings.roundSeconds;
  game.message = "答题中";
  broadcast();
  startTimer();
  prepareNextRound();
}
function startTimer() {
  stopTimer();
  if (!settings.showTimer) return;
  timer = setInterval(() => {
    if (game.status !== "playing") return;
    game.leftSeconds = Math.max(0, game.leftSeconds - 1);
    if (game.leftSeconds <= 0) finishRound("timeout");
    else broadcast();
  }, 1000);
}

function clearAutoNext() { if (autoNextTimer) clearTimeout(autoNextTimer); autoNextTimer = null; }
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

// --- State broadcast ---
function healthSnapshot() {
  const faceImages = Object.keys(faceBoxStore.images || {}).length;
  let cachedCount = 0;
  try { const raw = readFileSync(path.join(cardCacheDir, ".cache-meta.json"), "utf-8"); cachedCount = JSON.parse(raw).count || 0; } catch { /* ignore */ }
  const roleCounts = { player: 0, host: 0, settings: 0, self: 0 };
  for (const { role } of clients.values()) { if (roleCounts[role] !== undefined) roleCounts[role] += 1; }
  return {
    totalCards: cardPool.length, filteredCards: filteredCardPool().length,
    cachedSets: cachedCount, cachePercent: cachedCount ? Math.round((Math.min(cachedCount, cardPool.length) / cardPool.length) * 100) : 0,
    lanHosts: lanHosts(),
    bands: BAND_OPTIONS, rarities: RARITY_OPTIONS, attributes: ATTRIBUTE_OPTIONS,
    faceBoxImages: faceImages, faceBoxesPath: faceBoxesStorePath,
    clients: clients.size, roleCounts,
    preloaded: !!preparedRound, effectiveFaceCropMode: effectiveFaceCropMode(settings),
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

function publicState(role) {
  const current = game.current && {
    displayName: ["player", "self"].includes(role) && game.status === "playing" ? "" : game.current.displayName,
    acceptedAnswers: role === "host" ? game.current.acceptedAnswers : [],
    imageUrl: game.current.imageUrl, imageWidth: game.current.imageWidth, imageHeight: game.current.imageHeight,
    crop: game.current.crop,
  };
  return {
    appMode: APP_MODE,
    settings,
    meta: { bands: BAND_OPTIONS, rarities: RARITY_OPTIONS, attributes: ATTRIBUTE_OPTIONS, difficultyPresets: DIFFICULTY_PRESETS, faceCropModes: FACE_CROP_MODES },
    health: healthSnapshot(),
    game: { ...game, current, cropHistory: undefined, recentCards: undefined, recentCharacters: undefined, undoStack: undefined, canUndo: game.undoStack.length > 0, loading: game.loading },
  };
}

function sendState(ws) {
  const role = clients.get(ws)?.role || "player";
  ws.send(JSON.stringify({ type: "state", state: publicState(role) }));
}

function broadcast() {
  for (const ws of clients.keys()) {
    if (ws.readyState === ws.OPEN) sendState(ws);
  }
}

// --- Bestdori proxy ---
async function proxyBestdori(url, res) {
  const targetPath = url.pathname.replace(/^\/bestdori/, "");
  const target = `${BESTDORI_ORIGIN}${targetPath}`;
  const response = await fetch(target);
  res.writeHead(response.status, {
    "Content-Type": response.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "public, max-age=86400",
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

// --- Static file serving ---
async function serveStatic(requestPath, res) {
  const cleanPath = decodeURIComponent(requestPath.split("?")[0]);
  const staticPath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  let filePath = path.join(publicDir, staticPath);
  if (filePath.startsWith(publicDir) && existsSync(filePath) && !(await stat(filePath).catch(() => null))?.isDirectory()) return streamFile(filePath, res);

  filePath = path.join(distDir, cleanPath === "/" ? "index.html" : cleanPath);
  if (!filePath.startsWith(distDir)) { res.writeHead(403); return res.end("Forbidden"); }
  if (!existsSync(filePath) || (await stat(filePath).catch(() => null))?.isDirectory()) filePath = path.join(distDir, "index.html");
  streamFile(filePath, res);
}

function streamFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600" });
  createReadStream(filePath).pipe(res);
}

// --- Helpers ---
function sendJson(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

// --- Start ---
const port = Number(process.env.PORT || 5173);
server.listen(port, "0.0.0.0", () => {
  const labels = APP_MODE === "solo"
    ? [["Solo", "solo"], ["NoteShooter", "noteShooter"], ["Scores", "scores"], ["QR", "qr"]]
    : [["Player", "player"], ["NoteShooter", "noteShooter"], ["Scores", "scores"], ["Host login", "login"], ["Host", "host"], ["Settings", "settings"], ["QR", "qr"]];
  const lines = originList(port).flatMap((origin) => {
    const pages = pageUrls(origin);
    return labels.map(([label, key]) => `${label.padEnd(10)} ${pages[key]}`);
  });
  console.log(`BangBangCai ${APP_MODE} server running:\n${lines.join("\n")}`);
  if (!process.env.HOST_PASSWORD) {
    console.log(`\n[!] No HOST_PASSWORD set. Generated: ${HOST_PASSWORD}\n    Set via: HOST_PASSWORD="your-password" npm run start`);
  }
});
