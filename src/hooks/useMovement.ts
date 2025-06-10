// --- START OF FILE src/hooks/useMovement.ts ---

import { useEffect } from 'react';
import { Player, GameConfig } from '../types/game';
import gameWebSocket from '../lib/websocket';
import { updatePlayerPosition } from '../lib/supabase';

// Коэффициент интерполяции. Чем меньше, тем плавнее (но и "отставание" больше)
const LERP_FACTOR = 0.2;

// Функция линейной интерполяции
const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

// Храним последнее время обновления для Supabase вне компонента, чтобы избежать сброса
let lastDbUpdateTime = 0;

export const useMovement = (
  // players и playersRef больше не нужны здесь
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
  movement: { up: boolean; down: boolean; left: boolean; right: boolean; },
  currentPlayer: Player | null,
  gameConfig: GameConfig
) => {
  useEffect(() => {
    if (!currentPlayer) return;

    let animationFrameId: number;

    const gameLoop = () => {
      setPlayers(prevPlayers => {
        const now = Date.now();

        return prevPlayers.map((p) => {
          // Логика для ТЕКУЩЕГО игрока (прямое управление)
          if (p.id === currentPlayer.id) {
            const { moveSpeed, fieldWidth, fieldHeight, playerSize } = gameConfig;
            let { x, y } = p;

            if (movement.up) y = Math.max(0, y - moveSpeed);
            if (movement.down) y = Math.min(fieldHeight - playerSize, y + moveSpeed);
            if (movement.left) x = Math.max(0, x - moveSpeed);
            if (movement.right) x = Math.min(fieldWidth - playerSize, x + moveSpeed);
            
            // Если позиция изменилась, отправляем данные
            if (x !== p.x || y !== p.y) {
              // Отправляем по WebSocket на каждом изменении для плавной отрисовки у других
              gameWebSocket.sendPosition(p.id, x, y);

              // Обновляем в БД реже (throttling) для снижения нагрузки
              if (now - lastDbUpdateTime > 100) {
                lastDbUpdateTime = now;
                updatePlayerPosition(p.id, x, y).catch(err => console.error("Failed to sync position", err));
              }
              
              return { ...p, x, y };
            }
            return p;
          } 
          // Логика для ДРУГИХ игроков (интерполяция)
          else {
            const targetX = p.targetX ?? p.x;
            const targetY = p.targetY ?? p.y;
            
            // Если почти на месте, прекращаем интерполяцию для экономии ресурсов
            if (Math.abs(p.x - targetX) < 0.1 && Math.abs(p.y - targetY) < 0.1) {
              // Устанавливаем точную позицию, чтобы остановить дрожание
               if (p.x !== targetX || p.y !== targetY) {
                 return { ...p, x: targetX, y: targetY };
               }
               return p;
            }

            // Плавное движение к цели
            const newX = lerp(p.x, targetX, LERP_FACTOR);
            const newY = lerp(p.y, targetY, LERP_FACTOR);
            
            return { ...p, x: newX, y: newY };
          }
        });
      });

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  // Убираем setPlayers из зависимостей, так как она стабильна, и убираем players
  }, [movement, currentPlayer, gameConfig]); 
};