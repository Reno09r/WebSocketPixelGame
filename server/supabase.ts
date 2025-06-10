import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // Убедитесь, что dotenv установлен

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Service Key is missing in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const removePlayer = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error removing player ${id}:`, error);
  } else {
    console.log(`Player ${id} removed from database.`);
  }
};