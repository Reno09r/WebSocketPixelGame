// --- START OF FILE useGameState.ts ---

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Player, GameConfig } from '../types/game';
import {
  addPlayer,
  getPlayers,
  removePlayer,
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

  useEffect(() => {
    let playerId: string | null = null;
    let isMounted = true;

    const setupGame = async () => {
      try {
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
        if (!isMounted) {
          if (playerId) removePlayer(playerId);
          return;
        }
        
        setCurrentPlayer(newPlayer);
        
        const initialPlayers = await getPlayers();
        setPlayers(initialPlayers);
        setIsConnected(true);

        // Connect to WebSocket
        gameWebSocket.connect();

      } catch (err) {
        console.error('Error setting up game:', err);
        setError('Failed to connect to the game server. Check Supabase setup.');
      }
    };

    setupGame();

    const handleBeforeUnload = () => {
      if (playerId) {
        removePlayer(playerId);
      }
      gameWebSocket.disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (playerId) {
        removePlayer(playerId);
      }
      gameWebSocket.disconnect();
    };
  }, [initialName, gameConfig]);

  useEffect(() => {
    if (!isConnected) return;

    // WebSocket message handler
    const unsubscribe = gameWebSocket.onMessage((message) => {
      if (message.type === 'position') {
        const { playerId, x, y } = message.payload;
        if (playerId !== currentPlayer?.id) {
          setPlayers(prev => prev.map(p => 
            p.id === playerId ? { ...p, x, y } : p
          ));
        }
      }
    });

    // Supabase subscription for player management
    const subscription = subscribeToPlayers(
      (updatedPlayers: Player[], eventType: string) => {
        const playerRecord = updatedPlayers[0];
        if (!playerRecord) return;

        switch (eventType) {
          case 'INSERT':
            setPlayers((prev) =>
              prev.some((p) => p.id === playerRecord.id)
                ? prev
                : [...prev, playerRecord]
            );
            break;
          case 'UPDATE':
            setPlayers((prev) =>
              prev.map((p) => {
                if (p.id === playerRecord.id) {
                  if (p.id === currentPlayer?.id) {
                    return {
                      ...playerRecord,
                      x: currentPlayer.x,
                      y: currentPlayer.y,
                    };
                  }
                  return { ...p, ...playerRecord };
                }
                return p;
              })
            );
            break;
          case 'DELETE':
            setPlayers((prev) => prev.filter((p) => p.id !== playerRecord.id));
            break;
        }
      }
    );

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      unsubscribe();
    };
  }, [isConnected, currentPlayer]);
  
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

        setCurrentPlayer(newPlayerState);
        setPlayers((prevPlayers) =>
          prevPlayers.map((p) => (p.id === currentPlayer.id ? newPlayerState : p))
        );

        const now = Date.now();
        if (now - lastUpdateTime.current > 50) { // Reduced update interval for smoother movement
          lastUpdateTime.current = now;
          
          // Отправляем обновление через WebSocket
          gameWebSocket.sendPosition(currentPlayer.id, x, y);
          
          // Обновляем в Supabase только каждые 500мс для уменьшения нагрузки
          if (now % 500 < 50) {
            updatePlayerPosition(currentPlayer.id, x, y).catch((err) => {
              console.error('Failed to sync position to Supabase:', err);
            });
          }
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
        
        await updatePlayerNameInDb(currentPlayer.id, name);
      } catch (err) {
        console.error('Error updating player name:', err);
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