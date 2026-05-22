import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: nominations, error: nomError } = await supabase
    .from('nominations')
    .select('id, tiktoker_name, submitted_by, media_url, created_at')
    .limit(10)
  
  if (nomError) {
    console.error('Nominations Error:', nomError)
  } else {
    console.log('Nominations (last 10):', nominations)
  }

  const { data: ratings, error: ratError } = await supabase
    .from('ratings')
    .select('id, nomination_id, voter_id, created_at')
    .limit(10)

  if (ratError) {
    console.error('Ratings Error:', ratError)
  } else {
    console.log('Ratings (last 10):', ratings)
  }
}
run()
