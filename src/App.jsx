import React, { useState } from 'react';
import { supabase } from './supabaseClient'; // هنا بننادي على الملف الأول

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // دالة التسجيل
  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert("خطأ: " + error.message);
    else alert("تم التسجيل! روح شوف جدول Profiles في Supabase");
  };

  // دالة الدخول
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("خطأ: " + error.message);
    else alert("أهلاً بيك! دخلت بنجاح");
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>نظام الدخول</h2>
      <input 
        type="email" 
        placeholder="الإيميل" 
        onChange={(e) => setEmail(e.target.value)} 
        style={{ display: 'block', margin: '10px auto', padding: '10px' }}
      />
      <input 
        type="password" 
        placeholder="الباسورد" 
        onChange={(e) => setPassword(e.target.value)} 
        style={{ display: 'block', margin: '10px auto', padding: '10px' }}
      />
      <button onClick={handleLogin} style={{ margin: '5px', padding: '10px 20px', background: 'blue', color: 'white' }}>دخول</button>
      <button onClick={handleSignUp} style={{ margin: '5px', padding: '10px 20px', background: 'green', color: 'white' }}>تسجيل جديد</button>
    </div>
  );
}

