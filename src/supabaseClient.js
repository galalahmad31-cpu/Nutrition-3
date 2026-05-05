import { createClient } from '@supabase/supabase-js'

// استبدل الكلام اللي بالعربي بالبيانات من Supabase
const supabaseUrl = 'رابط_مشروعك_هنا'
const supabaseKey = 'المفتاح_بتاعك_هنا'

export const supabase = createClient(supabaseUrl, supabaseKey)
