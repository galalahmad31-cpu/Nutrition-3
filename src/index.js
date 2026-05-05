import React from 'react';

function App() {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px', padding: '20px' }}>
      <h1 style={{ color: '#2ecc71' }}>✅ مبروك! الموقع شغال</h1>
      <p>لو شايف الرسالة دي، يبقى السباكة البرمجية بتاعتك 100% صح</p>
      <button 
        onClick={() => alert('شغال يا بطل!')}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        اضغط هنا للتجربة
      </button>
    </div>
  );
}

export default App;
