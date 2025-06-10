import { Player } from '../types/game';

type WebSocketMessage = {
  type: 'position' | 'player_joined' | 'player_left';
  payload: {
    playerId: string;
    x?: number;
    y?: number;
    name?: string;
    color?: string;
  };
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

  constructor(private url: string) {
    console.log('WebSocket URL:', url);
    this.connect();
  }

  connect() {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    console.log('Connecting to WebSocket...');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        
        // Отправляем все сообщения из очереди
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(message);
          }
        }

        // Запускаем таймер обновления позиций
        this.startPositionUpdates();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('Received WebSocket message:', message);
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

    const now = Date.now();
    if (now - this.lastPositionUpdate < this.positionUpdateInterval) return;

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
    this.lastPositionUpdate = now;
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectTimeout * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    this.stopPositionUpdates();
    if (this.ws) {
      console.log('Disconnecting WebSocket...');
      this.ws.close();
      this.ws = null;
    }
  }

  sendPosition(playerId: string, x: number, y: number) {
    // Буферизируем позицию
    this.positionBuffer.set(playerId, { x, y });
  }

  sendPlayerJoined(player: { id: string; name: string; color: string }) {
    const message = JSON.stringify({
      type: 'player_joined',
      payload: {
        playerId: player.id,
        name: player.name,
        color: player.color
      }
    });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      if (!this.isConnecting) {
        this.connect();
      }
      return;
    }

    this.ws.send(message);
  }

  sendPlayerLeft(playerId: string) {
    const message = JSON.stringify({
      type: 'player_left',
      payload: { playerId }
    });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      if (!this.isConnecting) {
        this.connect();
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