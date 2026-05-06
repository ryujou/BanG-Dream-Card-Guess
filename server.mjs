import { createServer } from "node:http";
import { readFileSync, existsSync, createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Jimp } from "jimp";
import QRCode from "qrcode";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const publicDir = path.join(__dirname, "public");
const cardCacheDir = path.join(publicDir, "cards");
const resourceDir = path.join(__dirname, "resource");
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const settingsStorePath = path.join(dataDir, "settings.json");
const faceBoxesStorePath = path.join(dataDir, "face-boxes.json");
const queueScoresStorePath = path.join(dataDir, "queue-scores.json");
const noteShooterScoresStorePath = path.join(dataDir, "note-shooter-scores.json");
const BESTDORI_ORIGIN = "https://bestdori.com";
const BESTDORI_BASE = `${BESTDORI_ORIGIN}/assets/jp/characters/resourceset`;
const APP_MODE = process.env.APP_MODE === "solo" || process.argv.includes("--solo") ? "solo" : "booth";
const HOST_PASSWORD = process.env.HOST_PASSWORD || "BangBang@2026";
const AUTH_COOKIE = "bbc_host_auth";
const AUTH_TOKEN = randomBytes(32).toString("hex");

const cards = JSON.parse(readFileSync(path.join(resourceDir, "all5_2.json"), "utf-8"));
const nicknames = JSON.parse(readFileSync(path.join(resourceDir, "nickname.json"), "utf-8"));
const faceBoxStore = readFaceBoxStore();
const cardPool = Object.entries(cards)
  .map(([id, card]) => ({ ...card, id }))
  .filter((card) => card?.resourceSetName && nicknames[String(card.characterId)]?.length);

const BAND_OPTIONS = [
  { id: "poppin-party", name: "Poppin'Party", characters: [1, 2, 3, 4, 5] },
  { id: "afterglow", name: "Afterglow", characters: [6, 7, 8, 9, 10] },
  { id: "hello-happy-world", name: "Hello, Happy World!", characters: [11, 12, 13, 14, 15] },
  { id: "pastel-palettes", name: "Pastel*Palettes", characters: [16, 17, 18, 19, 20] },
  { id: "roselia", name: "Roselia", characters: [21, 22, 23, 24, 25] },
  { id: "morfonica", name: "Morfonica", characters: [26, 27, 28, 29, 30] },
  { id: "raise-a-suilen", name: "RAISE A SUILEN", characters: [31, 32, 33, 34, 35] },
  { id: "mygo", name: "MyGO!!!!!", characters: [36, 37, 38, 39, 40] },
];
const BAND_BY_CHARACTER = new Map(BAND_OPTIONS.flatMap((band) => band.characters.map((id) => [id, band.id])));
const RARITY_OPTIONS = [1, 2, 3, 4, 5];
const ATTRIBUTE_OPTIONS = ["cool", "happy", "powerful", "pure"];
const DIFFICULTY_PRESETS = {
  easy: { cropSize: 230, candidateCount: 90 },
  normal: { cropSize: 180, candidateCount: 120 },
  hard: { cropSize: 130, candidateCount: 170 },
};
const FACE_CROP_MODES = ["auto", "none", "avoid", "prefer", "only"];
const FACE_LABELS_BY_CLASS = { 0: "eyes", 1: "face", 2: "mouth" };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
};

const defaultSettings = {
  mode: "single",
  difficulty: "normal",
  faceCropMode: "auto",
  roundSeconds: 60,
  questionsPerPlayer: 3,
  allowRecrop: true,
  showPlayerRecrop: true,
  soundEnabled: true,
  maxRecrops: 3,
  cropSize: 180,
  candidateCount: 120,
  avoidRecentCards: 20,
  avoidRecentCharacters: 8,
  cardBands: BAND_OPTIONS.map((band) => band.id),
  cardRarities: RARITY_OPTIONS,
  cardAttributes: ATTRIBUTE_OPTIONS,
  cardImageVariant: "mixed",
  correctPoints: 1,
  wrongPenalty: 0,
  streakBonus: false,
  showTimer: true,
  revealAfterJudge: true,
  autoNext: false,
  autoNextDelay: 1800,
  currentTeam: "A",
};
const persistedConfig = readPersistedConfig();
const settings = {
  ...defaultSettings,
  ...(persistedConfig.settings || {}),
};

const game = {
  status: "idle",
  leftSeconds: settings.roundSeconds,
  loading: false,
  score: 0,
  streak: 0,
  total: 0,
  recrops: 0,
  cropHistory: [],
  recentCards: [],
  recentCharacters: [],
  undoStack: [],
  current: null,
  history: [],
  teams: {
    A: { name: persistedTeamName("A", "A 队"), score: 0 },
    B: { name: persistedTeamName("B", "B 队"), score: 0 },
  },
  message: "等待开始",
};

