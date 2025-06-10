// --- START OF FILE server/src/index.ts ---

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { removePlayer } from './supabase';
import 'dotenv/config';

// Типы сообщений
type PositionMessage = {
  type: 'position';
  payload: { playerId: string; x: number; y: number };
};

type PlayerJoinedMessage = {
  type: 'player_joined';
  payload: { id: string; name: string; color: string; x: number; y: number };
};

type PlayerLeftMessage = {
  type: 'player_left';
  payload: { playerId: string };
};

type GameStateMessage = {
  type: 'game_state';
  payload: {
    players: Array<{ id: string; name: string; color: string; x: number; y: number }>;
  };
};

type GameMessage = PositionMessage | PlayerJoinedMessage | PlayerLeftMessage | GameStateMessage;

// Интерфейс для хранения данных о клиенте на сервере
interface ClientData {
  ws: WebSocket;
  // Данные об игроке становятся доступны после сообщения 'player_joined'
  playerData?: { id: string; name: string; color: string; x: number; y: number; };
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

  private handleConnection(ws: WebSocket, req: any) {
    // Получаем ID клиента из URL-параметров
    const url = new URL(req.url, `http://${req.headers.host}`);
    const clientId = url.searchParams.get('playerId');

    if (!clientId) {
      console.error('Connection attempt without playerId. Closing connection.');
      ws.close();
      return;
    }

    console.log(`Client connected: ${clientId}`);

    // Сразу сохраняем WebSocket соединение клиента.
    // Не отправляем состояние игры, ждем 'player_joined' от клиента.
    this.clients.set(clientId, { ws });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
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
      
      // Надежное удаление из БД на сервере
      await removePlayer(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Client error (${clientId}):`, error);
    });
  }

  private handleMessage(senderId: string, message: GameMessage) {
    console.log(`Received message from ${senderId} of type ${message.type}`);
    const client = this.clients.get(senderId);
    if (!client) return;

    switch (message.type) {
      case 'player_joined':
        // 1. Сохраняем полные данные об игроке на сервере.
        client.playerData = message.payload;
        console.log(`Player data for ${senderId} registered:`, client.playerData.name);

        // 2. Отправляем ПОЛНОЕ состояние игры ТОЛЬКО этому новому клиенту.
        // Это гарантирует, что он получит список всех, включая себя.
        const allPlayers = Array.from(this.clients.values())
                              .filter(c => c.playerData) // Убеждаемся, что данные игрока существуют
                              .map(c => c.playerData!);
                              
        const gameStateMessage: GameStateMessage = {
          type: 'game_state',
          payload: { players: allPlayers },
        };
        client.ws.send(JSON.stringify(gameStateMessage));
        console.log(`Sent initial game_state to ${senderId}`);
        
        // 3. Транслируем событие о присоединении ВСЕМ ОСТАЛЬНЫМ клиентам.
        this.broadcast(message, senderId);
        console.log(`Broadcasted player_joined for ${senderId} to other clients`);
        break;

      case 'position':
        if (client.playerData) {
          // Обновляем позицию на сервере для консистентности
          client.playerData.x = message.payload.x;
          client.playerData.y = message.payload.y;
          // Транслируем всем остальным
          this.broadcast(message, senderId);
        }
        break;

      default:
        // Используем as any для доступа к message.type для логирования
        console.warn(`Unknown message type from ${senderId}:`, (message as any).type);
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
}

const PORT = Number(process.env.PORT) || 3001;
new GameServer(PORT);