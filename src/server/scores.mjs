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
    const body = parseRequestPayload(req, await readRequestBody(req));
    const playerId = normalizeNoteShooterPlayerId(body.playerId) || `P${randomBytes(3).toString("hex").toUpperCase()}`;
    sendJson(res, { ok: true, online: 1, playerId });
    return;
  }
  if (endpoint === "gameStat" && req.method === "POST") {
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
    req.on("data", (chunk) => { body += chunk; });
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
  if (!entry || typeof entry !== "object") return null;
  return {
    id: normalizeNoteShooterPlayerId(entry.playerId) || `P${randomBytes(3).toString("hex").toUpperCase()}`,
    player_id: normalizeNoteShooterPlayerId(entry.playerId) || `P${randomBytes(3).toString("hex").toUpperCase()}`,
    player_name: normalizeNoteShooterPlayerName(entry.playerName),
    levels: normalizeNoteShooterLevel(entry.levels),
    difficulty: normalizeNoteShooterDifficulty(entry.difficulty),
    ranks: normalizeNoteShooterRank(entry.rank),
    final_score: Math.max(0, Number(entry.final_score) || Number(entry.finalScore) || 0),
    duration: Math.max(0, Number(entry.duration) || 0),
    at: Number(entry.at) || Date.now(),
  };
}

export function normalizeNoteShooterPlayerId(value) { return String(value || "").trim().slice(0, 64) || ""; }
export function normalizeNoteShooterPlayerName(value) { return String(value || "").trim().slice(0, 30) || "Player"; }
export function normalizeNoteShooterLevel(value) { const v = String(value || "").trim(); return ["easy", "normal", "hard"].includes(v) ? v : "normal"; }
export function normalizeNoteShooterDifficulty(value) { const n = Number(value); return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(n) ? n : 1; }
export function normalizeNoteShooterRank(value) { const s = String(value || "").trim(); return ["F", "E", "D", "C", "B", "A", "S"].includes(s) ? s : "F"; }

export function formatLocalDateTime(value = Date.now()) {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
