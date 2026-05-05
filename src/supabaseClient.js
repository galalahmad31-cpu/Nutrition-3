import { createClient } from '@supabase/supabase-js'

// استبدل الكلام اللي بالعربي بالبيانات من Supabase
const supabaseUrl = 'svnqppvwptbhxcurxipa'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2bnFwcHZ3cHRiaHhjdXJ4aXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTE0MTUsImV4cCI6MjA5Mjg2NzQxNX0.riPKzpjgI41EwVCI6KKtbNuyl8NCsRGOwZP_sRNr9Kw'

export const supabase = createClient(supabaseUrl, supabaseKey)
