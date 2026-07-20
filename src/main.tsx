import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './renderer/App';
import './renderer/styles/tailwind.css';
import './renderer/styles/theme.css';
import './renderer/styles.css';

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set('X-App-Name', 'savant-sanctum');
  return nativeFetch(input, { ...init, headers });
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
