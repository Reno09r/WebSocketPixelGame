import React, { useRef, useEffect } from 'react';
import { Player, GameConfig } from '../types/game';

interface GameFieldProps {
  players: Player[];
  currentPlayerId: string | null;
  gameConfig: GameConfig;
}

const GameField: React.FC<GameFieldProps> = ({
  players,
  currentPlayerId,
  gameConfig,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { fieldWidth, fieldHeight, playerSize } = gameConfig;

  // Scale factor for visual display
  const scale = 4; // Makes 1px game units appear as 4px visually
  const visualWidth = fieldWidth * scale;
  const visualHeight = fieldHeight * scale;

  // Draw the game field and all players
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, visualWidth, visualHeight);

    // Draw grid lines (every 20 game units)
    ctx.strokeStyle = '#292929';
    ctx.lineWidth = 1;

    // Draw vertical grid lines
    for (let x = 0; x <= fieldWidth; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, visualHeight);
      ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let y = 0; y <= fieldHeight; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(visualWidth, y * scale);
      ctx.stroke();
    }

    // Draw border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, visualWidth, visualHeight);

    // Draw players
    players.forEach((player) => {
      const visualSize = playerSize * scale;
      
      // Draw player square
      ctx.fillStyle = player.color;
      ctx.fillRect(
        player.x * scale, 
        player.y * scale, 
        visualSize, 
        visualSize
      );
      
      // Highlight current player with border
      if (player.id === currentPlayerId) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          player.x * scale - 1, 
          player.y * scale - 1, 
          visualSize + 2, 
          visualSize + 2
        );
      }
      
      // Draw player name
      ctx.font = '12px Arial';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(
        player.name, 
        player.x * scale + (visualSize / 2), 
        player.y * scale - 5
      );
    });
  }, [players, currentPlayerId, fieldWidth, fieldHeight, visualWidth, visualHeight, playerSize, scale]);

  return (
    <div className="game-field-container relative shadow-xl rounded-lg overflow-hidden border border-gray-700">
      <canvas
        ref={canvasRef}
        width={visualWidth}
        height={visualHeight}
        className="block"
      />
      <div className="absolute bottom-2 left-2 text-xs text-gray-400">
        Use W, A, S, D keys to move
      </div>
    </div>
  );
};

export default GameField;