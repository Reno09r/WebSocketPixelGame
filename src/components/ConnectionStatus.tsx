import React from 'react';
import gameWebSocket from '../lib/websocket';

interface ConnectionStatusProps {
  isConnected: boolean;
  error: string | null;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected, error }) => {
  const [wsConnected, setWsConnected] = React.useState(false);

  React.useEffect(() => {
    const checkConnection = () => {
      setWsConnected(gameWebSocket.isConnected());
    };

    // Проверяем статус каждую секунду
    const interval = setInterval(checkConnection, 1000);
    checkConnection(); // Проверяем сразу

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2">
      <div className={`px-4 py-2 rounded-lg shadow-lg ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      }`}>
        Supabase: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      
      <div className={`px-4 py-2 rounded-lg shadow-lg ${
        wsConnected ? 'bg-green-500' : 'bg-red-500'
      }`}>
        WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
      </div>

      {error && (
        <div className="px-4 py-2 rounded-lg shadow-lg bg-red-500">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;