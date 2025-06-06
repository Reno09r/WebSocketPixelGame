import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

// Типы сообщений
type PositionMessage = {
  type: 'position';
  payload: {
    playerId: string;
    x: number;
    y: number;
  };
};

type ConnectionMessage = {
  type: 'connection';
  payload: {
    clientId: string;
  };
};

type PlayerLeftMessage = {
  type: 'player_left';
  payload: {
    playerId: string;
  };
};

type GameMessage = PositionMessage | ConnectionMessage | PlayerLeftMessage;

// Класс для управления игровым сервером
class GameServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();

  constructor(port: number) {
    const server = createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', this.handleConnection.bind(this));

    server.listen(port, () => {
      console.log(`Game server is running on port ${port}`);
    });
  }

  private handleConnection(ws: WebSocket) {
    const clientId = this.generateClientId();
    console.log(`Client connected: ${clientId}`);
    
    this.clients.set(clientId, ws);

    // Отправляем клиенту его ID
    const connectionMessage: ConnectionMessage = {
      type: 'connection',
      payload: { clientId }
    };
    ws.send(JSON.stringify(connectionMessage));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as GameMessage;
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
      const playerLeftMessage: PlayerLeftMessage = {
        type: 'player_left',
        payload: { playerId: clientId }
      };
      this.broadcast(playerLeftMessage, clientId);
    });

    ws.on('error', (error) => {
      console.error(`Client error (${clientId}):`, error);
    });
  }

  private handleMessage(senderId: string, message: GameMessage) {
    console.log(`Received message from ${senderId}:`, message);

    switch (message.type) {
      case 'position':
        // Валидация позиции
        if (
          typeof message.payload.x === 'number' &&
          typeof message.payload.y === 'number' &&
          !isNaN(message.payload.x) &&
          !isNaN(message.payload.y)
        ) {
          this.broadcast(message, senderId);
        } else {
          console.error('Invalid position data:', message);
        }
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private broadcast(message: GameMessage, excludeClientId?: string) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

// Запускаем сервер
const PORT = Number(process.env.PORT) || 3001;
new GameServer(PORT); 