import { createServer } from "node:http";
import { readFileSync, existsSync, createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Jimp } from "jimp";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const publicDir = path.join(__dirname, "public");
const cardCacheDir = path.join(publicDir, "cards");
const resourceDir = path.join(__dirname, "resource");
const BESTDORI_ORIGIN = "https://bestdori.com";
const BESTDORI_BASE = `${BESTDORI_ORIGIN}/assets/jp/characters/resourceset`;
const APP_MODE = process.env.APP_MODE === "solo" || process.argv.includes("--solo") ? "solo" : "booth";
const HOST_PASSWORD = process.env.HOST_PASSWORD || "BangBang@2026";
const AUTH_COOKIE = "bbc_host_auth";
const AUTH_TOKEN = randomBytes(32).toString("hex");

const cards = JSON.parse(readFileSync(path.join(resourceDir, "all5_2.json"), "utf-8"));
const nicknames = JSON.parse(readFileSync(path.join(resourceDir, "nickname.json"), "utf-8"));
const cardPool = Object.entries(cards)
  .map(([id, card]) => ({ ...card, id }))
  .filter((card) => card?.resourceSetName && nicknames[String(card.characterId)]?.length);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
};

const settings = {
  mode: "single",
  roundSeconds: 60,
  questionsPerPlayer: 3,
  allowRecrop: true,
  maxRecrops: 3,
  cropSize: 180,
  candidateCount: 120,
  correctPoints: 1,
  wrongPenalty: 0,
  streakBonus: false,
  showTimer: true,
  revealAfterJudge: true,
  autoNext: false,
  autoNextDelay: 1800,
  currentTeam: "A",
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
  current: null,
  history: [],
  teams: {
    A: { name: "A 队", score: 0 },
    B: { name: "B 队", score: 0 },
  },
  message: "等待开始",
};

const clients = new Map();
let timer = null;
let roundToken = 0;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

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
    case "team":
      settings.currentTeam = payload.team === "B" ? "B" : "A";
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

function sameSecret(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
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

  const round = await createRound();
  if (token !== roundToken) return;

  game.current = round;
  game.status = "playing";
  game.loading = false;
  game.leftSeconds = settings.roundSeconds;
  game.message = "答题中";
  broadcast();
  startTimer();
}

async function recrop() {
  if (!game.current || game.loading || !settings.allowRecrop || game.recrops >= settings.maxRecrops) return;

  game.loading = true;
  game.message = "重新裁剪中";
  broadcast();

  const image = await Jimp.read(game.current.sourceBuffer);
  const crop = await smartCrop(image, settings.cropSize);
  rememberCrop(crop);
  game.current.crop = crop;
  game.recrops += 1;
  game.loading = false;
  game.message = "已重切";
  broadcast();
}

function finishRound(result) {
  if (!game.current || game.status === "idle") return;

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
    game.message = result === "wrong" ? "回答错误" : "已跳过";
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
  game.current = null;
  game.history = [];
  game.teams.A.score = 0;
  game.teams.B.score = 0;
  game.message = "等待开始";
  broadcast();
}

function updateSettings(next) {
  const numberKeys = ["roundSeconds", "questionsPerPlayer", "maxRecrops", "cropSize", "candidateCount", "correctPoints", "wrongPenalty", "autoNextDelay"];
  const boolKeys = ["allowRecrop", "streakBonus", "showTimer", "revealAfterJudge", "autoNext"];

  for (const key of numberKeys) {
    if (next[key] !== undefined) settings[key] = Math.max(0, Number(next[key]));
  }

  for (const key of boolKeys) {
    if (next[key] !== undefined) settings[key] = next[key] === true || next[key] === "true" || next[key] === "on";
  }

  if (["single", "versus", "self"].includes(next.mode)) settings.mode = next.mode;
  if (next.currentTeam === "A" || next.currentTeam === "B") settings.currentTeam = next.currentTeam;
  if (next.teamAName) game.teams.A.name = String(next.teamAName).slice(0, 16);
  if (next.teamBName) game.teams.B.name = String(next.teamBName).slice(0, 16);

  if (game.status === "idle") game.leftSeconds = settings.roundSeconds;
  broadcast();
}

async function createRound() {
  const card = pick(cardPool);
  const names = nicknames[String(card.characterId)];
  const { buffer, imageUrl } = await loadCardImage(card);
  const image = await Jimp.read(buffer);
  const crop = await smartCrop(image, settings.cropSize);
  rememberCrop(crop);

  return {
    cardId: card.id,
    characterId: card.characterId,
    displayName: names[7] || names[0],
    acceptedAnswers: names,
    imageUrl,
    imageWidth: image.bitmap.width,
    imageHeight: image.bitmap.height,
    sourceBuffer: buffer,
    crop,
  };
}

async function loadCardImage(card) {
  const variants = Math.random() > 0.5
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
      };
    }

    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("image")) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, buffer);
      return { buffer, imageUrl };
    } catch {
      continue;
    }
  }

  throw new Error("下载卡面失败");
}

async function smartCrop(image, size) {
  const cropSize = Math.max(60, Math.min(260, Math.floor(size)));
  const candidates = Array.from({ length: Math.max(30, settings.candidateCount) }, () => {
    const point = randomCropPoint(image, cropSize);
    return { ...point, score: scoreCrop(image, point.x, point.y, cropSize) };
  })
    .filter((crop) => crop.score > 0)
    .sort((a, b) => b.score - a.score);

  const crop = pickCrop(candidates, cropSize) || randomCropPoint(image, cropSize);
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

function pickCrop(candidates, size) {
  const passes = [size * 1.85, size * 1.2, 0];
  for (const minDistance of passes) {
    const crop = candidates.find((candidate) => {
      return game.cropHistory.every((old) => Math.hypot(old.x - candidate.x, old.y - candidate.y) >= minDistance);
    });
    if (crop) return crop;
  }
  return candidates[0];
}

function rememberCrop(crop) {
  game.cropHistory.push({ x: crop.x, y: crop.y });
  game.cropHistory = game.cropHistory.slice(-8);
}

function scoreCrop(image, x, y, size) {
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

  return (
    colorVariance * 1.4 +
    Math.sqrt(Math.max(0, lumaVariance)) * 3.2 +
    edgeDensity * 150 +
    saturation * 0.32 -
    flatPenalty -
    brightnessPenalty
  );
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
    game: {
      ...game,
      current,
      cropHistory: undefined,
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
  const urls = APP_MODE === "solo"
    ? [`http://127.0.0.1:${port}/solo`]
    : [
        `http://127.0.0.1:${port}/player`,
        `http://127.0.0.1:${port}/login`,
        `http://127.0.0.1:${port}/host`,
        `http://127.0.0.1:${port}/settings`,
      ];
  console.log(`BangBangCai ${APP_MODE} server running:\n${urls.join("\n")}`);
});
