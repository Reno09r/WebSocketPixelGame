// --- START OF FILE App.tsx ---

import { useState } from 'react';
import GameField from './components/GameField';
import PlayerList from './components/PlayerList';
import GameHeader from './components/GameHeader';
import ConnectionStatus from './components/ConnectionStatus';
import SupabaseSetupMessage from './components/SupabaseSetupMessage';
import { useGameState } from './hooks/useGameState';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { useMovement } from './hooks/useMovement';
import { GameConfig } from './types/game';

const GAME_CONFIG: GameConfig = {
  fieldWidth: 200,
  fieldHeight: 150,
  playerSize: 1,
  // Скорость можно подрегулировать для комфортной игры
  moveSpeed: 0.8,
};

const isSupabaseConfigured =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

function App() {
  const [showSetupMessage] = useState(!isSupabaseConfigured);
  const [playerName] = useState(`Player-${Math.floor(Math.random() * 1000)}`);

  const {
    players,
    setPlayers, // Получаем setPlayers из useGameState
    currentPlayer,
    isConnected,
    error,
    updatePlayerName,
  } = useGameState(playerName, GAME_CONFIG);

  const movement = useKeyboardControls();

  // Вызываем хук движения, который запускает игровой цикл
  // Передаем только setPlayers, а не сам массив players
  useMovement(setPlayers, movement, currentPlayer, GAME_CONFIG);

  const handleNameChange = (name: string) => {
    updatePlayerName(name);
  };

  const currentName = currentPlayer?.name || playerName;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      {showSetupMessage && <SupabaseSetupMessage />}

      {!showSetupMessage && (
        <div className="max-w-6xl mx-auto">
          <GameHeader
            playerName={currentName}
            onNameChange={handleNameChange}
            connectedPlayers={players.length}
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <GameField
                players={players}
                currentPlayerId={currentPlayer?.id ?? null}
                gameConfig={GAME_CONFIG}
              />
            </div>

            <div className="lg:col-span-1">
              <PlayerList
                players={players}
                currentPlayerId={currentPlayer?.id ?? null}
              />
            </div>
          </div>
        </div>
      )}

      {!showSetupMessage && <ConnectionStatus isConnected={isConnected} error={error} />}
    </div>
  );
}

export default App;