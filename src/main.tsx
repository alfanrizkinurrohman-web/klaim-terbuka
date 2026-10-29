import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './index.css';

const akar = document.getElementById('akar');
if (!akar) {
  throw new Error('Elemen #akar tidak ditemukan di index.html');
}

createRoot(akar).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
