import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import './theme.css';

document.documentElement.setAttribute('data-theme', localStorage.getItem('pvp_theme') || 'dark');
document.documentElement.setAttribute('data-acento', localStorage.getItem('pvp_acento') || 'naranja');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </React.StrictMode>
);
