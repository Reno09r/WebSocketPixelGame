// --- START OF FILE src/hooks/useGameState.ts ---

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Player, GameConfig } from '../types/game';
import {
  addPlayer,
  subscribeToPlayers,
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

  // useEffect для создания игрока
  useEffect(() => {
    let isMounted = true;
    const setupGame = async () => {
      try {
        const { x, y } = getCenterPosition(gameConfig);
        const playerId = uuidv4();
        const playerColor = getRandomColor();
        
        const newPlayer: Player = {
          id: playerId,
          name: initialName || `Player-${playerId.substring(0, 4)}`,
          x,
          y,
          color: playerColor,
          targetX: x,
          targetY: y,
        };
        
        await addPlayer(newPlayer);
        if (!isMounted) return;
        
        setCurrentPlayer(newPlayer);
        // Начальное состояние - только текущий игрок. Сервер пришлет остальных.
        setPlayers([newPlayer]);
        gameWebSocket.connect(newPlayer);
        setIsConnected(true);

      } catch (err) {
        console.error('Error setting up game:', err);
        setError('Failed to connect to the game server.');
      }
    };

    setupGame();

    const cleanup = () => {
      isMounted = false;
      console.log('Cleaning up game session...');
      gameWebSocket.disconnect();
    };
    
    window.addEventListener('beforeunload', cleanup);
    
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [initialName, gameConfig]);

  // useEffect для обработки сообщений WebSocket и подписок Supabase
  useEffect(() => {
    if (!isConnected || !currentPlayer?.id) return;

    // Устанавливаем обработчик для сообщений с сервера
    const handleWsMessage = (message: any) => {
      switch (message.type) {
        case 'game_state':
          // Это сообщение приходит один раз при подключении с полным списком игроков
          console.log("Received initial game state:", message.payload.players);
          const playersWithTargets = message.payload.players.map((p: Player) => ({
            ...p,
            targetX: p.x,
            targetY: p.y,
          }));
          setPlayers(playersWithTargets);
          break;

        case 'position':
          const { playerId, x, y } = message.payload;
          // Обновляем целевые координаты для других игроков для плавной интерполяции
          if (playerId !== currentPlayer?.id && x !== undefined && y !== undefined) {
            setPlayers(prev => prev.map(p => 
              p.id === playerId ? { ...p, targetX: x, targetY: y } : p
            ));
          }
          break;

        case 'player_joined':
          // Это сообщение приходит, когда ДРУГОЙ игрок присоединяется
          const newPlayerData: Player = message.payload;
          if (newPlayerData.id !== currentPlayer?.id) {
            setPlayers(prev => {
              // Предотвращаем дублирование, если игрок уже есть в списке
              if (prev.some(p => p.id === newPlayerData.id)) return prev;
              return [...prev, { ...newPlayerData, targetX: newPlayerData.x, targetY: newPlayerData.y }];
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
    
    // Подписка на Supabase для обновлений имени/цвета
    const subscription = subscribeToPlayers(
      (updatedPlayers: Player[], eventType: string) => {
        const playerRecord = updatedPlayers[0];
        if (!playerRecord || eventType !== 'UPDATE') return;

        setPlayers((prevPlayers) =>
          prevPlayers.map((p) => 
            p.id === playerRecord.id 
            ? { ...p, name: playerRecord.name, color: playerRecord.color } 
            : p
          )
        );
            
        if (playerRecord.id === currentPlayer?.id) {
          setCurrentPlayer(prev => prev ? { ...prev, name: playerRecord.name, color: playerRecord.color } : null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
      unsubscribeWs();
    };
  }, [isConnected, currentPlayer?.id]);

  const updatePlayerName = useCallback(
    async (name: string) => {
      if (!currentPlayer) return;
      try {
        const updatedPlayer = { ...currentPlayer, name };
        setCurrentPlayer(updatedPlayer);
        setPlayers((prevPlayers) =>
          prevPlayers.map((p) => (p.id === currentPlayer.id ? updatedPlayer : p))
        );
        await updatePlayerNameInDb(currentPlayer.id, name);
      } catch (err) {
        console.error('Error updating player name:', err);
      }
    },
    [currentPlayer]
  );
  
  return {
    players,
    setPlayers,
    currentPlayer,
    isConnected,
    error,
    updatePlayerName,
  };
};