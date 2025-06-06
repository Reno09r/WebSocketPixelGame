import React, { useState } from 'react';
import { Edit, Check } from 'lucide-react';

interface GameHeaderProps {
  playerName: string;
  onNameChange: (name: string) => void;
  connectedPlayers: number;
}

const GameHeader: React.FC<GameHeaderProps> = ({
  playerName,
  onNameChange,
  connectedPlayers,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(playerName);

  const handleNameSubmit = () => {
    if (nameInput.trim()) {
      onNameChange(nameInput.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-white">2D Multiplayer Game</h1>
          <div className="ml-4 px-2 py-1 bg-green-800 rounded-full text-xs text-green-200">
            {connectedPlayers} online
          </div>
        </div>
        
        <div className="flex items-center">
          {isEditing ? (
            <div className="flex items-center bg-gray-700 rounded px-2 py-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="bg-transparent text-white outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSubmit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <button 
                onClick={handleNameSubmit}
                className="ml-2 text-green-400 hover:text-green-300"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center text-white">
              <span>Playing as: <strong>{playerName}</strong></span>
              <button
                onClick={() => setIsEditing(true)}
                className="ml-2 text-gray-400 hover:text-white transition-colors"
              >
                <Edit size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHeader;