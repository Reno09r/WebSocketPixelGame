import React from 'react';
import { User } from 'lucide-react';
import { Player } from '../types/game';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string | null;
}

const PlayerList: React.FC<PlayerListProps> = ({ players, currentPlayerId }) => {
  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-white flex items-center">
        <User className="inline-block mr-2\" size={18} />
        Players ({players.length})
      </h2>
      
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {sortedPlayers.map((player) => (
          <div
            key={player.id}
            className={`flex items-center p-2 rounded ${
              player.id === currentPlayerId
                ? 'bg-gray-700'
                : 'bg-gray-900'
            }`}
          >
            <div
              className="w-4 h-4 mr-3 rounded-sm"
              style={{ backgroundColor: player.color }}
            />
            <span className="text-white">
              {player.name}
              {player.id === currentPlayerId && ' (you)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerList;