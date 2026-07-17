import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { default as AdminApp } from './Admin';
import SuperApp from './Super';
import RecuperarSenha, { ehLinkRecuperacao } from './RecuperarSenha';
import Confirmar, { ehLinkConfirmacao } from './Confirmar';
import Craque, { ehLinkCraque } from './Craque';
import Conheca from './Conheca';

const path = window.location.pathname;
const isAdmin = path.startsWith('/admin');
const isSuper = path.startsWith('/super');
const isConheca = path.startsWith('/conheca');
const isRecuperacao = ehLinkRecuperacao();
const isConfirmacao = ehLinkConfirmacao();
const isCraque = ehLinkCraque();

// ── Monitor de erros ─────────────────────────────────────────────
// Captura erros não tratados de TODOS os apps e grava em log_erro no
// Supabase (fire-and-forget). O Super mostra tudo na aba 🐞 Erros.
const ERR_URL = process.env.REACT_APP_SUPABASE_URL || 'https://nxztffulmvohduvudbhg.supabase.co';
const ERR_KEY = process.env.REACT_APP_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg';
const ERR_APP = isCraque ? 'craque' : isConfirmacao ? 'confirmar' : isRecuperacao ? 'recuperar' : isSuper ? 'super' : isAdmin ? 'admin' : isConheca ? 'conheca' : 'publico';

const _errVistos = new Set(); // dedup por sessão
let _errCota = 5;             // no máx. 5 registros por sessão (evita loop gravar milhares)

function _hashErr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h >>> 0); }

// Ruído de EXTENSÕES/RECURSOS do navegador (não é erro do nosso código).
// Ex.: carteira cripto do Brave (window.ethereum), modo leitor/tradutor
// (__firefox__), e o "Script error." genérico de scripts de outra origem.
const _RUIDO = [
  'window.ethereum', 'ethereum.selectedAddress', 'selectedAddress',
  '__firefox__', 'firefox__reader', 'reader',
  'evmAsk', 'web3', 'metamask', 'solana', 'phantom',
  'chrome-extension://', 'moz-extension://', 'safari-extension://', 'safari-web-extension://',
  'ResizeObserver loop', 'Non-Error promise rejection',
];
function _ehRuido(msg, stack) {
  const alvo = (msg + ' ' + stack).toLowerCase();
  // "Script error." puro (sem stack útil) = erro de script de outra origem (extensão)
  if (/^script error\.?$/i.test(String(msg || '').trim()) && !stack) return true;
  return _RUIDO.some((p) => alvo.includes(p.toLowerCase()));
}

export function reportarErro(mensagem, stack, origem) {
  try {
    const msg = String(mensagem || 'erro desconhecido').slice(0, 500);
    const st = String(stack || '').slice(0, 4000);
    if (_ehRuido(msg, st)) return; // ignora ruído de extensão de navegador
    const hash = _hashErr(ERR_APP + '|' + msg + '|' + st.split('\n')[0]);
    if (_errVistos.has(hash) || _errCota <= 0) return;
    _errVistos.add(hash); _errCota--;
    let idTime = null;
    try { idTime = Number(sessionStorage.getItem('ndc_id_time')) || null; } catch { /* best-effort */ }
    fetch(`${ERR_URL}/rest/v1/log_erro`, {
      method: 'POST',
      headers: { apikey: ERR_KEY, Authorization: `Bearer ${ERR_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        app: ERR_APP,
        hash,
        versao: (typeof window !== 'undefined' && window.__NDC_VERSAO) || process.env.REACT_APP_VERSION || null,
        mensagem: msg,
        stack: st,
        origem: origem || null,
        url: String(window.location.href).slice(0, 500),
        navegador: String(navigator.userAgent).slice(0, 300),
        id_time: idTime,
      }),
    }).catch(() => { /* best-effort: monitor nunca pode quebrar o app */ });
  } catch { /* best-effort */ }
}

window.addEventListener('error', (e) => reportarErro(e?.message, e?.error?.stack, 'window.onerror'));
window.addEventListener('unhandledrejection', (e) => reportarErro(e?.reason?.message || String(e?.reason || ''), e?.reason?.stack, 'promise'));

// Error Boundary: erro de renderização não vira tela branca — mostra uma tela
// amigável, registra o erro e oferece recarregar.
class ErroFatal extends React.Component {
  constructor(props) { super(props); this.state = { erro: null }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  componentDidCatch(erro, info) {
    reportarErro(erro?.message, (erro?.stack || '') + '\n[componente]' + String(info?.componentStack || '').slice(0, 1200), 'render');
  }
  render() {
    if (this.state.erro) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0B3D2E', color: '#F0E8D0', fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 54, marginBottom: 14 }}>😵‍💫</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Ops! Algo deu errado por aqui.</div>
          <div style={{ fontSize: 14, color: '#8FAF9A', maxWidth: 430, lineHeight: 1.6, marginBottom: 24 }}>
            O erro já foi registrado automaticamente e vamos corrigir.
            Recarregar a página geralmente resolve — seus dados estão salvos na nuvem.
          </div>
          <button onClick={() => window.location.reload()}
            style={{ background: '#E8A020', color: '#0B3D2E', border: 'none', borderRadius: 10, fontFamily: 'inherit', fontWeight: 800, fontSize: 15, padding: '13px 32px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🔄 Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErroFatal>
      {isCraque ? <Craque /> : isConfirmacao ? <Confirmar /> : isRecuperacao ? <RecuperarSenha /> : isSuper ? <SuperApp /> : isAdmin ? <AdminApp /> : isConheca ? <Conheca /> : <App />}
    </ErroFatal>
  </React.StrictMode>
);
