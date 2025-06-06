export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

export interface GameConfig {
  fieldWidth: number;
  fieldHeight: number;
  playerSize: number;
  moveSpeed: number;
}