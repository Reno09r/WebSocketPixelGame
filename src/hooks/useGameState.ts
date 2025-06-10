// --- START OF FILE useGameState.ts ---

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Player, GameConfig } from '../types/game';
import {
  addPlayer,
  subscribeToPlayers,
  updatePlayerPosition,
  updatePlayerName as updatePlayerNameInDb,
} from '../lib/supabase';
import gameWebSocket from '../lib/websocket';

const getRandomColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 100%, 65%)`;
};

const getCenterPosition = (config: GameConfig): { x: number; y: number } => {
  return {
    x: Math.floor(config.fieldWidth / 2),
    y: Math.floor(config.fieldHeight / 2),
  };
};

export const useGameState = (
  initialName: string,
  gameConfig: GameConfig
) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastUpdateTime = useRef<number>(0);

  // Основной useEffect для создания и удаления игрока. Запускается один раз.
  useEffect(() => {
    let playerId: string | null = null;
    let isMounted = true;

    const setupGame = async () => {
      try {
        console.log('Setting up game...');
        const { x, y } = getCenterPosition(gameConfig);
        playerId = uuidv4();
        const playerColor = getRandomColor();
        
        const newPlayer: Player = {
          id: playerId,
          name: initialName || `Player-${playerId.substring(0, 4)}`,
          x,
          y,
          color: playerColor,
        };
        
        await addPlayer(newPlayer);
        
        if (!isMounted) return;
        
        setCurrentPlayer(newPlayer);
        // Добавляем текущего игрока в общий список сразу
        setPlayers([newPlayer]);
        
        // Подключаемся к WebSocket, передавая наш ID
        gameWebSocket.connect(newPlayer.id);

        // Отправляем сообщение о том, что мы присоединились, со всеми нашими данными
        gameWebSocket.sendPlayerJoined({ ...newPlayer });

        setIsConnected(true);

      } catch (err) {
        console.error('Error setting up game:', err);
        setError('Failed to connect to the game server. Please check your connection.');
      }
    };

    setupGame();

    const cleanup = () => {
      console.log('Cleaning up game session...');
      // Клиенту больше не нужно удалять себя из БД. Сервер сделает это по событию 'close'.
      gameWebSocket.disconnect();
    };

    // Упрощенный cleanup при закрытии вкладки/окна
    window.addEventListener('beforeunload', cleanup);
    
    return () => {
      isMounted = false;
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [initialName, gameConfig]);

  // Отдельный useEffect для обработки сообщений и подписок
  useEffect(() => {
    // Ждем, пока установится соединение и появится ID текущего игрока
    if (!isConnected || !currentPlayer?.id) return;

    // Обработчик сообщений WebSocket
    const handleWsMessage = (message: any) => { // Используем 'any' для гибкости payload
      console.log('Processing WebSocket message:', message);
      
      switch (message.type) {
        case 'game_state':
          // Устанавливаем список игроков, полученных от сервера
          setPlayers(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newPlayers = message.payload.players.filter((p: Player) => !existingIds.has(p.id));
            return [...prev, ...newPlayers];
          });
          break;

        case 'position':
          const { playerId, x, y } = message.payload;
          if (playerId !== currentPlayer?.id && x !== undefined && y !== undefined) {
            setPlayers(prev => prev.map(p => 
              p.id === playerId ? { ...p, x, y } : p
            ));
          }
          break;

        case 'player_joined':
          // Сервер присылает полный объект игрока
          const newPlayerData: Player = message.payload;
          if (newPlayerData.id !== currentPlayer?.id) {
            setPlayers(prev => {
              // Избегаем дублирования, если игрок уже есть в списке
              if (prev.some(p => p.id === newPlayerData.id)) {
                return prev;
              }
              return [...prev, newPlayerData];
            });
          }
          break;

        case 'player_left':
          const { playerId: leftPlayerId } = message.payload;
          setPlayers(prev => prev.filter(p => p.id !== leftPlayerId));
          break;

        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    };

    const unsubscribeWs = gameWebSocket.onMessage(handleWsMessage);

    // Подписка на Supabase для обновлений (имя, цвет и т.д.),
    // но не для добавления/удаления игроков, так как это теперь делается через WebSocket.
    const subscription = subscribeToPlayers(
      (updatedPlayers: Player[], eventType: string) => {
        const playerRecord = updatedPlayers[0];
        if (!playerRecord) return;
        
        // Обновляем только данные других игроков, чтобы избежать конфликтов с локальным состоянием
        if (eventType === 'UPDATE' && playerRecord.id !== currentPlayer?.id) {
           console.log('Received Supabase UPDATE for other player:', playerRecord.id);
           setPlayers((prev) =>
             prev.map((p) =>
               p.id === playerRecord.id ? { ...p, ...playerRecord } : p
             )
           );
        } else if (eventType === 'UPDATE' && playerRecord.id === currentPlayer?.id) {
            // Если пришло обновление для текущего игрока (например, имя изменено с другого устройства)
            console.log('Received Supabase UPDATE for current player:', playerRecord.name);
            setCurrentPlayer(prev => prev ? { ...prev, name: playerRecord.name, color: playerRecord.color } : null);
            setPlayers(prev => prev.map(p => p.id === playerRecord.id ? { ...p, name: playerRecord.name, color: playerRecord.color } : p));
        }
      }
    );

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      unsubscribeWs();
    };
  }, [isConnected, currentPlayer?.id]); // <<<< ВАЖНО: Зависимость от currentPlayer.id, а не всего объекта
  
  const handlePlayerMove = useCallback(
    (movement: { up: boolean; down: boolean; left: boolean; right: boolean; }) => {
      if (!currentPlayer) return;

      const { moveSpeed, fieldWidth, fieldHeight, playerSize } = gameConfig;
      let { x, y } = currentPlayer;

      if (movement.up) y = Math.max(0, y - moveSpeed);
      if (movement.down) y = Math.min(fieldHeight - playerSize, y + moveSpeed);
      if (movement.left) x = Math.max(0, x - moveSpeed);
      if (movement.right) x = Math.min(fieldWidth - playerSize, x + moveSpeed);
      
      if (x !== currentPlayer.x || y !== currentPlayer.y) {
        const newPlayerState = { ...currentPlayer, x, y };

        // Немедленно обновляем локальное состояние для плавности
        setCurrentPlayer(newPlayerState);
        setPlayers((prevPlayers) =>
          prevPlayers.map((p) => (p.id === currentPlayer.id ? newPlayerState : p))
        );

        // Отправляем обновление через WebSocket
        gameWebSocket.sendPosition(currentPlayer.id, x, y);
        
        // Обновляем в Supabase с задержкой (throttling)
        const now = Date.now();
        if (now - lastUpdateTime.current > 100) { // Обновляем Supabase не чаще чем раз в 100мс
          lastUpdateTime.current = now;
          updatePlayerPosition(currentPlayer.id, x, y).catch((err) => {
            console.error('Failed to sync position to Supabase:', err);
          });
        }
      }
    },
    [currentPlayer, gameConfig]
  );

  const updatePlayerName = useCallback(
    async (name: string) => {
      if (!currentPlayer) return;

      try {
        const updatedPlayer = { ...currentPlayer, name };
        setCurrentPlayer(updatedPlayer);
        setPlayers((prevPlayers) =>
          prevPlayers.map((p) => (p.id === currentPlayer.id ? updatedPlayer : p))
        );
        
        // Обновляем имя в базе данных, что вызовет real-time событие для других клиентов
        await updatePlayerNameInDb(currentPlayer.id, name);
      } catch (err) {
        console.error('Error updating player name:', err);
        // Можно добавить логику отката имени, если нужно
      }
    },
    [currentPlayer]
  );

  return {
    players,
    currentPlayer,
    isConnected,
    error,
    handlePlayerMove,
    updatePlayerName,
  };
};