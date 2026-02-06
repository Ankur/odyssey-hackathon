import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Note: StrictMode is intentionally omitted because it double-invokes effects,
// which causes issues with webcam streams, MediaPipe initialization, and WebRTC.
createRoot(document.getElementById('root')!).render(<App />);
