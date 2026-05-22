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

async function checkNominations() {
  console.log("Fetching recent nominations...");
  const { data, error } = await supabase
    .from('nominations')
    .select('id, category_id, tiktoker_name, media_url, submitted_by, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching nominations:', error);
  } else {
    console.log('Recent Nominations:');
    console.log(JSON.stringify(data, null, 2));
  }
}

async function checkRatings() {
  console.log("Fetching recent ratings...");
  const { data, error } = await supabase
    .from('ratings')
    .select('id, nomination_id, voter_id, rating_stars, comment, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching ratings:', error);
  } else {
    console.log('Recent Ratings:');
    console.log(JSON.stringify(data, null, 2));
  }
}

async function run() {
  await checkNominations();
  await checkRatings();
}

run();