const clients = new Map();
const queueScoreStreams = new Set();
const noteShooterScoreStreams = new Set();
let timer = null;
let roundToken = 0;
let preparedRoundPromise = null;
let preparedRoundKey = "";
let healthCache = { at: 0, value: null };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/network" && req.method === "GET") {
      sendJson(res, networkState(req));
      return;
    }

    if (url.pathname === "/api/health" && req.method === "GET") {
      sendJson(res, healthSnapshot());
      return;
    }

    if (url.pathname === "/api/qr" && req.method === "GET") {
      await sendQrCode(url, res);
      return;
    }

    if (url.pathname === "/api/queue-scores" && req.method === "GET") {
      sendJson(res, queueScoreState());
      return;
    }

    if (url.pathname === "/api/note-shooter-scores" && req.method === "GET") {
      sendJson(res, noteShooterScoreState());
      return;
    }

    if (url.pathname === "/api/note-shooter-scores" && req.method === "DELETE") {
      await handleDeleteNoteShooterScore(req, res);
      return;
    }

    if (url.pathname === "/api/note-shooter-scores/delete" && req.method === "POST") {
      await handleDeleteNoteShooterScore(req, res);
      return;
    }

    if (url.pathname === "/api/queue-scores/events" && req.method === "GET") {
      handleQueueScoreEvents(req, res);
      return;
    }

    if (url.pathname === "/api/note-shooter-scores/events" && req.method === "GET") {
      handleNoteShooterScoreEvents(req, res);
      return;
    }

    if (url.pathname === "/api/queue-scores" && req.method === "POST") {
      await handleQueueScore(req, res);
      return;
    }

    if (url.pathname === "/api/login" && req.method === "POST") {
      await handleLogin(req, res);
      return;
    }

    if (url.pathname === "/api/logout" && req.method === "POST") {
      res.writeHead(204, {
        "Set-Cookie": `${AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
      });
      res.end();
      return;
    }

    if (url.pathname.startsWith("/bestdori/")) {
      await proxyBestdori(url, res);
      return;
    }

    if (url.pathname.startsWith("/note-shooter-api/")) {
      await handleNoteShooterApi(url, req, res);
      return;
    }

    if (url.pathname === "/solo" && APP_MODE !== "solo") {
      res.writeHead(302, { Location: "/player" });
      res.end();
      return;
    }

    if (["/host", "/settings"].includes(url.pathname) && !isAuthenticated(req)) {
      res.writeHead(302, { Location: "/login" });
      res.end();
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Server error");
  }
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const authenticated = isAuthenticated(req);
  clients.set(ws, { role: "player", authenticated });

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

      if (message.type === "command") {
        await handleCommand(ws, message.command, message.payload || {});
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: "error",
        message: error instanceof Error ? error.message : "操作失败",
      }));
    }
  });

  ws.on("close", () => clients.delete(ws));
  sendState(ws);
});

async function handleCommand(ws, command, payload) {
  const client = clients.get(ws);
  const soloCommandAllowed = APP_MODE === "solo" && client?.role === "self" && ["start", "next", "recrop", "reveal", "reset", "selfGuess"].includes(command);
  const boothPlayerCommandAllowed = APP_MODE === "booth" && client?.role === "player" && command === "recrop";

  if (!client?.authenticated && !soloCommandAllowed && !boothPlayerCommandAllowed) {
    throw new Error("请先登录主持端");
  }

  switch (command) {
    case "start":
    case "next":
      await startRound();
      break;
    case "recrop":
      await recrop();
      break;
    case "correct":
      finishRound("correct");
      break;
    case "wrong":
      finishRound("wrong");
      break;
    case "skip":
      finishRound("skip");
      break;
    case "undo":
      undoLastJudgement();
      break;
    case "reveal":
      game.status = "revealed";
      game.message = "答案揭晓";
      stopTimer();
      broadcast();
      break;
    case "selfGuess":
      judgeSelfGuess(payload.guess);
      break;
    case "hideAnswer":
      if (game.status === "revealed") game.status = "playing";
      game.message = "答案已隐藏";
      broadcast();
      break;
    case "reset":
      resetGame();
      break;
    case "settings":
      updateSettings(payload);
      break;
    case "importSettings":
      updateSettings(payload);
      break;
    case "team":
      settings.currentTeam = payload.team === "B" ? "B" : "A";
      savePersistentConfigSoon();
      broadcast();
      break;
    default:
      throw new Error(`未知指令：${command}`);
  }
}

async function handleLogin(req, res) {
  const body = await readRequestBody(req);
  const params = new URLSearchParams(body);
  const password = params.get("password") || "";

  if (!sameSecret(password, HOST_PASSWORD)) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, message: "密码错误" }));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": `${AUTH_COOKIE}=${AUTH_TOKEN}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`,
  });
  res.end(JSON.stringify({ ok: true }));
}

async function handleQueueScore(req, res) {
  const body = await readRequestBody(req);
  const payload = parseRequestPayload(req, body);
  const username = normalizeQueueUsername(payload.username);
  const score = Math.max(0, Math.min(999999, Math.floor(Number(payload.score))));
  const duration = Math.max(0, Math.min(3600, Math.floor(Number(payload.duration || 0))));

  if (!username || !Number.isFinite(score)) {
    sendJson(res, { ok: false, message: "用户名或分数无效" }, 400);
    return;
  }

  const scores = readQueueScores();
  scores.unshift({
    id: randomBytes(8).toString("hex"),
    username,
    score,
    duration,
    at: Date.now(),
  });

  const savedScores = scores.slice(0, 1000);
  await writeQueueScores(savedScores);
  const state = queueScoreState(savedScores);
  broadcastQueueScores(state);
  sendJson(res, { ok: true, ...state });
}

async function handleDeleteNoteShooterScore(req, res) {
  const body = parseRequestPayload(req, await readRequestBody(req));
  const password = String(body.password || "");
  const id = String(body.id || "").trim();

  if (!sameSecret(password, HOST_PASSWORD)) {
    sendJson(res, { ok: false, message: "主持密码错误" }, 401);
    return;
  }

  if (!id) {
    sendJson(res, { ok: false, message: "缺少成绩 ID" }, 400);
    return;
  }

  const scores = readNoteShooterScores();
  const nextScores = scores.filter((entry) => entry.id !== id);
  if (nextScores.length === scores.length) {
    sendJson(res, { ok: false, message: "成绩不存在或已删除" }, 404);
    return;
  }

  await writeNoteShooterScores(nextScores);
  const state = noteShooterScoreState(nextScores);
  broadcastNoteShooterScores(state);
  sendJson(res, { ok: true, ...state });
}

function handleQueueScoreEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: scores\ndata: ${JSON.stringify(queueScoreState())}\n\n`);
  queueScoreStreams.add(res);
  req.on("close", () => queueScoreStreams.delete(res));
}

function broadcastQueueScores(state = queueScoreState()) {
  const payload = `event: scores\ndata: ${JSON.stringify(state)}\n\n`;
  for (const stream of queueScoreStreams) {
    try {
      stream.write(payload);
    } catch {
      queueScoreStreams.delete(stream);
    }
  }
}

function handleNoteShooterScoreEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: scores\ndata: ${JSON.stringify(noteShooterScoreState())}\n\n`);
  noteShooterScoreStreams.add(res);
  req.on("close", () => noteShooterScoreStreams.delete(res));
}

function broadcastNoteShooterScores(state = noteShooterScoreState()) {
  const payload = `event: scores\ndata: ${JSON.stringify(state)}\n\n`;
  for (const stream of noteShooterScoreStreams) {
    try {
      stream.write(payload);
    } catch {
      noteShooterScoreStreams.delete(stream);
    }
  }
}

async function handleNoteShooterApi(url, req, res) {
  const endpoint = url.pathname.replace(/^\/note-shooter-api\/?/, "");
  if (endpoint === "openStat" && req.method === "POST") {
    const body = parseRequestPayload(req, await readRequestBody(req));
    const playerId = normalizeNoteShooterPlayerId(body.playerId) || `P${randomBytes(3).toString("hex").toUpperCase()}`;
    sendJson(res, { ok: true, online: 1, playerId });
    return;
  }

  if (endpoint === "gameStat" && req.method === "POST") {
    const body = parseRequestPayload(req, await readRequestBody(req));
    const score = normalizeNoteShooterScore(body);
    if (!score) {
      sendJson(res, { ok: false, message: "成绩无效" }, 400);
      return;
    }
    const scores = readNoteShooterScores();
    scores.unshift(score);
    await writeNoteShooterScores(scores.slice(0, 2000));
    broadcastNoteShooterScores();
    sendJson(res, { ok: true });
    return;
  }

  if ((endpoint === "getRanking" || endpoint === "getMyRanking") && req.method === "GET") {
    const levels = normalizeNoteShooterLevel(url.searchParams.get("levels"));
    const difficulty = normalizeNoteShooterDifficulty(url.searchParams.get("difficulty"));
    const type = endpoint === "getMyRanking" ? "myRank" : String(url.searchParams.get("type") || "top");
    const playerId = normalizeNoteShooterPlayerId(url.searchParams.get("playerId"));
    sendJson(res, { ok: true, data: noteShooterRanking({ levels, difficulty, type, playerId }) });
    return;
  }

  if (endpoint === "bilibiliContact" && req.method === "POST") {
    await readRequestBody(req);
    sendJson(res, { ok: true });
    return;
  }

  sendJson(res, { ok: false, message: "Not found" }, 404);
}

function parseRequestPayload(req, body) {
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(body || "{}");
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(body));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf-8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[AUTH_COOKIE] === AUTH_TOKEN;
}

function parseCookies(header) {
  return Object.fromEntries(header.split(";").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("=") || "")];
  }).filter(([key]) => key));
}

function readPersistedConfig() {
  try {
    if (!existsSync(settingsStorePath)) return {};
    const value = JSON.parse(readFileSync(settingsStorePath, "utf-8"));
    return value && typeof value === "object" ? value : {};
  } catch (error) {
    console.warn(`Failed to read settings store: ${error instanceof Error ? error.message : error}`);
    return {};
  }
}

function readFaceBoxStore() {
  try {
    if (!existsSync(faceBoxesStorePath)) return { images: {} };
    const value = JSON.parse(readFileSync(faceBoxesStorePath, "utf-8"));
    return value && typeof value === "object" && value.images && typeof value.images === "object"
      ? value
      : { images: {} };
  } catch (error) {
    console.warn(`Failed to read face box store: ${error instanceof Error ? error.message : error}`);
    return { images: {} };
  }
}

function readQueueScores() {
  try {
    if (!existsSync(queueScoresStorePath)) return [];
    const value = JSON.parse(readFileSync(queueScoresStorePath, "utf-8"));
    return Array.isArray(value) ? value.map(normalizeQueueScore).filter(Boolean) : [];
  } catch (error) {
    console.warn(`Failed to read queue scores: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

async function writeQueueScores(scores) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(queueScoresStorePath, `${JSON.stringify(scores.map(normalizeQueueScore).filter(Boolean), null, 2)}\n`);
}

