import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function run() {
  const tables = ['rooms', 'categories', 'nominations', 'ratings']
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`Table ${table}: error`, error.message)
    } else {
      console.log(`Table ${table}: ${count} rows`)
    }
  }

  // Also query categories
  const { data: categories, error: catErr } = await supabase.from('categories').select('*')
  if (catErr) {
    console.log('Categories error:', catErr.message)
  } else {
    console.log('Categories list:', categories)
  }
}
run()
