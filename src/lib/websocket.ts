// --- START OF FILE src/lib/websocket.ts ---

import { Player } from '../types/game';

type WebSocketMessage = {
  type: 'position' | 'player_joined' | 'player_left' | 'game_state';
  payload: any;
};

type WsEvent = 'connected' | 'disconnected';

class GameWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private eventHandlers: { [key in WsEvent]?: (() => void)[] } = {};
  private isConnecting = false;
  private messageQueue: string[] = [];
  private positionBuffer: Map<string, { x: number; y: number }> = new Map();
  private positionUpdateTimer: number | null = null;
  private positionUpdateInterval = 1000 / 30;
  private playerId: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  connect(player: Player) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    this.playerId = player.id;
    const urlWithPlayer = `${this.baseUrl}?playerId=${player.id}`;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(urlWithPlayer);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully. Firing "connected" event.');
        this.isConnecting = false;
        
        this.fireEvent('connected');

        const joinMessage = JSON.stringify({
          type: 'player_joined',
          payload: player
        });
        this.ws?.send(joinMessage);
        

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
          this.messageHandlers.forEach(handler => handler(message));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected. Firing "disconnected" event.');
        this.isConnecting = false;
        this.fireEvent('disconnected');
        this.attemptReconnect(player);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect(player);
    }
  }

  private attemptReconnect(player: Player) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(player), this.reconnectTimeout * this.reconnectAttempts);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: WsEvent, handler: () => void) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event]?.push(handler);
  }
  
  off(event: WsEvent, handler: () => void) {
    this.eventHandlers[event] = this.eventHandlers[event]?.filter(h => h !== handler);
  }

  private fireEvent(event: WsEvent) {
    this.eventHandlers[event]?.forEach(handler => handler());
  }
  
  requestGameState() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("Requesting game state from server...");
      this.ws.send(JSON.stringify({ type: 'request_game_state' }));
    } else {
      console.error("Cannot request game state: WebSocket is not open.");
    }
  }

  sendPosition(playerId: string, x: number, y: number) {
    this.positionBuffer.set(playerId, { x, y });
    if (!this.positionUpdateTimer) {
        this.positionUpdateTimer = window.setInterval(() => {
            if (this.ws?.readyState !== WebSocket.OPEN) return;
            const positionMessages: string[] = [];
            this.positionBuffer.forEach((pos, id) => {
                positionMessages.push(JSON.stringify({
                    type: 'position', payload: { playerId: id, x: pos.x, y: pos.y }
                }));
            });
            if (positionMessages.length > 0) {
                positionMessages.forEach(msg => this.ws?.send(msg));
                this.positionBuffer.clear();
            }
        }, this.positionUpdateInterval);
    }
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
export const gameWebSocket = new GameWebSocket(wsUrl);

export default gameWebSocket;