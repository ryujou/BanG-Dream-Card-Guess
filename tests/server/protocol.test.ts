import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import WebSocket from 'ws';

describe('Server Protocol Tests', () => {
  let serverProcess;
  const PORT = 5174;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  const WS_URL = `ws://127.0.0.1:${PORT}/ws`;
  
  beforeAll(async () => {
    serverProcess = spawn('node', ['server.mjs'], {
      env: { ...process.env, PORT: PORT.toString(), HOST_PASSWORD: 'test-password' }
    });

    serverProcess.stdout.on('data', (d) => console.log('SERVER STDOUT:', d.toString()));
    serverProcess.stderr.on('data', (d) => console.log('SERVER STDERR:', d.toString()));

    // wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'password=wrong'
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it('HTTP: /api/login with correct password should succeed', async () => {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
});
