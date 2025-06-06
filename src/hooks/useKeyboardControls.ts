import { useState, useEffect, useCallback } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

// Key mapping for controls
const keyMap: Record<string, Direction> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export const useKeyboardControls = () => {
  const [movement, setMovement] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const direction = keyMap[e.code];
    if (direction) {
      e.preventDefault(); // Prevent default browser actions like scrolling
      setMovement((m) => ({ ...m, [direction]: true }));
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const direction = keyMap[e.code];
    if (direction) {
      e.preventDefault();
      setMovement((m) => ({ ...m, [direction]: false }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return movement;
};