// BanG Dream! Card Guess - HTTP/WebSocket server
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";

import { sendJson, securityHeaders, requestIp, isMutatingMethod, requiresCsrfCheck } from "./utils/http.js";
import { logger } from "./utils/logger.js";
import { proxyBestdori } from "./http/bestdoriProxy.js";
import { serveStatic, streamFile } from "./app/static.js";
import {
  dataDir, settingsStorePath, faceBoxesStorePath,
  BESTDORI_ORIGIN,
  BAND_OPTIONS, RARITY_OPTIONS, ATTRIBUTE_OPTIONS,
  DIFFICULTY_PRESETS, FACE_CROP_MODES, CARD_CHARACTER_LIMITS, CARD_VARIANTS, MIME, unique,
  defaultSettings, readPersistedConfig,
  arraySetting, numberArraySetting,
  persistedTeamName, roundConfigKey, effectiveFaceCropMode,
} from "./config.js";
import { AUTH_COOKIE, CSRF_COOKIE, HOST_PASSWORD, isAuthenticated, verifyPassword, buildAuthCookie, buildCsrfCookie, createAuthSession, createCsrfToken, getAuthToken, getCookie, revokeAuthSession } from "./auth.js";
import { readCommunityData, writeCommunityData } from "./community.js";
import {
  parseRequestPayload, readRequestBody,
  normalizeNoteShooterPlayerId, normalizeQueueUsername,
} from "./scores.js";
import { createProductionServices } from "./services/production.js";
import {
  createInitialGameState,
  markRoundLoadFailed,
  markRoundLoading,
  markRoundPlaying,
} from "./game/state.js";
import { undoHistory } from "./game/history.js";
import { applyRoundResult } from "./game/scoring.js";
import { sanitizeSettings } from "./game/settings.js";
import { isPlayerAllowedCommand, isSoloAllowedCommand, validateCommandPayload } from "./game/commands.js";
import { applyGameCommand } from "./game/reducer.js";
import { createPublicSnapshot } from "./game/snapshot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");
const cardCacheDir = path.join(publicDir, "cards");
const resourceDir = path.join(rootDir, "resource");
const APP_MODE = process.env.APP_MODE === "solo" || process.argv.includes("--solo") ? "solo" : "booth";
const APP_VERSION = process.env.npm_package_version || readPackageVersion();

function readPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
    return typeof pkg.version === "string" && pkg.version ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// --- Services ---
const services = createProductionServices({ resourceDir, cardCacheDir });
const {
  cardProvider,
  cropService,
  timerService,
  scoreStore,
  qrcodeService,
  networkService,
} = services;
const faceBoxStore = cardProvider.faceBoxStore;
const cardPool = cardProvider.cardPool;

// --- Settings ---
const persistedConfig = readPersistedConfig();
const settings = { ...defaultSettings, ...(persistedConfig.settings || {}) };
const persistLock = { timer: null };

// --- Game state ---
const GAME_MESSAGES = {
  correct: "回答正确",
  wrong: "回答错误",
  timeout: "时间到",
  skip: "已跳过",
  loading: "加载下一题",
  recropDone: "已重切",
  reveal: "答案揭晓",
  hideAnswer: "答案已隐藏",
  reset: "已重置",
  stop: "游戏已停止",
  emptyGuess: "请输入角色名或昵称",
};
const SETTINGS_DEPS = {
  defaultSettings,
  difficultyPresets: DIFFICULTY_PRESETS,
  faceCropModes: FACE_CROP_MODES,
  bandIds: BAND_OPTIONS.map((b) => b.id),
  rarities: RARITY_OPTIONS,
  attributes: ATTRIBUTE_OPTIONS,
  cardCharacterLimits: CARD_CHARACTER_LIMITS,
  cardVariants: CARD_VARIANTS,
  arraySetting,
  numberArraySetting,
};
function currentTeamNames() {
  return {
    A: persistedTeamName?.("A", "A 队") || "A 队",
    B: persistedTeamName?.("B", "B 队") || "B 队",
  };
}
const game = createInitialGameState(settings, currentTeamNames());
let roundToken = 0;
let preparedRound = null;
let preparedRoundKey = "";
const clients = new Map();
const loginAttempts = new Map();
const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;

