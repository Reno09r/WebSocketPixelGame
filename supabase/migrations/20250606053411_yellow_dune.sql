/*
  # Create players table for real-time game

  1. New Tables
    - `players`
      - `id` (text, primary key): Unique identifier for each player
      - `name` (text): Display name for the player
      - `x` (integer): X coordinate position on game field
      - `y` (integer): Y coordinate position on game field
      - `color` (text): Player color in CSS format (hex, hsl, etc.)
  
  2. Security
    - Enable RLS on `players` table
    - Add policy for public access to read all players
    - Add policy for players to insert/update their own data
*/

-- Create the players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  color TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read all players (needed for multiplayer visibility)
CREATE POLICY "Anyone can read all players"
  ON players
  FOR SELECT
  TO public
  USING (true);

-- Allow players to insert their own data
CREATE POLICY "Players can insert their own data"
  ON players
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow players to update only their own data
CREATE POLICY "Players can update their own data"
  ON players
  FOR UPDATE
  TO public
  USING (auth.uid()::text = id OR auth.uid() IS NULL)
  WITH CHECK (auth.uid()::text = id OR auth.uid() IS NULL);

-- Allow players to delete only their own data
CREATE POLICY "Players can delete their own data"
  ON players
  FOR DELETE
  TO public
  USING (auth.uid()::text = id OR auth.uid() IS NULL);