function queueScoreState(scores = readQueueScores()) {
  const bestByUser = new Map();
  for (const entry of scores.map(normalizeQueueScore).filter(Boolean)) {
    const old = bestByUser.get(entry.username);
    if (!old || entry.score > old.score || (entry.score === old.score && entry.at < old.at)) {
      bestByUser.set(entry.username, entry);
    }
  }

  return {
    total: scores.length,
    leaderboard: [...bestByUser.values()]
      .sort((a, b) => b.score - a.score || a.at - b.at)
      .slice(0, 20),
    recent: scores
      .map(normalizeQueueScore)
      .filter(Boolean)
      .sort((a, b) => b.at - a.at)
      .slice(0, 20),
  };
}

function normalizeQueueScore(entry) {
  const username = normalizeQueueUsername(entry?.username);
  const score = Math.max(0, Math.min(999999, Math.floor(Number(entry?.score))));
  if (!username || !Number.isFinite(score)) return null;
  return {
    id: String(entry.id || randomBytes(8).toString("hex")),
    username,
    score,
    duration: Math.max(0, Math.min(3600, Math.floor(Number(entry.duration || 0)))),
    at: Number.isFinite(Number(entry.at)) ? Number(entry.at) : Date.now(),
  };
}

function normalizeQueueUsername(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 20);
}

