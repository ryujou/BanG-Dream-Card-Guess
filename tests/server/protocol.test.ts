import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import WebSocket from 'ws';

describe('Server Protocol Tests', () => {
  let serverProcess;
  const PORT = 17000 + Math.floor(Math.random() * 1000);
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  const WS_URL = `ws://127.0.0.1:${PORT}/ws`;
  
  beforeAll(async () => {
    serverProcess = spawn('node', ['server.mjs'], {
      env: { ...process.env, PORT: PORT.toString(), HOST_PASSWORD: 'test-password' }
    });

    serverProcess.stdout.on('data', (d) => console.log('SERVER STDOUT:', d.toString()));
    serverProcess.stderr.on('data', (d) => console.log('SERVER STDERR:', d.toString()));

    await waitForServer(`${BASE_URL}/api/health`);
  });

  afterAll(() => {
    if (serverProcess) serverProcess.kill();
  });

  it('HTTP: /api/health should return public health snapshot', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('totalCards');
    expect(json).toHaveProperty('roleCounts');
  });

  it('HTTP: /api/login with wrong password should fail', async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': BASE_URL },
      body: 'password=wrong'
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it('HTTP: /api/login with correct password should succeed', async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': BASE_URL },
      body: 'password=test-password'
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some(c => c.includes('bbc_host_auth='))).toBe(true);
    expect(setCookie.some(c => c.includes('bbc_csrf='))).toBe(true);
  });

  it('WS: connect and send hello message', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let stateReceived = false;

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'hello', role: 'player' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'state') {
          stateReceived = true;
          expect(msg.state).toHaveProperty('appMode');
          expect(msg.state).toHaveProperty('settings');
          expect(msg.state).toHaveProperty('game');
          ws.close();
          resolve(true);
        }
      });

      ws.on('error', reject);
      setTimeout(() => {
        if (!stateReceived) reject(new Error('Timeout waiting for state message'));
      }, 2000);
    });
  });

  it('WS: host role triggers authRequired without auth', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'hello', role: 'host' }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'authRequired') {
          ws.close();
          resolve(true);
        }
      });

      ws.on('error', reject);
    });
  });

  it('WS: unauthenticated player cannot execute host-only start command', async () => {
    const ws = new WebSocket(WS_URL);
    await waitForOpen(ws);
    ws.send(JSON.stringify({ type: 'hello', role: 'player' }));
    await waitForType(ws, 'state');
    ws.send(JSON.stringify({ type: 'command', command: 'start', payload: {} }));
    const msg = await waitForType(ws, 'error');
    expect(msg).toHaveProperty('type', 'error');
    expect(msg.message).toBeTruthy();
    ws.close();
  });

  it('WS: authenticated commands keep state message shape stable', async () => {
    const ws = new WebSocket(WS_URL);
    await waitForOpen(ws);
    ws.send(JSON.stringify({ type: 'hello', role: 'host' }));
    await waitForType(ws, 'authRequired');
    ws.send(JSON.stringify({ type: 'auth', password: 'test-password' }));
    const auth = await waitForType(ws, 'authResult');
    expect(auth.ok).toBe(true);
    await waitForType(ws, 'state');

    ws.send(JSON.stringify({ type: 'command', command: 'settings', payload: { autoNext: false, roundSeconds: 60 } }));
    const settingsState = await waitForType(ws, 'state');
    expectStateShape(settingsState);
    expect(settingsState.state.settings).toHaveProperty('roundSeconds');

    ws.send(JSON.stringify({ type: 'command', command: 'start', payload: {} }));
    const startState = await waitForType(ws, 'state', 10000);
    expectStateShape(startState);
    expect(startState.state.game).toHaveProperty('status');

    ws.send(JSON.stringify({ type: 'command', command: 'next', payload: {} }));
    const nextState = await waitForType(ws, 'state', 10000);
    expectStateShape(nextState);

    ws.send(JSON.stringify({ type: 'command', command: 'reveal', payload: {} }));
    const revealState = await waitForType(ws, 'state');
    expectStateShape(revealState);
    expect(revealState.state.game.status).toBe('revealed');

    ws.send(JSON.stringify({ type: 'command', command: 'reset', payload: {} }));
    const resetState = await waitForType(ws, 'state');
    expectStateShape(resetState);
    expect(resetState.state.game.status).toBe('idle');
    ws.close();
  }, 20000);

  it('WS: command errors keep protocol shape and connection remains usable', async () => {
    const ws = new WebSocket(WS_URL);
    await waitForOpen(ws);
    ws.send(JSON.stringify({ type: 'hello', role: 'host' }));
    await waitForType(ws, 'authRequired');
    ws.send(JSON.stringify({ type: 'auth', password: 'test-password' }));
    await waitForType(ws, 'authResult');
    await waitForType(ws, 'state');

    ws.send(JSON.stringify({ type: 'command', command: 'not-a-command', payload: {} }));
    const error = await waitForType(ws, 'error');
    expect(error).toHaveProperty('type', 'error');
    expect(typeof error.message).toBe('string');

    ws.send(JSON.stringify({ type: 'command', command: 'reset', payload: {} }));
    const resetState = await waitForType(ws, 'state');
    expectStateShape(resetState);
    expect(resetState.state.game.status).toBe('idle');
    ws.close();
  });
});

function waitForOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

async function waitForServer(url, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry until timeout
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout waiting for server at ${url}`);
}

function waitForType(ws, type, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(`Timeout waiting for ${type}`));
    }, timeout);
    function onMessage(data) {
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

function expectStateShape(msg) {
  expect(msg).toHaveProperty('type', 'state');
  expect(msg.state).toHaveProperty('appMode');
  expect(msg.state).toHaveProperty('settings');
  expect(msg.state).toHaveProperty('meta');
  expect(msg.state).toHaveProperty('health');
  expect(msg.state).toHaveProperty('game');
  expect(msg.state.game).toHaveProperty('status');
  expect(msg.state.game).toHaveProperty('score');
  expect(msg.state.game).toHaveProperty('streak');
  expect(msg.state.game).toHaveProperty('history');
}
