// --- START OF FILE index.ts ---

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { removePlayer } from './supabase';

// Типы сообщений
type PositionMessage = {
  type: 'position';
  payload: { playerId: string; x: number; y: number };
};

// ИЗМЕНЕНО: Этот тип больше не нужен, используем ID при подключении
// type ConnectionMessage = { ... };

type PlayerJoinedMessage = {
  type: 'player_joined';
  payload: { id: string; name: string; color: string; x: number; y: number };
};

type PlayerLeftMessage = {
  type: 'player_left';
  payload: { playerId: string };
};

// ДОБАВЛЕНО: Сообщение со всем состоянием игры для нового игрока
type GameStateMessage = {
  type: 'game_state';
  payload: {
    players: Array<{ id: string; name: string; color: string; x: number; y: number }>;
  };
};

type GameMessage = PositionMessage | PlayerJoinedMessage | PlayerLeftMessage | GameStateMessage;

// ДОБАВЛЕНО: Интерфейс для хранения данных о клиенте
interface ClientData {
  ws: WebSocket;
  playerData: { id: string; name: string; color: string; x: number; y: number; };
}

// Класс для управления игровым сервером
class GameServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientData> = new Map(); 

  constructor(port: number) {
    const server = createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', this.handleConnection.bind(this));

    server.listen(port, () => {
      console.log(`Game server is running on port ${port}`);
    });
  }

  // ИЗМЕНЕНО: handleConnection теперь принимает ID от клиента
  private handleConnection(ws: WebSocket, req: any) {
    // Клиент должен передать свой ID в URL, например: ws://localhost:3001?playerId=...
    // Это более надежно, чем генерировать ID на сервере после создания игрока в БД.
    const url = new URL(req.url, `http://${req.headers.host}`);
    const clientId = url.searchParams.get('playerId');

    if (!clientId) {
      console.error('Connection attempt without playerId. Closing connection.');
      ws.close();
      return;
    }

    console.log(`Client connected: ${clientId}`);

    // Отправляем новому клиенту состояние всех существующих игроков
    const allPlayers = Array.from(this.clients.values()).map(c => c.playerData);
    const gameStateMessage: GameStateMessage = {
      type: 'game_state',
      payload: { players: allPlayers },
    };
    ws.send(JSON.stringify(gameStateMessage));

    // Сохраняем клиента, но пока без playerData. Оно придет с сообщением 'player_joined'
    this.clients.set(clientId, { ws, playerData: null! }); // null! - временное значение

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()); // as GameMessage убрали, так как типы payload разные
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', async () => {
      console.log(`Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
      
      // Оповещаем всех остальных, что игрок ушел
      const playerLeftMessage: PlayerLeftMessage = {
        type: 'player_left',
        payload: { playerId: clientId },
      };
      this.broadcast(playerLeftMessage, clientId);
      
      // ИЗМЕНЕНО: Надежное удаление из БД на сервере
      await removePlayer(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Client error (${clientId}):`, error);
    });
  }

  private handleMessage(senderId: string, message: any) {
    console.log(`Received message from ${senderId}:`, message.type);

    switch (message.type) {
      case 'position':
        if (
          typeof message.payload.x === 'number' &&
          typeof message.payload.y === 'number'
        ) {
          // Обновляем позицию игрока на сервере
          const client = this.clients.get(senderId);
          if (client && client.playerData) {
            client.playerData.x = message.payload.x;
            client.playerData.y = message.payload.y;
          }
          this.broadcast(message, senderId);
        } else {
          console.error('Invalid position data:', message);
        }
        break;

      // ДОБАВЛЕНО: Обработка присоединения нового игрока
      case 'player_joined':
        const client = this.clients.get(senderId);
        if (client) {
          // Сохраняем полные данные об игроке
          client.playerData = message.payload;
          console.log(`Player data for ${senderId} updated:`, client.playerData.name);
          // Транслируем это событие всем остальным клиентам
          this.broadcast(message, senderId);
        }
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private broadcast(message: GameMessage, excludeClientId?: string) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  // Этот метод больше не нужен, ID генерируется на клиенте
  // private generateClientId(): string { ... }
}

const PORT = Number(process.env.PORT) || 3001;
new GameServer(PORT);