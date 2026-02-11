import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rqpqfrvciffkgmriqcdv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcHFmcnZjaWZma2dtcmlxY2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTA4OTMsImV4cCI6MjA4NjM4Njg5M30.ymfdclk0OfL8JmNJjLOyvtouXgVWXt3Rt-b_b90zilc'

export const supabase = createClient(supabaseUrl, supabaseKey)
