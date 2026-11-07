import { useEffect, useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('Checking backend…');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Backend is unavailable');
        }
        return response.json();
      })
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('Backend unavailable'));
  }, []);

  return (
    <main>
      <h1>Contract Intelligence Upsell Engine</h1>
      <p>Analyze agreements for renewal signals, clause insights, and growth opportunities.</p>
      <p>Backend status: {status}</p>
    </main>
  );
}
