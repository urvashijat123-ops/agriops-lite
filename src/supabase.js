import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wwculwcpxlhqmizqpyvu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3Y3Vsd2NweGxocW1penFweXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjIwNjYsImV4cCI6MjA4NjczODA2Nn0.2_mI_oRLwLnrLgPcC9k9TWfGcikUhAUeSEETb9wpAXw'

export const supabase = createClient(supabaseUrl, supabaseKey)

