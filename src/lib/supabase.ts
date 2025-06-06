import { createClient } from '@supabase/supabase-js';
import type { Player } from '../types/game';

// These would normally come from environment variables
// For demo purposes, we're hardcoding them here
// In production, use import.meta.env.VITE_SUPABASE_URL and import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Player management functions
export const addPlayer = async (player: Player): Promise<void> => {
  try {
    const { error } = await supabase
      .from('players')
      .insert([{
        id: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        color: player.color
      }]);

    if (error) {
      console.error('Error adding player:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to add player:', error);
    throw error;
  }
};

export const updatePlayerPosition = async (
  id: string,
  x: number,
  y: number
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('players')
      .update({ 
        x: Math.floor(x),
        y: Math.floor(y)
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating player position:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to update player position:', error);
    throw error;
  }
};

export const removePlayer = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing player:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to remove player:', error);
    throw error;
  }
};

export const getPlayers = async (): Promise<Player[]> => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*');

    if (error) {
      console.error('Error getting players:', error);
      throw error;
    }

    return data as Player[];
  } catch (error) {
    console.error('Failed to get players:', error);
    throw error;
  }
};

// Real-time subscription helper
export const subscribeToPlayers = (
  callback: (players: Player[], eventType: string) => void
) => {
  const channel = supabase
    .channel('players-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'players' },
      (payload) => {
        callback([payload.new as Player], 'INSERT');
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'players' },
      (payload) => {
        callback([payload.new as Player], 'UPDATE');
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'players' },
      (payload) => {
        callback([{ id: payload.old.id } as Player], 'DELETE');
      }
    )
    .subscribe();

  return channel;
};

export const updatePlayerName = async (id: string, name: string) => {
  try {
    const { error } = await supabase
      .from('players')
      .update({ name })
      .eq('id', id);

    if (error) {
      console.error('Error updating player name:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to update player name:', error);
    throw error;
  }
};