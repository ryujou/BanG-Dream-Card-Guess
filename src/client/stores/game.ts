import { defineStore } from 'pinia';
import { ref, readonly } from 'vue';
import type { AppSnapshot, ServerMessage } from '../../shared/types/websocket';

export const useGameStore = defineStore('game', () => {
  const snapshot = ref<AppSnapshot | null>(null);
  const connected = ref(false);
  const connectionError = ref('');
  const currentRole = ref<string>('home');
  
  let socket: WebSocket | null = null;
  let reconnectTimeout: number | null = null;

  function connect(role: string) {
    if (socket) {
      if (currentRole.value === role && connected.value) return;
      disconnect();
    }
    
    currentRole.value = role;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${location.host}/ws`);

    socket.addEventListener('open', () => {
      connected.value = true;
      socket?.send(JSON.stringify({ type: 'hello', role: role === 'solo' ? 'self' : role }));
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    });

    socket.addEventListener('close', () => {
      connected.value = false;
      socket = null;
      // Auto reconnect
      reconnectTimeout = window.setTimeout(() => connect(currentRole.value), 1200);
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === 'state') {
          snapshot.value = message.state;
          connectionError.value = '';
        } else if (message.type === 'authRequired' && ['host', 'settings'].includes(currentRole.value)) {
          window.location.href = '/login';
        } else if (message.type === 'error') {
          connectionError.value = message.message || '操作失败';
          if (snapshot.value?.game) {
            snapshot.value.game.loading = false;
            if (snapshot.value.game.status === 'loading') {
              snapshot.value.game.status = 'idle';
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    });
  }

  function command(commandStr: string, payload: Record<string, unknown> = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'command', command: commandStr, payload }));
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
    connected.value = false;
  }

  return {
    snapshot,
    connected: readonly(connected),
    connectionError,
    connect,
    command,
    disconnect
  };
});
