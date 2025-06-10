// --- START OF FILE websocket.ts ---

import { Player } from '../types/game';

type WebSocketMessage = {
  type: 'position' | 'player_joined' | 'player_left' | 'game_state';
  payload: any;
};

class GameWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private isConnecting = false;
  private messageQueue: string[] = [];
  private lastPositionUpdate = 0;
  private positionUpdateInterval = 1000 / 60; // 60 FPS
  private positionBuffer: Map<string, { x: number; y: number }> = new Map();
  private positionUpdateTimer: number | null = null;
  private playerId: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    console.log('WebSocket Base URL:', baseUrl);
  }

  connect(playerId: string) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    this.playerId = playerId;

    const urlWithPlayer = `${this.baseUrl}?playerId=${playerId}`;

    this.isConnecting = true;
    console.log('Connecting to WebSocket with URL:', urlWithPlayer);

    try {
      this.ws = new WebSocket(urlWithPlayer);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(message);
          }
        }

        this.startPositionUpdates();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.messageHandlers.forEach(handler => handler(message));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopPositionUpdates();
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private startPositionUpdates() {
    if (this.positionUpdateTimer === null) {
      this.positionUpdateTimer = window.setInterval(() => {
        this.flushPositionBuffer();
      }, this.positionUpdateInterval);
    }
  }

  private stopPositionUpdates() {
    if (this.positionUpdateTimer !== null) {
      window.clearInterval(this.positionUpdateTimer);
      this.positionUpdateTimer = null;
    }
  }

  private flushPositionBuffer() {
    if (this.positionBuffer.size === 0) return;

    this.positionBuffer.forEach((position, playerId) => {
      const message = JSON.stringify({
        type: 'position',
        payload: { playerId, ...position }
      });

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      } else {
        this.messageQueue.push(message);
      }
    });

    this.positionBuffer.clear();
    this.lastPositionUpdate = Date.now();
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.playerId) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect(this.playerId!);
      }, this.reconnectTimeout * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached or no player ID.');
    }
  }

  disconnect() {
    this.stopPositionUpdates();
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Предотвращаем переподключение
      console.log('Disconnecting WebSocket...');
      this.ws.close();
      this.ws = null;
    }
  }

  sendPosition(playerId: string, x: number, y: number) {
    this.positionBuffer.set(playerId, { x, y });
  }

  sendPlayerJoined(player: { id: string; name: string; color: string; x: number, y: number }) {
    const message = JSON.stringify({
      type: 'player_joined',
      payload: player
    });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      if (!this.isConnecting && this.playerId) { // <<<< ИЗМЕНЕНИЕ
        this.connect(this.playerId); // <<<< ИЗМЕНЕНИЕ: Передаем сохраненный ID
      }
      return;
    }

    this.ws.send(message);
  }

  // Метод sendPlayerLeft больше не нужен на клиенте, так как сервер сам обрабатывает выход,
  // но оставим его на случай, если он понадобится для других целей.
  sendPlayerLeft(playerId: string) {
    const message = JSON.stringify({
      type: 'player_left',
      payload: { playerId }
    });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      if (!this.isConnecting && this.playerId) { // <<<< ИЗМЕНЕНИЕ
         this.connect(this.playerId); // <<<< ИЗМЕНЕНИЕ: Передаем сохраненный ID
      }
      return;
    }

    this.ws.send(message);
  }

  onMessage(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3001';
console.log('Initializing WebSocket with URL:', wsUrl);
export const gameWebSocket = new GameWebSocket(wsUrl);

export default gameWebSocket;