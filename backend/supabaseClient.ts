import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing in .env');
}

// Ensure supabaseUrl and supabaseKey are strings, or throw/handle appropriately
// For now casting as string assuming env check passes or library handles undefined
const supabase = createClient(supabaseUrl as string, supabaseKey as string);

export default supabase;
