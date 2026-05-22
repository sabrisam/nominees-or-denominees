import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env variables manually from .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = ['rooms', 'categories', 'nominations', 'ratings', 'monthly_ceremonies'];
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error counting ${table}:`, error);
    } else {
      console.log(`Table ${table} has ${count} rows.`);
    }
  }

  // List rooms if any
  const { data: rooms } = await supabase.from('rooms').select('*');
  console.log('Rooms:', rooms);

  // List active categories
  const { data: categories } = await supabase.from('categories').select('*').eq('active', true);
  console.log('Active Categories:', categories?.map(c => ({ id: c.id, label: c.label, mood: c.mood })));
}

run();
