import React, { useEffect, useState, useCallback } from 'react';
import BASE_API_URL from './services/base.api.url.js';

function App() {
  const [status, setStatus] = useState('Đang kết nối...');
  const [checking, setChecking] = useState(true);

  const checkConnection = useCallback(async (timeoutMs = 5000) => {
    setChecking(true);
    setStatus('Đang kết nối...');
    const url = `${BASE_API_URL}/Test`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(id);
      setChecking(false);
      if (res.ok) {
        setStatus('Kết nối database thành công');
      } else {
        setStatus('Lỗi kết nối');
      }
    } catch (err) {
      clearTimeout(id);
      setChecking(false);
      setStatus('Lỗi kết nối');
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return (
    <main style={styles.container}>
      <div style={styles.statusContainer}>
        <span style={{
          ...styles.statusDot, 
          backgroundColor: checking ? '#f59e0b' : (status === 'Kết nối database thành công' ? '#10b981' : '#ef4444')
        }}></span>
        <span style={styles.statusText}>{status}</span>
      </div>
    </main>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#0f172a',
    fontFamily: '"Inter", "Roboto", "Segoe UI", sans-serif',
    margin: 0,
    color: '#f8fafc'
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: '10px 20px',
    borderRadius: '9999px',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginRight: '12px',
    boxShadow: '0 0 8px rgba(0,0,0,0.5)'
  },
  statusText: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#e2e8f0'
  }
};

export default App;