// --- HTTP server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1`);
  const originValid = isTrustedOrigin(req);

  if (isMutatingMethod(req.method) && !originValid) {
    return sendJson(res, { error: "Invalid origin" }, 403);
  }
  if (isMutatingMethod(req.method) && requiresCsrfCheck(req, url.pathname) && !hasValidCsrf(req)) {
    return sendJson(res, { error: "Invalid CSRF token" }, 403);
  }

  // API routes
  if (url.pathname === "/api/health") return sendJson(res, publicHealthSnapshot());
  if (url.pathname === "/api/diagnostics" && req.method === "GET") {
    if (!isAuthenticated(req)) return sendJson(res, { error: "Unauthorized" }, 401);
    return sendJson(res, diagnosticsSnapshot(req));
  }
  if (url.pathname === "/api/diagnostics/export" && req.method === "GET") {
    if (!isAuthenticated(req)) return sendJson(res, { error: "Unauthorized" }, 401);
    res.setHeader("Content-Disposition", `attachment; filename="bangbangcai-diagnostics-${Date.now()}.json"`);
    return sendJson(res, diagnosticsSnapshot(req, { exportMode: true }));
  }
  if (url.pathname === "/api/network") return sendJson(res, networkService.networkState(req));
  if (url.pathname === "/api/stopwatch-settings" && req.method === "GET") {
    return sendJson(res, {
      targetSeconds: Number(settings.stopwatchTargetSeconds) || 10,
      toleranceSeconds: Number(settings.stopwatchToleranceSeconds) || 0.02,
    });
  }
  
  if (url.pathname === "/api/community" && req.method === "GET") return sendJson(res, readCommunityData());
  if (url.pathname === "/api/community" && req.method === "POST") {
    if (!isAuthenticated(req)) return sendJson(res, { error: "Unauthorized" }, 401);
    try {
      const body = await readRequestBody(req);
      const data = parseRequestPayload(req, body);
      await writeCommunityData(data);
      return sendJson(res, { ok: true });
    } catch (err) {
      return sendJson(res, { error: err.message }, 500);
    }
  }
  if (url.pathname === "/api/upload" && req.method === "POST") {
    if (!isAuthenticated(req)) return sendJson(res, { error: "Unauthorized" }, 401);
    try {
      const body = await readRequestBody(req);
      const data = parseRequestPayload(req, body);
      if (data.image) {
        const match = data.image.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === "jpeg" ? "jpg" : match[1];
          const buffer = Buffer.from(match[2], "base64");
          const filename = `upload_${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
          const communityDir = path.join(publicDir, "community");
          await mkdir(communityDir, { recursive: true });
          await writeFile(path.join(communityDir, filename), buffer);
          return sendJson(res, { url: `/community/${filename}` });
        }
      }
      return sendJson(res, { error: "Invalid image format" }, 400);
    } catch (err) {
      return sendJson(res, { error: err.message }, 500);
    }
  }

  if (url.pathname === "/api/queue-scores" && req.method === "GET") return sendJson(res, scoreStore.queueScoreState());
  if (url.pathname === "/api/queue-scores/events") return scoreStore.handleQueueScoreEvents(req, res);
  if (url.pathname === "/api/queue-scores" && req.method === "POST") {
    const body = parseRequestPayload(req, await readRequestBody(req));
    const username = normalizeQueueUsername(body.username);
    const score = Math.max(0, Math.min(999999, Math.floor(Number(body.score))));
    const duration = Math.max(0, Math.min(3600, Math.floor(Number(body.duration || 0))));
    if (!username || !Number.isFinite(score)) return sendJson(res, { ok: false, message: "用户名或分数无效" }, 400);
    const scores = scoreStore.readQueueScores();
    scores.unshift({ id: randomBytes(8).toString("hex"), username, score, duration, at: Date.now() });
    try {
      await scoreStore.writeQueueScores(scores);
      scoreStore.broadcastQueueScores();
    } catch (error) {
      logger.error(error, { event: "queue_scores_write_failed" });
      throw error;
    }
    return sendJson(res, { ok: true, ...scoreStore.queueScoreState(scores) });
  }
  if (url.pathname.startsWith("/note-shooter-api/")) return scoreStore.handleNoteShooterApi(url, req, res);
  if (url.pathname === "/api/note-shooter-scores" && req.method === "GET") return sendJson(res, scoreStore.noteShooterScoreState());
  if (url.pathname === "/api/note-shooter-scores/events") return scoreStore.handleNoteShooterScoreEvents(req, res);
  if (url.pathname === "/api/note-shooter-scores" && req.method === "DELETE") {
    const body = parseRequestPayload(req, await readRequestBody(req));
    const password = String(body.password || "");
    const id = String(body.id || "").trim();
    const playerId = normalizeNoteShooterPlayerId(body.playerId);
    const scope = String(body.scope || "");

    if (!isAuthenticated(req) && !verifyPassword(password)) return sendJson(res, { ok: false, message: "权限不足" }, 401);
    if (!id && !playerId) return sendJson(res, { ok: false, message: "缺少成绩 ID" }, 400);

    const scores = scoreStore.readNoteShooterScores();
    const nextScores = scope === "player" && playerId
      ? scores.filter((entry) => entry.player_id !== playerId)
      : scores.filter((entry) => entry.id !== id);
    try {
      await scoreStore.writeNoteShooterScores(nextScores);
      scoreStore.broadcastNoteShooterScores();
    } catch (error) {
      logger.error(error, { event: "note_shooter_scores_write_failed" });
      throw error;
    }
    return sendJson(res, { ok: true });
  }
  if (url.pathname === "/api/login" && req.method === "POST") {
    const loginIp = requestIp(req);
    if (!checkLoginRateLimit(loginIp)) {
      return sendJson(res, { ok: false, message: "Too many attempts" }, 429);
    }
    const body = parseRequestPayload(req, await readRequestBody(req));
    if (verifyPassword(body.password)) {
      clearLoginRateLimit(loginIp);
      const token = createAuthSession();
      const csrfToken = createCsrfToken();
      res.setHeader("Set-Cookie", [buildAuthCookie(token, req), buildCsrfCookie(csrfToken, req)]);
      return sendJson(res, { ok: true });
    }
    return sendJson(res, { ok: false }, 403);
  }
  if (url.pathname === "/api/logout" && req.method === "POST") {
    revokeAuthSession(getAuthToken(req));
    res.setHeader("Set-Cookie", [
      `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`,
    ]);
    return sendJson(res, { ok: true });
  }
  if (url.pathname === "/api/qr" && req.method === "GET") {
    const text = url.searchParams.get("text") || "";
    if (!text || text.length > 1024) {
      res.writeHead(400, { ...securityHeaders(), "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Missing or too long QR text");
    }
    try {
      const svg = await qrcodeService.createQrImage(qrcodeService.createQrPayload(text), { type: "svg", width: 320, margin: 1, color: { dark: "#334462", light: "#FFFFFFFF" } });
      res.writeHead(200, { ...securityHeaders(), "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-cache" });
      return res.end(svg);
    } catch { return sendJson(res, { error: "生成失败" }, 500); }
  }

  // Bestdori proxy
  if (url.pathname.startsWith("/bestdori/")) return proxyBestdori(url, res);
  // Compatibility for legacy/cached note-shooter pages that request /img/*
  if (url.pathname.startsWith("/img/")) {
    const legacyPath = url.pathname.replace(/^\/img\//, "");
    const legacyBase = path.join(publicDir, "note-shooter", "img");
    const legacyFile = path.join(legacyBase, legacyPath);
    const legacyStat = await stat(legacyFile).catch(() => null);
    if (legacyFile.startsWith(legacyBase) && legacyStat?.isFile()) return streamFile(legacyFile, res);
  }

  // Static files (public/ or dist/)
  return serveStatic(req.url, res, publicDir, distDir);
});

// --- WebSocket ---
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws, req) => {
  if (!isTrustedWebSocketOrigin(req)) {
    logger.warn("Rejected WebSocket connection with invalid origin", { origin: req.headers.origin || "" });
    ws.close(1008, "Invalid origin");
    return;
  }
  logger.info("WebSocket connected", { ip: requestIp(req), clients: clients.size + 1 });
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
          logger.warn("WebSocket auth required", { requestedRole });
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
      logger.error(error, { event: "websocket_message_error" });
      ws.send(JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "操作失败" }));
    }
  });
  ws.on("close", () => {
    clients.delete(ws);
    logger.info("WebSocket disconnected", { clients: clients.size });
  });
  sendState(ws);
});

// --- Command handler ---
async function handleCommand(ws, command, payload) {
  const client = clients.get(ws);
  const soloAllowed = APP_MODE === "solo" && client?.role === "self" && isSoloAllowedCommand(command);
  const playerAllowed = APP_MODE === "booth" && client?.role === "player" && isPlayerAllowedCommand(command);
  if (!client?.authenticated && !soloAllowed && !playerAllowed) throw new Error("请先登录主持端");
  const safePayload = validateCommandPayload(command, payload);

  switch (command) {
    case "start":
    case "next": await startRound(); break;
    case "recrop": await recrop(); break;
    case "correct": finishRound("correct"); break;
    case "wrong": finishRound("wrong"); break;
    case "skip": finishRound("skip"); break;
    case "undo": undoLastJudgement(); break;
    case "stop": stopGame(); break;
    case "reveal": clearAutoNext(); stopTimer(); applyPureCommand(command, safePayload); break;
    case "selfGuess": judgeSelfGuess(safePayload.guess); break;
    case "hideAnswer": applyPureCommand(command, safePayload); break;
    case "reset": resetGame(); break;
    case "settings": updateSettings(payload); await saveSettings(); break;
    case "importSettings": updateSettings(payload); await saveSettings(); break;
    default:
      logger.warn("Unknown WebSocket command", { command, role: client?.role || "unknown" });
      throw new Error(`未知命令: ${command}`);
  }
}

function applyPureCommand(command, payload = {}) {
  const result = applyGameCommand(game, settings, command, payload, {
    appMode: APP_MODE,
    now: Date.now(),
    teamNames: currentTeamNames(),
    messages: GAME_MESSAGES,
  });
  if (result.handled) broadcast();
  return result;
}

// --- Game functions ---
async function recrop() {
  if (!game.current || game.status !== "playing" || game.loading || !settings.allowRecrop || game.recrops >= settings.maxRecrops) return;
  game.loading = true;
  game.message = "重新裁剪中";
  broadcast();
  let crop;
  try {
    crop = await cropService.recropCard(game.current, settings, game.cropHistory);
  } catch (error) {
    logger.error(error, { event: "crop_failed", cardId: game.current?.cardId });
    game.loading = false;
    broadcast();
    throw error;
  }
  rememberCrop(crop);
  game.current.crop = crop;
  game.recrops += 1;
  game.loading = false;
  game.message = "已重切";
  broadcast();
}

function finishRound(result) {
  if (!game.current || game.status !== "playing") return;
  clearAutoNext();
  stopTimer();
  applyRoundResult(game, settings, result, Date.now(), GAME_MESSAGES);
  broadcast();
  if (settings.autoNext) {
    const token = roundToken;
    timerService.startAutoNextTimer(settings.autoNextDelay, () => {
      if (token === roundToken && (game.status === "revealed" || game.status === "finished")) startRound();
    });
  }
}

function undoLastJudgement() {
  if (!game.undoStack.length) return;
  stopTimer();
  clearAutoNext();
  undoHistory(game);
  if (game.status === "playing") startTimer();
  broadcast();
}

function stopGame() {
  stopTimer();
  clearAutoNext();
  applyPureCommand("stop");
}

function judgeSelfGuess(guess) {
  const beforeStatus = game.status;
  clearAutoNext();
  const result = applyGameCommand(game, settings, "selfGuess", { guess }, {
    appMode: APP_MODE,
    now: Date.now(),
    teamNames: currentTeamNames(),
    messages: GAME_MESSAGES,
  });
  if (!result.handled) return;
  if (result.result) {
    stopTimer();
    if (settings.autoNext && beforeStatus === "playing") {
      const token = roundToken;
      timerService.startAutoNextTimer(settings.autoNextDelay, () => {
        if (token === roundToken && (game.status === "revealed" || game.status === "finished")) startRound();
      });
    }
  }
  broadcast();
}

function resetGame() {
  stopTimer();
  clearAutoNext();
  applyPureCommand("reset");
}

async function updateSettings(next) {
  if (next.teams) {
    if (next.teams.A?.name !== undefined) game.teams.A.name = String(next.teams.A.name).trim().slice(0, 20) || "A 队";
    if (next.teams.B?.name !== undefined) game.teams.B.name = String(next.teams.B.name).trim().slice(0, 20) || "B 队";
  }
  const { difficultyChanged, modeChanged } = sanitizeSettings(settings, next, SETTINGS_DEPS);

  broadcast();

  if (difficultyChanged || modeChanged) { preparedRound = null; stopTimer(); clearAutoNext(); game.status = "idle"; game.current = null; game.message = "配置已更新，题目已重置"; broadcast(); }
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
  return cardProvider.filteredCardPool(settings);
}

function rememberRound(round) {
  game.recentCards.unshift(String(round.cardId));
  game.recentCharacters.unshift(Number(round.characterId));
  game.recentCards = unique(game.recentCards).slice(0, Math.max(4, settings.avoidRecentCards + 8));
  game.recentCharacters = unique(game.recentCharacters).slice(0, Math.max(4, settings.avoidRecentCharacters + 4));
}

function rememberCrop(crop) {
  game.cropHistory.push({ x: crop.x, y: crop.y });
  game.cropHistory = game.cropHistory.slice(-8);
}

async function createRound() {
  return cardProvider.createRound(settings, game.recentCards, game.recentCharacters);
}

function prepareNextRound() {
  const key = roundConfigKey(settings);
  if (preparedRound && preparedRoundKey === key) return;
  preparedRoundKey = key;
  preparedRound = createRound().catch((error) => {
    logger.warn("Card preload failed", { message: error instanceof Error ? error.message : String(error) });
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

  markRoundLoading(game, settings, "加载下一题");
  broadcast();

  let round = null;
  try {
    round = await takePreparedRound() || await createRound();
  } catch (error) {
    logger.error(error, { event: "card_load_failed" });
    if (token === roundToken) {
      markRoundLoadFailed(game, error instanceof Error ? error.message : "题目加载失败");
      broadcast();
    }
    throw error;
  }
  if (token !== roundToken) return;

  rememberRound(round);
  rememberCrop(round.crop);
  markRoundPlaying(game, settings, round, "答题中");
  broadcast();
  startTimer();
  prepareNextRound();
}
function startTimer() {
  stopTimer();
  if (!settings.showTimer) return;
  timerService.startRoundTimer(game.leftSeconds, (leftSeconds) => {
    if (game.status !== "playing") return;
    game.leftSeconds = leftSeconds;
    broadcast();
  }, () => {
    if (game.status !== "playing") return;
    game.leftSeconds = 0;
    finishRound("timeout");
  });
}

function clearAutoNext() { timerService.stopAutoNextTimer(); }
function stopTimer() { timerService.stopRoundTimer(); }

// --- State broadcast ---
/**
 * @typedef {import('./src/shared/types/websocket').AppSnapshot} AppSnapshot
 * @typedef {import('./src/shared/types/websocket').ServerMessage} ServerMessage
 */

function healthSnapshot() {
  const faceImages = Object.keys(faceBoxStore.images || {}).length;
  const cacheInfo = cardProvider.getCacheInfo();
  const roleCounts = { player: 0, host: 0, settings: 0, self: 0 };
  for (const { role } of clients.values()) { if (roleCounts[role] !== undefined) roleCounts[role] += 1; }
  const recentErrors = logger.recentErrors();
  const routes = networkService.getPublicRoutes(port);
  return {
    totalCards: cardPool.length, filteredCards: filteredCardPool().length,
    cachedSets: cacheInfo.cachedSets, cachePercent: cacheInfo.cachePercent,
    lanHosts: networkService.lanHosts(),
    bands: BAND_OPTIONS, rarities: RARITY_OPTIONS, attributes: ATTRIBUTE_OPTIONS,
    faceBoxImages: faceImages, faceBoxesPath: faceBoxesStorePath,
    clients: clients.size, roleCounts,
    preloaded: !!preparedRound, effectiveFaceCropMode: effectiveFaceCropMode(settings),
    uptimeSeconds: Math.floor(process.uptime()),
    ok: true,
    appMode: APP_MODE,
    uptimeMs: Math.floor(process.uptime() * 1000),
    version: APP_VERSION,
    nodeVersion: process.version,
    connectedClients: clients.size,
    roles: roleCounts,
    cache: {
      cardCount: cardPool.length,
      hasCache: cacheInfo.cachedSets > 0,
      cachedSets: cacheInfo.cachedSets,
      cachePercent: cacheInfo.cachePercent,
    },
    game: {
      status: game.status,
      roundActive: game.status === "playing",
      hasCurrentCard: !!game.current,
    },
    services: {
      cards: "ok",
      crop: "ok",
      scores: "ok",
      qrcode: "ok",
    },
    network: {
      addressesCount: networkService.lanHosts().length,
      routesCount: routes.length,
    },
    errors: {
      recentCount: recentErrors.length,
      lastMessage: recentErrors.at(-1)?.message || "",
    },
  };
}

function publicHealthSnapshot() {
  const health = healthSnapshot();
  return {
    totalCards: health.totalCards,
    filteredCards: health.filteredCards,
    cachedSets: health.cachedSets,
    cachePercent: health.cachePercent,
    roleCounts: health.roleCounts,
    preloaded: health.preloaded,
    effectiveFaceCropMode: health.effectiveFaceCropMode,
    ok: health.ok,
    appMode: health.appMode,
    uptimeMs: health.uptimeMs,
    version: health.version,
    nodeVersion: health.nodeVersion,
    connectedClients: health.connectedClients,
    roles: health.roles,
    cache: health.cache,
    game: health.game,
    services: health.services,
    network: health.network,
    errors: health.errors,
  };
}

function scoreSummary() {
  const queue = scoreStore.queueScoreState();
  const noteShooter = scoreStore.noteShooterScoreState();
  return {
    queue: { total: queue.total || 0, topCount: queue.top?.length || 0, recentCount: queue.recent?.length || 0 },
    noteShooter: { total: noteShooter.total || 0, leaderboardCount: noteShooter.leaderboard?.length || 0, recentCount: noteShooter.recent?.length || 0 },
  };
}

function websocketSummary() {
  return {
    connectedClients: clients.size,
    roles: healthSnapshot().roleCounts,
  };
}

function diagnosticsSnapshot(req, options: { exportMode?: boolean } = {}) {
  const health = publicHealthSnapshot();
  const network = networkService.networkState(req);
  return {
    ok: true,
    exportMode: !!options.exportMode,
    generatedAt: new Date().toISOString(),
    health,
    network: {
      port: network.port,
      currentOrigin: network.currentOrigin,
      lanHosts: network.lanHosts,
      requestHost: network.requestHost,
      addressesCount: Array.isArray(network.lanHosts) ? network.lanHosts.length : 0,
    },
    websocket: websocketSummary(),
    game: {
      status: game.status,
      roundActive: game.status === "playing",
      hasCurrentCard: !!game.current,
      score: game.score,
      streak: game.streak,
      historyCount: game.history.length,
    },
    cache: health.cache,
    scores: scoreSummary(),
    recentErrors: logger.recentErrors(),
  };
}

/**
 * @param {string} role 
 * @returns {AppSnapshot}
 */
function publicState(role) {
  return createPublicSnapshot({
    appMode: APP_MODE,
    role,
    settings,
    meta: { bands: BAND_OPTIONS, rarities: RARITY_OPTIONS, attributes: ATTRIBUTE_OPTIONS, difficultyPresets: DIFFICULTY_PRESETS, faceCropModes: FACE_CROP_MODES },
    health: healthSnapshot(),
    game,
  });
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


// --- Static file serving ---




// --- Helpers ---






function isTrustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers.host || "";
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

function isTrustedWebSocketOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers.host || "";
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}



function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { firstAt: now, count: 1 });
    return true;
  }
  if (entry.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

function clearLoginRateLimit(ip) {
  loginAttempts.delete(ip);
}



function hasValidCsrf(req) {
  const cookieToken = getCookie(req, CSRF_COOKIE);
  const headerToken = String(req.headers["x-csrf-token"] || "");
  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}

// --- Start ---
const port = Number(process.env.PORT || 5173);
server.listen(port, "0.0.0.0", () => {
  const labels = APP_MODE === "solo"
    ? [["Solo", "solo"], ["NoteShooter", "noteShooter"], ["Scores", "scores"], ["QR", "qr"]]
    : [["Player", "player"], ["NoteShooter", "noteShooter"], ["Scores", "scores"], ["Host login", "login"], ["Host", "host"], ["Settings", "settings"], ["QR", "qr"]];
  const lines = unique(["127.0.0.1", ...networkService.getLocalAddresses()]).flatMap((host) => {
    const origin = `http://${host}:${port}`;
    const pages = {
      player: `${origin}/player`,
      noteShooter: `${origin}/note-shooter`,
      stopwatchChallenge: `${origin}/games/stopwatch-challenge`,
      queue: `${origin}/note-shooter`,
      scores: `${origin}/scores`,
      login: `${origin}/login`,
      host: `${origin}/host`,
      settings: `${origin}/settings`,
      solo: `${origin}/solo`,
      qr: `${origin}/qr`,
    };
    return labels.map(([label, key]) => `${label.padEnd(10)} ${pages[key]}`);
  });
  logger.info(`BangBangCai ${APP_MODE} server running:\n${lines.join("\n")}`);
  if (!process.env.HOST_PASSWORD) {
    logger.warn("No HOST_PASSWORD set; generated runtime host password");
  }
});

process.on("uncaughtExceptionMonitor", (error) => {
  logger.error(error, { event: "uncaughtException" });
});

process.on("unhandledRejection", (reason) => {
  logger.error(reason instanceof Error ? reason : String(reason), { event: "unhandledRejection" });
  setImmediate(() => {
    throw reason instanceof Error ? reason : new Error(String(reason));
  });
});

