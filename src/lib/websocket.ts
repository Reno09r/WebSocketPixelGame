import { Player } from '../types/game';

type WebSocketMessage = {
  type: 'position' | 'player_joined' | 'player_left';
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

  constructor(private url: string) {
    console.log('WebSocket URL:', url);
    this.connect();
  }

  connect() {
    if (this.isConnecting) {
      console.log('Already connecting...');
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
        
        // Отправляем все накопленные сообщения
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(message);
          }
        }
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
    if (this.ws) {
      console.log('Disconnecting WebSocket...');
      this.ws.close();
      this.ws = null;
    }
  }

  sendPosition(playerId: string, x: number, y: number) {
    const message = JSON.stringify({
      type: 'position',
      payload: { playerId, x, y }
    });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket not ready, queueing message');
      this.messageQueue.push(message);
      
      if (!this.isConnecting) {
        this.connect();
      }
      return;
    }

    console.log('Sending position update:', { playerId, x, y });
    this.ws.send(message);
  }

  onMessage(handler: (message: WebSocketMessage) => void) {
    console.log('Adding message handler');
    this.messageHandlers.push(handler);
    return () => {
      console.log('Removing message handler');
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