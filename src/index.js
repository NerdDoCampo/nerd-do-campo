import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminAppCompleto from './Admin';
import App from './App';

const isAdmin = window.location.pathname.startsWith('/admin');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isAdmin ? <AdminAppCompleto /> : <App />}
  </React.StrictMode>
);
