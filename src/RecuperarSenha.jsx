import { useState, useEffect } from "react";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://nxztffulmvohduvudbhg.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

const C = {
  bg: "#0B3D2E", surface: "#0F4A38", surf2: "#13594360", border: "#1d6b50",
  gold: "#E8B84B", cream: "#F5F0E1", dim: "#9DC4B0", loss: "#F44336", win: "#4CAF50",
};

// Detecta se a URL atual é um link de recuperação de senha do Supabase.
// O Supabase retorna no HASH: #access_token=...&type=recovery&...
export function ehLinkRecuperacao() {
  const hash = window.location.hash || "";
  return hash.includes("type=recovery") && hash.includes("access_token=");
}

function lerTokenDoHash() {
  const hash = (window.location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("access_token");
}

export default function RecuperarSenha() {
  const [token, setToken] = useState(null);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    const t = lerTokenDoHash();
    if (t) setToken(t);
    else setErro("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
  }, []);

  async function salvar() {
    setErro(null);
    if (!senha || senha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres."); return; }
    if (senha !== confirma) { setErro("As senhas não coincidem."); return; }
    if (!token) { setErro("Token de recuperação ausente. Abra o link do e-mail novamente."); return; }

    setSalvando(true);
    try {
      // Atualiza a senha do usuário usando o token de recuperação como autenticação.
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: senha }),
      });
      if (!res.ok) {
        const txt = await res.text();
        let msg = "Não foi possível redefinir a senha.";
        try { const j = JSON.parse(txt); msg = j.msg || j.error_description || j.message || msg; } catch {}
        if (res.status === 401 || res.status === 403) msg = "O link expirou. Solicite uma nova recuperação de senha.";
        throw new Error(msg);
      }
      setSucesso(true);
      // Limpa o hash da URL (remove o token)
      window.history.replaceState(null, "", window.location.pathname);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const inputStyle = {
    background: C.surf2, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "11px 14px", color: C.cream, fontFamily: "inherit", fontSize: 15,
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.cream, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, background: C.surface, borderRadius: 16, padding: 32, border: `1px solid ${C.border}` }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Redefinir Senha</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>Nerd do Campo</div>
        </div>

        {sucesso ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.win, marginBottom: 8 }}>Senha redefinida com sucesso!</div>
            <div style={{ fontSize: 14, color: C.dim, marginBottom: 24 }}>
              Já pode entrar no sistema com a sua nova senha.
            </div>
            <a href="/admin" style={{ display: "inline-block", background: C.gold, color: "#0B3D2E", textDecoration: "none", borderRadius: 8, padding: "11px 24px", fontWeight: 800, fontSize: 14 }}>
              Ir para o login
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: C.dim }}>Escolha uma nova senha para a sua conta.</div>
            <div>
              <label style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Nova senha</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ ...inputStyle, marginTop: 6 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Confirmar senha</label>
              <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)} placeholder="Repita a senha" style={{ ...inputStyle, marginTop: 6 }}
                onKeyDown={e => { if (e.key === "Enter") salvar(); }} />
            </div>
            {erro && (
              <div style={{ background: `${C.loss}22`, border: `1px solid ${C.loss}55`, color: C.loss, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                {erro}
              </div>
            )}
            <button onClick={salvar} disabled={salvando || !token}
              style={{ background: C.gold, color: "#0B3D2E", border: "none", borderRadius: 8, padding: "12px", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: salvando || !token ? "default" : "pointer", opacity: salvando || !token ? 0.6 : 1 }}>
              {salvando ? "Salvando..." : "Redefinir senha"}
            </button>
            <a href="/admin" style={{ textAlign: "center", color: C.dim, fontSize: 13, textDecoration: "none" }}>
              Voltar ao login
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
