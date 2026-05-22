import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Custom parsing of .env.local
const envPath = path.resolve('.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    const key = match[1]
    let value = match[2] || ''
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1)
    }
    envVars[key] = value
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: nominations, error: nomError } = await supabase
    .from('nominations')
    .select('id, tiktoker_name, submitted_by, media_url, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (nomError) {
    console.error('Nominations Error:', nomError)
  } else {
    console.log('Nominations (last 10):')
    console.log(JSON.stringify(nominations, null, 2))
  }

  const { data: ratings, error: ratError } = await supabase
    .from('ratings')
    .select('id, nomination_id, voter_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (ratError) {
    console.error('Ratings Error:', ratError)
  } else {
    console.log('Ratings (last 10):')
    console.log(JSON.stringify(ratings, null, 2))
  }
}
run()
