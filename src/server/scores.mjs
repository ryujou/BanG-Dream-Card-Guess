// 本地成绩管理：队列游戏、音符射手排行榜
import { readFileSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { dataDir } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
export const queueScoresStorePath = path.join(dataDir, "queue-scores.json");
export const noteShooterScoresStorePath = path.join(dataDir, "note-shooter-scores.json");
const REQUEST_BODY_LIMIT = 1024 * 1024;
const scoreRateLimits = new Map();

export const queueScoreStreams = new Set();
export const noteShooterScoreStreams = new Set();

export function readQueueScores() {
  try {
    return JSON.parse(readFileSync(queueScoresStorePath, "utf-8"));
  } catch {
    return [];
  }
}

export async function writeQueueScores(scores) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(queueScoresStorePath, `${JSON.stringify(scores.slice(0, 1000))}\n`);
}

export function readNoteShooterScores() {
  try {
    return JSON.parse(readFileSync(noteShooterScoresStorePath, "utf-8"));
  } catch {
    return [];
  }
}

export async function writeNoteShooterScores(scores) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(noteShooterScoresStorePath, `${JSON.stringify(scores.map(normalizeNoteShooterScore).filter(Boolean), null, 2)}\n`);
}

export function handleQueueScoreEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify(queueScoreState())}\n\n`);
  queueScoreStreams.add(res);
  req.on("close", () => queueScoreStreams.delete(res));
}

export function broadcastQueueScores(state = queueScoreState()) {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const stream of queueScoreStreams) {
    try { stream.write(payload); } catch { queueScoreStreams.delete(stream); }
  }
}

export function handleNoteShooterScoreEvents(req, res) {
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

export function broadcastNoteShooterScores(state = noteShooterScoreState()) {
  const payload = `event: scores\ndata: ${JSON.stringify(state)}\n\n`;
  for (const stream of noteShooterScoreStreams) {
    try { stream.write(payload); } catch { noteShooterScoreStreams.delete(stream); }
  }
}

export async function handleNoteShooterApi(url, req, res) {
  const endpoint = url.pathname.replace(/^\/note-shooter-api\/?/, "");
  if (endpoint === "openStat" && req.method === "POST") {
    if (!checkScoreRateLimit(req, `${endpoint}`, 20, 60_000)) { sendJson(res, { ok: false, message: "请求过于频繁" }, 429); return; }
    const body = parseRequestPayload(req, await readRequestBody(req));
    const playerId = normalizeNoteShooterPlayerId(body.playerId) || `P${randomBytes(3).toString("hex").toUpperCase()}`;
    sendJson(res, { ok: true, online: 1, playerId });
    return;
  }
  if (endpoint === "gameStat" && req.method === "POST") {
    if (!isTrustedBrowserRequest(req) || !checkScoreRateLimit(req, `${endpoint}`, 30, 60_000)) { sendJson(res, { ok: false, message: "请求无效" }, 403); return; }
    const body = parseRequestPayload(req, await readRequestBody(req));
    const score = normalizeNoteShooterScore(body);
    if (!score) { sendJson(res, { ok: false, message: "成绩无效" }, 400); return; }
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

export function parseRequestPayload(req, body) {
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("application/json")) {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return Object.fromEntries(new URLSearchParams(body));
}

export function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > REQUEST_BODY_LIMIT) {
        reject(Object.assign(new Error("请求体过大"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function queueScoreState(scores = readQueueScores()) {
  const normalized = scores.map(normalizeQueueScore).filter(Boolean);
  const sorted = normalized.slice().sort((a, b) => b.score - a.score);
  return { total: normalized.length, top: sorted.slice(0, 20), recent: sorted.slice(0, 20) };
}

export function noteShooterScoreState(scores = readNoteShooterScores()) {
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
    max_combo: entry.max_combo,
    full_combo: entry.full_combo,
    rank: entry.ranks,
    level: entry.levels,
    difficulty: entry.difficulty,
    at: entry.at,
  });
  return {
    total: normalized.length,
    leaderboard: [...bestByPlayer.values()].sort((a, b) => b.final_score - a.final_score || a.duration - b.duration || a.at - b.at).slice(0, 20).map(toScoreItem),
    recent: normalized.slice().sort((a, b) => b.at - a.at).slice(0, 20).map(toScoreItem),
  };
}

export function noteShooterRanking({ levels, difficulty, type, playerId }) {
  const scores = readNoteShooterScores().filter((entry) => entry.levels === levels && entry.difficulty === difficulty);
  const ranked = scores.slice().sort((a, b) => b.final_score - a.final_score || a.duration - b.duration || a.at - b.at).map((entry, index) => ({ ...entry, user_rank: index + 1 }));
  if (type === "recent") return scores.slice().sort((a, b) => b.at - a.at).slice(0, 30).map((entry, index) => ({ ...entry, user_rank: index + 1 }));
  if (type === "best") return noteShooterBestByPlayer(ranked).slice(0, 30).map((entry, index) => ({ ...entry, user_rank: index + 1 }));
  if (type === "myRank" || type === "myBest") return playerId ? ranked.filter((entry) => entry.player_id === playerId).slice(0, 30) : [];
  if (type === "myRecent") return playerId ? scores.filter((entry) => entry.player_id === playerId).sort((a, b) => b.at - a.at).slice(0, 30).map((entry, index) => ({ ...entry, user_rank: index + 1 })) : [];
  return ranked.slice(0, 30).map((entry, index) => ({ ...entry, user_rank: index + 1 }));
}

export function noteShooterBestByPlayer(ranked) {
  const best = new Map();
  for (const entry of ranked) {
    const old = best.get(entry.player_id);
    if (!old || entry.final_score > old.final_score || (entry.final_score === old.final_score && entry.duration < old.duration)) {
      best.set(entry.player_id, entry);
    }
  }
  return [...best.values()].sort((a, b) => b.final_score - a.final_score || a.duration - b.duration || a.at - b.at);
}

export function normalizeQueueScore(entry) {
  if (!entry || typeof entry !== "object") return null;
  return { username: normalizeQueueUsername(entry.username), score: Math.max(0, Number(entry.score) || 0), duration: Math.max(0, Number(entry.duration) || 0), at: Number(entry.at) || Date.now() };
}

export function normalizeQueueUsername(value) { return String(value || "").trim().slice(0, 30) || "匿名"; }

export function normalizeNoteShooterScore(entry) {
  const playerId = normalizeNoteShooterPlayerId(entry?.playerId || entry?.player_id) || `P${randomBytes(3).toString("hex").toUpperCase()}`;
  const playerName = normalizeNoteShooterPlayerName(entry?.playerName || entry?.player_name);
  const levels = normalizeNoteShooterLevel(entry?.levels);
  const difficulty = normalizeNoteShooterDifficulty(entry?.difficulty);
  const finalScore = Math.max(0, Math.min(99999999, Math.floor(Number(entry?.finalScore ?? entry?.final_score))));
  if (!playerId || !Number.isFinite(finalScore)) return null;

  const duration = Math.max(0, Math.min(3600, Math.floor(Number(entry?.duration || 0))));
  const ranks = normalizeNoteShooterRank(entry?.ranks || entry?.rank);
  const maxCombo = Math.max(0, Math.min(99999, Math.floor(Number(entry?.maxCombo ?? entry?.max_combo ?? 0))));
  return {
    id: entry.id || `P${randomBytes(3).toString("hex").toUpperCase()}`,
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

export function normalizeNoteShooterPlayerId(value) { return String(value || "").trim().slice(0, 64) || ""; }
export function normalizeNoteShooterPlayerName(value) { return String(value || "").trim().slice(0, 30) || "玩家"; }
export function normalizeNoteShooterLevel(value) { const v = String(value || "").trim(); return ["easy", "normal", "hard"].includes(v) ? v : "normal"; }
export function normalizeNoteShooterDifficulty(value) { const n = Number(value); return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(n) ? n : 1; }
export function normalizeNoteShooterRank(value) {
  const rank = String(value || "d").toLowerCase();
  return ["sss", "ssp", "ss", "sp", "s", "ap", "a", "bp", "b", "cp", "c", "d"].includes(rank) ? rank : "d";
}

export function formatLocalDateTime(value = Date.now()) {
  const date = new Date(Number(value) || Date.now());
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function checkScoreRateLimit(req, bucket, maxRequests, windowMs) {
  const key = `${bucket}:${getClientIp(req)}`;
  const now = Date.now();
  const record = scoreRateLimits.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  scoreRateLimits.set(key, record);
  for (const [itemKey, value] of scoreRateLimits.entries()) {
    if (value.resetAt <= now) scoreRateLimits.delete(itemKey);
  }
  return record.count <= maxRequests;
}

function isTrustedBrowserRequest(req) {
  const origin = String(req.headers.origin || req.headers.referer || "").trim();
  if (!origin) return true;
  const scheme = String(req.headers["x-forwarded-proto"] || "http").toLowerCase();
  const host = req.headers.host || "127.0.0.1";
  return origin.startsWith(`${scheme}://${host}`);
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || req.headers.host || "unknown";
}
