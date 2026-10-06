import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initStore, LocalRepository } from './data/store';
import { App } from './app/App';

// хранилище можно заменить на API: initStore(new ApiRepository(...))
initStore(new LocalRepository());

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
