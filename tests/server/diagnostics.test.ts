import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'child_process';
import WebSocket from 'ws';

describe('runtime diagnostics API', () => {
  let serverProcess: any;
  const PORT = 18000 + Math.floor(Math.random() * 1000);
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  const WS_URL = `ws://127.0.0.1:${PORT}/ws`;

  beforeAll(async () => {
    serverProcess = spawn('node', ['server.mjs'], {
      env: { ...process.env, PORT: String(PORT), HOST_PASSWORD: 'diagnostics-password' },
    });
    await waitForServer(`${BASE_URL}/api/health`);
  });

  afterAll(() => {
    if (serverProcess) serverProcess.kill();
  });

  it('/api/health keeps old fields and appends stable diagnostics fields', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    expect(response.status).toBe(200);
    const json: any = await response.json();
    expect(json).toHaveProperty('totalCards');
    expect(json).toHaveProperty('filteredCards');
    expect(json).toHaveProperty('cachedSets');
    expect(json).toHaveProperty('cachePercent');
    expect(json).toHaveProperty('roleCounts');
    expect(json).toHaveProperty('preloaded');
    expect(json).toHaveProperty('effectiveFaceCropMode');
    expect(json).toMatchObject({
      ok: true,
      appMode: 'booth',
      cache: expect.any(Object),
      game: expect.any(Object),
      services: expect.any(Object),
      network: expect.any(Object),
      errors: expect.any(Object),
    });
    expect(typeof json.uptimeMs).toBe('number');
    expect(typeof json.connectedClients).toBe('number');
  });

  it('/api/diagnostics requires host auth and does not leak sensitive words', async () => {
    const unauthorized = await fetch(`${BASE_URL}/api/diagnostics`);
    expect(unauthorized.status).toBe(401);

    const cookie = await loginCookie();
    const response = await fetch(`${BASE_URL}/api/diagnostics`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const json: any = await response.json();
    expect(json).toHaveProperty('health');
    expect(json).toHaveProperty('network');
    expect(json).toHaveProperty('websocket');
    expect(json).toHaveProperty('game');
    expect(json).toHaveProperty('cache');
    expect(json).toHaveProperty('scores');
    expect(json).toHaveProperty('recentErrors');

    const text = JSON.stringify(json).toLowerCase();
    expect(text).not.toContain('diagnostics-password');
    expect(text).not.toContain('bbc_host_auth');
    expect(text).not.toContain('bbc_csrf');
    expect(text).not.toContain('csrf');
    expect(text).not.toContain('cookie');
    expect(text).not.toContain('token');
  });

  it('WebSocket client count is visible in diagnostics', async () => {
    const cookie = await loginCookie();
    const ws = new WebSocket(WS_URL);
    await waitForOpen(ws);
    ws.send(JSON.stringify({ type: 'hello', role: 'player' }));
    await waitForMessage(ws, 'state');

    const response = await fetch(`${BASE_URL}/api/diagnostics`, { headers: { cookie } });
    const json: any = await response.json();
    expect(json.websocket.connectedClients).toBeGreaterThanOrEqual(1);
    expect(json.websocket.roles.player).toBeGreaterThanOrEqual(1);
    ws.close();
  });

  it('/api/diagnostics/export returns the same safe export shape', async () => {
    const cookie = await loginCookie();
    const response = await fetch(`${BASE_URL}/api/diagnostics/export`, { headers: { cookie } });
    expect(response.status).toBe(200);
    const json: any = await response.json();
    expect(json.exportMode).toBe(true);
    expect(json.recentErrors).toEqual(expect.any(Array));
  });

  async function loginCookie() {
    const response = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'password=diagnostics-password',
    });
    expect(response.status).toBe(200);
    return response.headers.getSetCookie().join('; ');
  }
});

function waitForOpen(ws: WebSocket) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

function waitForMessage(ws: WebSocket, type: string, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(`Timeout waiting for ${type}`));
    }, timeout);
    function onMessage(data: WebSocket.RawData) {
      const msg = JSON.parse(data.toString());
      if (msg.type !== type) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(msg);
    }
    ws.on('message', onMessage);
    ws.once('error', reject);
  });
}

async function waitForServer(url: string, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout waiting for server at ${url}`);
}