function readNoteShooterScores() {
  try {
    if (!existsSync(noteShooterScoresStorePath)) return [];
    const value = JSON.parse(readFileSync(noteShooterScoresStorePath, "utf-8"));
    return Array.isArray(value) ? value.map(normalizeNoteShooterScore).filter(Boolean) : [];
  } catch (error) {
    console.warn(`Failed to read note shooter scores: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

async function writeNoteShooterScores(scores) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(noteShooterScoresStorePath, `${JSON.stringify(scores.map(normalizeNoteShooterScore).filter(Boolean), null, 2)}\n`);
}

function noteShooterScoreState(scores = readNoteShooterScores()) {
  const normalized = scores.map(normalizeNoteShooterScore).filter(Boolean);
  const bestByPlayer = new Map();
  for (const entry of normalized) {
    const old = bestByPlayer.get(entry.player_id);
    if (!old || entry.final_score > old.final_score || (entry.final_score === old.final_score && entry.duration < old.duration)) {
      bestByPlayer.set(entry.player_id, entry);
    }
  }

  const toScoreItem = (entry) => ({
    id: entry.id,
    username: entry.player_name || entry.player_id,
    playerId: entry.player_id,
    score: entry.final_score,
    duration: entry.duration,
    rank: entry.ranks,
    level: entry.levels,
    difficulty: entry.difficulty,
    at: entry.at,
  });

  return {
    total: normalized.length,
    leaderboard: [...bestByPlayer.values()]
      .sort((a, b) => b.final_score - a.final_score || a.duration - b.duration || a.at - b.at)
      .slice(0, 20)
      .map(toScoreItem),
    recent: normalized
      .slice()
      .sort((a, b) => b.at - a.at)
      .slice(0, 20)
      .map(toScoreItem),
  };
}

function noteShooterRanking({ levels, difficulty, type, playerId }) {
  const scores = readNoteShooterScores()
    .filter((entry) => entry.levels === levels && entry.difficulty === difficulty);
  const ranked = scores
    .slice()
    .sort((a, b) => b.final_score - a.final_score || a.duration - b.duration || a.at - b.at)
    .map((entry, index) => ({ ...entry, user_rank: index + 1 }));

  if (type === "recent") {
    return scores
      .slice()
      .sort((a, b) => b.at - a.at)
      .slice(0, 30)
      .map((entry, index) => ({ ...entry, user_rank: index + 1 }));
  }

  if (type === "best") {
    return noteShooterBestByPlayer(ranked).slice(0, 30).map((entry, index) => ({ ...entry, user_rank: index + 1 }));
  }

  if (type === "myRank") {
    if (!playerId) return [];
    return ranked.filter((entry) => entry.player_id === playerId).slice(0, 30);
  }

  if (type === "myBest") {
    if (!playerId) return [];
    return ranked.filter((entry) => entry.player_id === playerId).slice(0, 30);
  }

  if (type === "myRecent") {
    if (!playerId) return [];
    return scores
      .filter((entry) => entry.player_id === playerId)
      .sort((a, b) => b.at - a.at)
      .slice(0, 30)
      .map((entry, index) => ({ ...entry, user_rank: index + 1 }));
  }

  return ranked.slice(0, 30);
}

function noteShooterBestByPlayer(ranked) {
  const best = new Map();
  for (const entry of ranked) {
    if (!best.has(entry.player_id)) best.set(entry.player_id, entry);
  }
  return [...best.values()];
}

function normalizeNoteShooterScore(entry) {
  const playerId = normalizeNoteShooterPlayerId(entry?.playerId || entry?.player_id);
  const playerName = normalizeNoteShooterPlayerName(entry?.playerName || entry?.player_name);
  const levels = normalizeNoteShooterLevel(entry?.levels);
  const difficulty = normalizeNoteShooterDifficulty(entry?.difficulty);
  const finalScore = Math.max(0, Math.min(99999999, Math.floor(Number(entry?.finalScore ?? entry?.final_score))));
  if (!playerId || !Number.isFinite(finalScore)) return null;

  const duration = Math.max(0, Math.min(3600, Math.floor(Number(entry?.duration || 0))));
  const ranks = normalizeNoteShooterRank(entry?.ranks);
  const maxCombo = Math.max(0, Math.min(99999, Math.floor(Number(entry?.maxCombo ?? entry?.max_combo ?? 0))));
  return {
    id: String(entry.id || randomBytes(8).toString("hex")),
    player_id: playerId,
    player_name: playerName || playerId,
    levels,
    difficulty,
    fps: Math.max(0, Math.min(300, Math.floor(Number(entry?.fps || 0)))),
    win: Number(entry?.win) ? 1 : 0,
    ranks,
    duration,
    kuma_kill: Math.max(0, Math.min(99999, Math.floor(Number(entry?.kumaKill ?? entry?.kuma_kill ?? 0)))),
    kuma_live: Math.max(0, Math.min(99999, Math.floor(Number(entry?.kumaLive ?? entry?.kuma_live ?? 0)))),
    max_combo: maxCombo,
    life: Math.max(0, Math.min(999, Math.floor(Number(entry?.life || 0)))),
    life_lost: Math.max(0, Math.min(999, Math.floor(Number(entry?.lifeLost ?? entry?.life_lost ?? 0)))),
    boss_ratio: Number(entry?.bossRatio ?? entry?.boss_ratio ?? 0) || 0,
    bullet_ratio: Number(entry?.bulletRatio ?? entry?.bullet_ratio ?? 0) || 0,
    item_ratio: Number(entry?.itemRatio ?? entry?.item_ratio ?? 0) || 0,
    final_score: finalScore,
    full_combo: maxCombo > 0 && Number(entry?.kumaLive ?? entry?.kuma_live ?? 0) <= 0 ? 1 : 0,
    create_time: entry?.create_time || formatLocalDateTime(entry?.at),
    at: Number.isFinite(Number(entry?.at)) ? Number(entry.at) : Date.now(),
  };
}

function normalizeNoteShooterPlayerId(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w-]/g, "")
    .slice(0, 24);
}

function normalizeNoteShooterPlayerName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 16);
}

function normalizeNoteShooterLevel(value) {
  const level = Math.floor(Number(value));
  return [1, 2, 3].includes(level) ? level : 1;
}

function normalizeNoteShooterDifficulty(value) {
  const difficulty = String(value || "easy");
  return ["easy", "normal", "hard", "endless"].includes(difficulty) ? difficulty : "easy";
}

function normalizeNoteShooterRank(value) {
  const rank = String(value || "d").toLowerCase();
  return ["sss", "ssp", "ss", "sp", "s", "ap", "a", "bp", "b", "cp", "c", "d"].includes(rank) ? rank : "d";
}

function formatLocalDateTime(value = Date.now()) {
  const date = new Date(Number(value) || Date.now());
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function persistedTeamName(team, fallback) {
  const name = persistedConfig.teams?.[team]?.name;
  return typeof name === "string" && name.trim() ? name.slice(0, 16) : fallback;
}

async function savePersistentConfig() {
  await mkdir(dataDir, { recursive: true });
  await writeFile(settingsStorePath, `${JSON.stringify({
    settings,
    teams: {
      A: { name: game.teams.A.name },
      B: { name: game.teams.B.name },
    },
  }, null, 2)}\n`);
}

function savePersistentConfigSoon() {
  savePersistentConfig().catch((error) => {
    console.warn(`Failed to save settings store: ${error instanceof Error ? error.message : error}`);
  });
}

function sameSecret(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(JSON.stringify(value));
}

async function sendQrCode(url, res) {
  const text = url.searchParams.get("text") || "";
  if (!text || text.length > 1024) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Missing or too long QR text");
    return;
  }

  const svg = await QRCode.toString(text, {
    type: "svg",
    width: 320,
    margin: 1,
    color: {
      dark: "#17171f",
      light: "#ffffff",
    },
  });

  res.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(svg);
}

function networkState(req) {
  const currentOrigin = currentOriginFromRequest(req);
  const origins = unique([currentOrigin, ...originList(port)]);

  return {
    appMode: APP_MODE,
    port,
    currentOrigin,
    origins,
    pages: pageUrls(currentOrigin),
    entries: origins.map((origin) => ({
      origin,
      pages: pageUrls(origin),
      local: origin.includes("127.0.0.1") || origin.includes("localhost"),
    })),
  };
}

function currentOriginFromRequest(req) {
  const host = req.headers.host || `127.0.0.1:${port}`;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  return `${forwardedProto || "http"}://${host}`;
}

function originList(activePort) {
  return ["127.0.0.1", ...lanHosts()].map((host) => `http://${host}:${activePort}`);
}

function lanHosts() {
  const hosts = [];
  for (const items of Object.values(networkInterfaces())) {
    for (const item of items || []) {
      if ((item.family === "IPv4" || item.family === 4) && !item.internal) {
        hosts.push(item.address);
      }
    }
  }
  return unique(hosts);
}

function pageUrls(origin) {
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function arraySetting(value, fallback, allowed = null) {
  const items = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === ""
      ? []
      : String(value).split(",");
  const normalized = items.map((item) => String(item).trim()).filter(Boolean);
  const filtered = allowed ? normalized.filter((item) => allowed.includes(item)) : normalized;
  return filtered.length ? unique(filtered) : [...fallback];
}

function numberArraySetting(value, fallback, allowed) {
  const items = arraySetting(value, fallback.map(String), allowed.map(String));
  return items.map(Number).filter((item) => Number.isFinite(item));
}

function roundConfigKey() {
  return JSON.stringify({
    cropSize: settings.cropSize,
    candidateCount: settings.candidateCount,
    difficulty: settings.difficulty,
    cardBands: settings.cardBands,
    cardRarities: settings.cardRarities,
    cardAttributes: settings.cardAttributes,
    cardImageVariant: settings.cardImageVariant,
    faceCropMode: settings.faceCropMode,
    avoidRecentCards: settings.avoidRecentCards,
    avoidRecentCharacters: settings.avoidRecentCharacters,
  });
}

function effectiveFaceCropMode() {
  if (FACE_CROP_MODES.includes(settings.faceCropMode) && settings.faceCropMode !== "auto") return settings.faceCropMode;
  if (settings.difficulty === "easy") return "prefer";
  if (settings.difficulty === "hard") return "avoid";
  return "none";
}

function faceBoxesFor(relativePath) {
  const entry = faceBoxStore.images?.[relativePath.replaceAll("\\", "/")];
  if (!entry?.faces?.length) return [];
  const imageArea = Math.max(1, Number(entry.width || 0) * Number(entry.height || 0));
  return entry.faces
    .map((face) => ({
      x: Number(face.x),
      y: Number(face.y),
      w: Number(face.w),
      h: Number(face.h),
      conf: Number(face.conf || 0),
      cls: Number.isFinite(Number(face.cls)) ? Number(face.cls) : null,
      label: faceLabel(face),
    }))
    .filter((face) => {
      if (!Number.isFinite(face.x) || !Number.isFinite(face.y) || face.w <= 0 || face.h <= 0) return false;
      const areaRatio = (face.w * face.h) / imageArea;
      return !(face.label === "face" && areaRatio > 0.22 && face.conf < 0.9);
    });
}

function faceLabel(face) {
  const value = String(face.label || FACE_LABELS_BY_CLASS[Number(face.cls)] || "").toLowerCase();
  if (value.includes("eye")) return "eyes";
  if (value.includes("mouth")) return "mouth";
  if (value.includes("face")) return "face";
  return "face";
}

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

function prepareNextRound() {
  const key = roundConfigKey();
  if (preparedRoundPromise && preparedRoundKey === key) return;
  preparedRoundKey = key;
  preparedRoundPromise = createRound()
    .catch((error) => {
      console.warn(`Failed to preload next round: ${error instanceof Error ? error.message : error}`);
      return null;
    });
}

async function takePreparedRound() {
  const key = roundConfigKey();
  if (!preparedRoundPromise || preparedRoundKey !== key) return null;
  const round = await preparedRoundPromise;
  preparedRoundPromise = null;
  preparedRoundKey = "";
  return round;
}

function clearPreparedRound() {
  preparedRoundPromise = null;
  preparedRoundKey = "";
}

function healthSnapshot() {
  const now = Date.now();
  const roleCounts = { player: 0, host: 0, settings: 0, self: 0 };

  for (const client of clients.values()) {
    if (roleCounts[client.role] !== undefined) roleCounts[client.role] += 1;
  }

  if (healthCache.value && now - healthCache.at < 10000) {
    return {
      ...healthCache.value,
      clients: clients.size,
      roleCounts,
      preloaded: Boolean(preparedRoundPromise),
      filteredCards: filteredCardPool().length,
      effectiveFaceCropMode: effectiveFaceCropMode(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  const cachedSets = cardPool.reduce((count, card) => {
    const dir = path.join(cardCacheDir, `${card.resourceSetName}_rip`);
    return count + (existsSync(dir) ? 1 : 0);
  }, 0);

  healthCache = {
    at: now,
    value: {
      totalCards: cardPool.length,
      cachedSets,
      cachePercent: Math.round((cachedSets / Math.max(1, cardPool.length)) * 100),
      lanHosts: lanHosts(),
      bands: BAND_OPTIONS,
      rarities: RARITY_OPTIONS,
      attributes: ATTRIBUTE_OPTIONS,
      faceBoxImages: Object.keys(faceBoxStore.images || {}).length,
      faceBoxesPath: faceBoxesStorePath,
    },
  };

  return {
    ...healthCache.value,
    clients: clients.size,
    roleCounts,
    preloaded: Boolean(preparedRoundPromise),
    filteredCards: filteredCardPool().length,
    effectiveFaceCropMode: effectiveFaceCropMode(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

async function startRound() {
  const token = roundToken + 1;
  roundToken = token;
  stopTimer();

  game.status = "loading";
  game.loading = true;
  game.leftSeconds = settings.roundSeconds;
  game.recrops = 0;
  game.cropHistory = [];
  game.current = null;
  game.message = "图片加载中";
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
    throw error;
  }
  if (token !== roundToken) return;

  rememberRound(round);
  rememberCrop(round.crop);
  game.current = round;
  game.status = "playing";
  game.loading = false;
  game.leftSeconds = settings.roundSeconds;
  game.message = "答题中";
  broadcast();
  startTimer();
  prepareNextRound();
}

async function recrop() {
  if (!game.current || game.status !== "playing" || game.loading || !settings.allowRecrop || game.recrops >= settings.maxRecrops) return;

  game.loading = true;
  game.message = "重新裁剪中";
  broadcast();

  const image = await Jimp.read(game.current.sourceBuffer);
  const crop = await smartCrop(image, settings.cropSize, game.cropHistory, game.current.faceBoxes || []);
  rememberCrop(crop);
  game.current.crop = crop;
  game.recrops += 1;
  game.loading = false;
  game.message = "已重切";
  broadcast();
}

function finishRound(result) {
  if (!game.current || game.status !== "playing") return;

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

  game.history.unshift({
    result,
    name: game.current.displayName,
    team: settings.currentTeam,
    at: Date.now(),
  });
  game.history = game.history.slice(0, 12);
  broadcast();

  if (settings.autoNext) {
    setTimeout(() => {
      if (game.status === "revealed" || game.status === "finished") startRound();
    }, settings.autoNextDelay);
  }
}

function captureUndoState() {
  return {
    status: game.status,
    leftSeconds: game.leftSeconds,
    loading: game.loading,
    score: game.score,
    streak: game.streak,
    total: game.total,
    recrops: game.recrops,
    cropHistory: game.cropHistory.map((item) => ({ ...item })),
    recentCards: [...game.recentCards],
    recentCharacters: [...game.recentCharacters],
    current: game.current,
    history: game.history.map((item) => ({ ...item })),
    teams: {
      A: { ...game.teams.A },
      B: { ...game.teams.B },
    },
    message: game.message,
  };
}

function undoLastJudgement() {
  const previous = game.undoStack.shift();
  if (!previous) {
    game.message = "没有可撤销的判定";
    broadcast();
    return;
  }

  stopTimer();
  Object.assign(game, {
    status: previous.status,
    leftSeconds: previous.leftSeconds,
    loading: previous.loading,
    score: previous.score,
    streak: previous.streak,
    total: previous.total,
    recrops: previous.recrops,
    cropHistory: previous.cropHistory,
    recentCards: previous.recentCards,
    recentCharacters: previous.recentCharacters,
    current: previous.current,
    history: previous.history,
    message: "已撤销上次判定",
  });
  game.teams.A = previous.teams.A;
  game.teams.B = previous.teams.B;
  if (game.status === "playing") startTimer();
  broadcast();
}

function judgeSelfGuess(guess) {
  if (!game.current || game.status !== "playing") return;

  const normalizedGuess = normalizeAnswer(guess);
  const correct = game.current.acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalizedGuess);
  finishRound(correct ? "correct" : "wrong");
}

function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s・·.。!！?？~～\-—_＿]/g, "");
}

function resetGame() {
  stopTimer();
  roundToken += 1;
  game.status = "idle";
  game.leftSeconds = settings.roundSeconds;
  game.loading = false;
  game.score = 0;
  game.streak = 0;
  game.total = 0;
  game.recrops = 0;
  game.cropHistory = [];
  game.recentCards = [];
  game.recentCharacters = [];
  game.undoStack = [];
  game.current = null;
  game.history = [];
  game.teams.A.score = 0;
  game.teams.B.score = 0;
  game.message = "等待开始";
  clearPreparedRound();
  broadcast();
}

function updateSettings(next) {
  const numberKeys = ["roundSeconds", "questionsPerPlayer", "maxRecrops", "cropSize", "candidateCount", "avoidRecentCards", "avoidRecentCharacters", "correctPoints", "wrongPenalty", "autoNextDelay"];
  const boolKeys = ["allowRecrop", "showPlayerRecrop", "soundEnabled", "streakBonus", "showTimer", "revealAfterJudge", "autoNext"];

  for (const key of numberKeys) {
    if (next[key] !== undefined) settings[key] = Math.max(0, Number(next[key]));
  }

  for (const key of boolKeys) {
    if (next[key] !== undefined) settings[key] = next[key] === true || next[key] === "true" || next[key] === "on";
  }

  if (["single", "versus", "self"].includes(next.mode)) settings.mode = next.mode;
  if (Object.keys(DIFFICULTY_PRESETS).includes(next.difficulty)) settings.difficulty = next.difficulty;
  if (FACE_CROP_MODES.includes(next.faceCropMode)) settings.faceCropMode = next.faceCropMode;
  if (["mixed", "normal", "trained"].includes(next.cardImageVariant)) settings.cardImageVariant = next.cardImageVariant;
  if (next.cardBands !== undefined) settings.cardBands = arraySetting(next.cardBands, defaultSettings.cardBands, defaultSettings.cardBands);
  if (next.cardRarities !== undefined) settings.cardRarities = numberArraySetting(next.cardRarities, defaultSettings.cardRarities, defaultSettings.cardRarities);
  if (next.cardAttributes !== undefined) settings.cardAttributes = arraySetting(next.cardAttributes, defaultSettings.cardAttributes, defaultSettings.cardAttributes);
  if (next.currentTeam === "A" || next.currentTeam === "B") settings.currentTeam = next.currentTeam;
  if (next.teamAName) game.teams.A.name = String(next.teamAName).slice(0, 16);
  if (next.teamBName) game.teams.B.name = String(next.teamBName).slice(0, 16);

  if (game.status === "idle") game.leftSeconds = settings.roundSeconds;
  clearPreparedRound();
  if (game.status === "playing") prepareNextRound();
  savePersistentConfigSoon();
  broadcast();
}

async function createRound() {
  const card = pickRoundCard();
  const names = nicknames[String(card.characterId)];
  const { buffer, imageUrl, variant, cacheRelativePath } = await loadCardImage(card);
  const faceBoxes = faceBoxesFor(cacheRelativePath);
  const image = await Jimp.read(buffer);
  const crop = await smartCrop(image, settings.cropSize, [], faceBoxes);

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
    faceCropMode: effectiveFaceCropMode(),
    imageWidth: image.bitmap.width,
    imageHeight: image.bitmap.height,
    sourceBuffer: buffer,
    crop,
  };
}

async function loadCardImage(card) {
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
      return {
        buffer,
        imageUrl,
        cacheRelativePath: cacheRelativePath.replaceAll("\\", "/"),
        variant: file === "card_after_training.png" ? "trained" : "normal",
      };
    } catch {
      continue;
    }
  }

  throw new Error("下载卡面失败");
}

async function smartCrop(image, size, history = [], faceBoxes = []) {
  const cropSize = Math.max(60, Math.min(260, Math.floor(size)));
  const faceMode = effectiveFaceCropMode();
  const randomPoints = Array.from({ length: Math.max(30, settings.candidateCount) }, () => randomCropPoint(image, cropSize));
  const facePoints = faceMode === "prefer" || faceMode === "only" ? faceCropPoints(image, cropSize, faceBoxes) : [];
  const scoredCandidates = [...randomPoints, ...facePoints]
    .map((point) => ({ ...point, score: scoreCrop(image, point.x, point.y, cropSize, faceBoxes, faceMode) }))
    .sort((a, b) => b.score - a.score);
  const candidates = scoredCandidates.filter((crop) => crop.score > 0);

  const crop = pickCrop(candidates.length ? candidates : scoredCandidates, cropSize, history) || randomCropPoint(image, cropSize);
  const dataUrl = await cropToDataUrl(image, crop.x, crop.y, cropSize);
  return { x: crop.x, y: crop.y, size: cropSize, image: dataUrl };
}

function randomCropPoint(image, size) {
  const maxX = Math.max(0, image.bitmap.width - size);
  const maxY = Math.max(0, image.bitmap.height - size);
  const marginX = Math.min(maxX, Math.floor(image.bitmap.width * 0.08));
  const marginY = Math.min(maxY, Math.floor(image.bitmap.height * 0.08));
  const xRange = Math.max(1, maxX - marginX * 2);
  const yRange = Math.max(1, maxY - marginY * 2);
  return {
    x: Math.min(maxX, marginX + Math.floor(Math.random() * xRange)),
    y: Math.min(maxY, marginY + Math.floor(Math.random() * yRange)),
  };
}

function faceCropPoints(image, size, faceBoxes) {
  if (!faceBoxes.length) return [];

  const maxX = Math.max(0, image.bitmap.width - size);
  const maxY = Math.max(0, image.bitmap.height - size);
  const offsets = [
    [0, 0],
    [-0.28, 0],
    [0.28, 0],
    [0, -0.28],
    [0, 0.28],
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.22, 0.22],
    [0.22, 0.22],
  ];

  const points = [];
  const seen = new Set();
  for (const face of faceBoxes) {
    const target = expandedFaceZone(face);
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    for (const [ox, oy] of offsets) {
      const x = Math.round(Math.max(0, Math.min(maxX, cx - size / 2 + ox * size)));
      const y = Math.round(Math.max(0, Math.min(maxY, cy - size / 2 + oy * size)));
      const key = `${x}:${y}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push({ x, y });
      }
    }
  }
  return points;
}

function pickCrop(candidates, size, history = []) {
  const passes = [size * 1.85, size * 1.2, 0];
  for (const minDistance of passes) {
    const crop = candidates.find((candidate) => {
      return history.every((old) => Math.hypot(old.x - candidate.x, old.y - candidate.y) >= minDistance);
    });
    if (crop) return crop;
  }
  return candidates[0];
}

function rememberCrop(crop) {
  game.cropHistory.push({ x: crop.x, y: crop.y });
  game.cropHistory = game.cropHistory.slice(-8);
}

function scoreCrop(image, x, y, size, faceBoxes = [], faceMode = "none") {
  const data = image.bitmap.data;
  const width = image.bitmap.width;
  const step = 6;
  let count = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumLuma = 0;
  let sumLumaSq = 0;
  let sumSat = 0;
  let edgeHits = 0;
  let edgeTotal = 0;
  const buckets = new Map();

  for (let py = 0; py < size; py += step) {
    for (let px = 0; px < size; px += step) {
      const { r, g, b, luma } = pixel(data, width, x + px, y + py);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const bucket = `${r >> 5}-${g >> 5}-${b >> 5}`;

      count += 1;
      sumR += r;
      sumG += g;
      sumB += b;
      sumLuma += luma;
      sumLumaSq += luma * luma;
      sumSat += max - min;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);

      if (px + step < size) {
        const right = pixel(data, width, x + px + step, y + py);
        edgeHits += Math.abs(luma - right.luma) > 18 ? 1 : 0;
        edgeTotal += 1;
      }

      if (py + step < size) {
        const bottom = pixel(data, width, x + px, y + py + step);
        edgeHits += Math.abs(luma - bottom.luma) > 18 ? 1 : 0;
        edgeTotal += 1;
      }
    }
  }

  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;
  const meanLuma = sumLuma / count;
  const lumaVariance = sumLumaSq / count - meanLuma * meanLuma;
  let colorVariance = 0;

  for (let py = 0; py < size; py += step) {
    for (let px = 0; px < size; px += step) {
      const { r, g, b } = pixel(data, width, x + px, y + py);
      colorVariance += Math.abs(r - meanR) + Math.abs(g - meanG) + Math.abs(b - meanB);
    }
  }

  colorVariance /= count;
  const solidRatio = Math.max(...buckets.values()) / count;
  const edgeDensity = edgeTotal ? edgeHits / edgeTotal : 0;
  const saturation = sumSat / count;
  const brightnessPenalty = Math.max(0, Math.abs(meanLuma - 132) - 84) * 0.6;
  const flatPenalty = solidRatio > 0.42 ? (solidRatio - 0.42) * 180 : 0;

  if (colorVariance < 28 && edgeDensity < 0.1) return 0;
  if (lumaVariance < 180 && solidRatio > 0.38) return 0;

  const faceScore = scoreFacePolicy({ x, y, w: size, h: size }, faceBoxes, faceMode);
  if (faceScore === Number.NEGATIVE_INFINITY) return 0;

  return (
    colorVariance * 1.4 +
    Math.sqrt(Math.max(0, lumaVariance)) * 3.2 +
    edgeDensity * 150 +
    saturation * 0.32 -
    flatPenalty -
    brightnessPenalty +
    faceScore
  );
}

function scoreFacePolicy(crop, faceBoxes, mode) {
  if (!faceBoxes.length || mode === "none") return 0;

  let maxZoneCoverage = 0;
  let maxCropCoverage = 0;
  let maxWeightedCoverage = 0;

  for (const face of faceBoxes) {
    const zone = expandedFaceZone(face);
    const overlap = overlapArea(crop, zone);
    if (!overlap) continue;
    const labelWeight = face.label === "face" ? 1.15 : 0.9;
    const faceArea = zone.w * zone.h;
    const cropArea = crop.w * crop.h;
    const zoneCoverage = overlap / faceArea;
    const cropCoverage = overlap / cropArea;
    maxZoneCoverage = Math.max(maxZoneCoverage, zoneCoverage);
    maxCropCoverage = Math.max(maxCropCoverage, cropCoverage);
    maxWeightedCoverage = Math.max(maxWeightedCoverage, zoneCoverage * labelWeight + cropCoverage);
  }

  if (mode === "avoid") {
    return -(maxZoneCoverage * 620 + maxCropCoverage * 950 + (maxCropCoverage > 0.08 ? 520 : 0));
  }

  if (mode === "only") {
    if (maxZoneCoverage < 0.18 && maxCropCoverage < 0.08) return Number.NEGATIVE_INFINITY;
    return maxWeightedCoverage * 160;
  }

  if (mode === "prefer") {
    return maxWeightedCoverage * 135;
  }

  return 0;
}

function expandedFaceZone(face) {
  const label = face.label || faceLabel(face);
  const config =
    label === "eyes"
      ? { scaleX: 4.6, scaleY: 5.4, offsetY: 1.25 }
      : label === "mouth"
        ? { scaleX: 4.0, scaleY: 4.8, offsetY: -1.15 }
        : { scaleX: 1.85, scaleY: 1.95, offsetY: 0.08 };

  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2 + face.h * config.offsetY;
  const w = face.w * config.scaleX;
  const h = face.h * config.scaleY;
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}

function overlapArea(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function pixel(data, width, x, y) {
  const index = (y * width + x) * 4;
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  return { r, g, b, luma: 0.299 * r + 0.587 * g + 0.114 * b };
}

async function cropToDataUrl(image, x, y, size) {
  const cropped = image.clone().crop({ x, y, w: size, h: size });
  const buffer = await cropped.getBuffer("image/jpeg");
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

function startTimer() {
  stopTimer();
  if (!settings.showTimer) return;
  timer = setInterval(() => {
    if (game.status !== "playing") return;
    game.leftSeconds = Math.max(0, game.leftSeconds - 1);
    if (game.leftSeconds <= 0) {
      finishRound("timeout");
    } else {
      broadcast();
    }
  }, 1000);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function publicState(role) {
  const current = game.current && {
    displayName: ["player", "self"].includes(role) && game.status === "playing" ? "" : game.current.displayName,
    acceptedAnswers: role === "host" ? game.current.acceptedAnswers : [],
    imageUrl: game.current.imageUrl,
    imageWidth: game.current.imageWidth,
    imageHeight: game.current.imageHeight,
    crop: game.current.crop,
  };

  return {
    appMode: APP_MODE,
    settings,
    meta: {
      bands: BAND_OPTIONS,
      rarities: RARITY_OPTIONS,
      attributes: ATTRIBUTE_OPTIONS,
      difficultyPresets: DIFFICULTY_PRESETS,
      faceCropModes: FACE_CROP_MODES,
    },
    health: healthSnapshot(),
    game: {
      ...game,
      current,
      cropHistory: undefined,
      recentCards: undefined,
      recentCharacters: undefined,
      undoStack: undefined,
      canUndo: game.undoStack.length > 0,
      loading: game.loading,
    },
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

async function proxyBestdori(url, res) {
  const targetPath = url.pathname.replace(/^\/bestdori/, "");
  const target = `${BESTDORI_ORIGIN}${targetPath}`;
  const response = await fetch(target);
  res.writeHead(response.status, {
    "Content-Type": response.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "public, max-age=86400",
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

async function serveStatic(requestPath, res) {
  const cleanPath = decodeURIComponent(requestPath.split("?")[0]);
  const staticPath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  let filePath = path.join(publicDir, staticPath);

  if (filePath.startsWith(publicDir) && existsSync(filePath) && !(await stat(filePath).catch(() => null))?.isDirectory()) {
    streamFile(filePath, res);
    return;
  }

  filePath = path.join(distDir, cleanPath === "/" ? "index.html" : cleanPath);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath) || (await stat(filePath).catch(() => null))?.isDirectory()) {
    filePath = path.join(distDir, "index.html");
  }

  streamFile(filePath, res);
}

function streamFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
  });
  createReadStream(filePath).pipe(res);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

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
});
