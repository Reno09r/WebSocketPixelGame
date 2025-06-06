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
        
        console.log('Adding new player to database:', newPlayer);
        await addPlayer(newPlayer);
        
        if (!isMounted) {
          console.log('Component unmounted during setup, cleaning up...');
          if (playerId) await removePlayer(playerId);
          return;
        }
        
        setCurrentPlayer(newPlayer);
        
        console.log('Fetching initial players list...');
        const initialPlayers = await getPlayers();
        console.log('Initial players:', initialPlayers);
        
        setPlayers(initialPlayers);
        setIsConnected(true);

        // Connect to WebSocket
        console.log('Connecting to WebSocket...');
        gameWebSocket.connect();

      } catch (err) {
        console.error('Error setting up game:', err);
        setError('Failed to connect to the game server. Please check your connection and try again.');
        setIsConnected(false);
      }
    };

    setupGame();

    const handleBeforeUnload = async () => {
      console.log('Window unloading, cleaning up...');
      if (playerId) {
        try {
          await removePlayer(playerId);
        } catch (err) {
          console.error('Error removing player during unload:', err);
        }
      }
      gameWebSocket.disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('Component unmounting, cleaning up...');
      isMounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (playerId) {
        removePlayer(playerId).catch(err => {
          console.error('Error removing player during cleanup:', err);
        });
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
        if (!playerRecord) {
          console.warn('Received empty player record in event:', eventType);
          return;
        }

        console.log('Processing player event:', {
          type: eventType,
          playerId: playerRecord.id,
          playerName: playerRecord.name
        });

        switch (eventType) {
          case 'INSERT':
            setPlayers((prev) => {
              // Проверяем, не является ли это текущим игроком
              if (playerRecord.id === currentPlayer?.id) {
                console.log('Ignoring INSERT event for current player');
                return prev;
              }
              console.log('Adding new player to state:', playerRecord);
              return [...prev, playerRecord];
            });
            break;
          case 'UPDATE':
            setPlayers((prev) => {
              // Если это текущий игрок, сохраняем его текущую позицию
              if (playerRecord.id === currentPlayer?.id) {
                console.log('Updating current player while preserving position');
                return prev.map((p) => {
                  if (p.id === currentPlayer.id) {
                    return {
                      ...playerRecord,
                      x: currentPlayer.x,
                      y: currentPlayer.y,
                    };
                  }
                  return p;
                });
              }
              console.log('Updating player in state:', playerRecord);
              return prev.map((p) => 
                p.id === playerRecord.id ? { ...p, ...playerRecord } : p
              );
            });
            break;
          case 'DELETE':
            setPlayers((prev) => {
              console.log('Removing player from state:', playerRecord.id);
              return prev.filter((p) => p.id !== playerRecord.id);
            });
            break;
          default:
            console.warn('Unknown event type:', eventType);
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

        // Немедленно обновляем локальное состояние
        setCurrentPlayer(newPlayerState);
        setPlayers((prevPlayers) =>
          prevPlayers.map((p) => (p.id === currentPlayer.id ? newPlayerState : p))
        );

        // Отправляем обновление через WebSocket без задержки
        gameWebSocket.sendPosition(currentPlayer.id, x, y);
        
        // Обновляем в Supabase без задержки
        updatePlayerPosition(currentPlayer.id, x, y).catch((err) => {
          console.error('Failed to sync position to Supabase:', err);
        });
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