// استيراد مكتبة Supabase عبر CDN لتسهيل العمل من التابلت
// ملاحظة: تأكد من إضافة هذا الرابط في ملفات الـ HTML الخاصة بك قبل استدعاء هذا الملف

const SUPABASE_URL = "https://svnqppvwptbhxcurxipa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wXN6nc7ug20Zuh89H-k6DQ_gyIZVsfD";

// إنشاء العميل الأساسي للتعامل مع قاعدة البيانات
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تصدير المتغير ليتم استخدامه في بقية الملفات
window.supabaseClient = supabase;

console.log("تم تفعيل الربط مع Supabase بنجاح! 🚀");
