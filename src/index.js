import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { default as AdminApp } from './Admin';
import SuperApp from './Super';
import RecuperarSenha, { ehLinkRecuperacao } from './RecuperarSenha';
import Confirmar, { ehLinkConfirmacao } from './Confirmar';
import Conheca from './Conheca';

const path = window.location.pathname;
const isAdmin = path.startsWith('/admin');
const isSuper = path.startsWith('/super');
const isConheca = path.startsWith('/conheca');
const isRecuperacao = ehLinkRecuperacao();
const isConfirmacao = ehLinkConfirmacao();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isConfirmacao ? <Confirmar /> : isRecuperacao ? <RecuperarSenha /> : isSuper ? <SuperApp /> : isAdmin ? <AdminApp /> : isConheca ? <Conheca /> : <App />}
  </React.StrictMode>
);
