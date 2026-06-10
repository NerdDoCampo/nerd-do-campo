import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { default as AdminApp } from './Admin';
import SuperApp from './Super';
import RecuperarSenha, { ehLinkRecuperacao } from './RecuperarSenha';
import Confirmar, { ehLinkConfirmacao } from './Confirmar';

const path = window.location.pathname;
const isAdmin = path.startsWith('/admin');
const isSuper = path.startsWith('/super');
const isRecuperacao = ehLinkRecuperacao();
const isConfirmacao = ehLinkConfirmacao();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isConfirmacao ? <Confirmar /> : isRecuperacao ? <RecuperarSenha /> : isSuper ? <SuperApp /> : isAdmin ? <AdminApp /> : <App />}
  </React.StrictMode>
);
