import React, { useState, useEffect } from "react";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://nxztffulmvohduvudbhg.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

const C = {
  bg: "#0B3D2E", surface: "#103D2A", surf2: "#174D36",
  border: "#1F5C3E", gold: "#E8A020", cream: "#F0E8D0",
  dim: "#8FAF9A", win: "#4CAF50", loss: "#E53935",
};

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function ehLinkCraque() {
  return window.location.pathname.startsWith("/craque");
}

const iniciais = (j) => ((j.apelido || j.nome || "?").trim().slice(0, 2)).toUpperCase();

export default function Craque() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [euId, setEuId] = useState(null);     // quem sou eu (identificação)
  const [votado, setVotado] = useState(null); // em quem estou votando
  const [enviando, setEnviando] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const token = new URLSearchParams(window.location.search).get("t") || "";
  const jaVotouLocal = () => { try { return localStorage.getItem("ndc_craque_" + token) === "1"; } catch { return false; } };

  async function carregar() {
    try {
      if (!token) { setErro("Link inválido."); setLoading(false); return; }
      const r = await rpc("craque_dados", { p_token: token });
      if (r?.erro) setErro(r.erro === "link_expirado" ? "Esta votação expirou." : "Link inválido ou expirado.");
      else setDados(r);
    } catch { setErro("Não foi possível carregar. Tente novamente."); }
    finally { setLoading(false); }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  async function votar() {
    if (!euId) { setErro("Toque no seu nome primeiro."); return; }
    if (!votado) { setErro("Escolha o craque."); return; }
    setEnviando(true); setErro(""); setOkMsg("");
    try {
      const r = await rpc("craque_votar", { p_token: token, p_id_votante: euId, p_nome_convidado: null, p_id_votado: votado });
      if (r?.erro) {
        const msgs = { votacao_fechada: "A votação está fechada.", voto_proprio: "Não dá pra votar em você mesmo. 😅", ja_votou: "Você já votou neste jogo!", votado_invalido: "Esse jogador não está na lista.", link_expirado: "Esta votação expirou." };
        setErro(msgs[r.erro] || "Não foi possível registrar seu voto.");
        if (r.erro === "ja_votou") { try { localStorage.setItem("ndc_craque_" + token, "1"); } catch {} }
      } else {
        try { localStorage.setItem("ndc_craque_" + token, "1"); } catch {}
        setOkMsg("Voto registrado! Valeu pela participação. 🏆");
      }
    } catch { setErro("Não foi possível registrar seu voto."); }
    finally { setEnviando(false); }
  }

  const wrap = { minHeight: "100vh", background: C.bg, color: C.cream, fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" };
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 460 };

  if (loading) return <div style={wrap}><div style={{ marginTop: 80, color: C.dim }}>Carregando...</div></div>;
  if (erro && !dados) return <div style={wrap}><div style={{ ...card, textAlign: "center", marginTop: 60 }}><div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div><div style={{ fontSize: 16 }}>{erro}</div></div></div>;

  const jogo = dados?.jogo || {};
  const elegiveis = dados?.elegiveis || [];
  const encerrada = dados?.estado === "encerrada";
  const dataFmt = jogo.data ? new Date(jogo.data).toLocaleDateString("pt-BR") : "";

  // votação encerrada: mostra o craque coroado
  if (encerrada) {
    const craque = elegiveis.find(j => j.id_jogador === dados.id_craque);
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center", marginTop: 30 }}>
          <div style={{ fontSize: 13, color: C.gold, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Craque {jogo.tipo === "encontro" ? "do Encontro" : "da Partida"}</div>
          <div style={{ fontSize: 54, margin: "10px 0" }}>🏆</div>
          {craque ? (
            <>
              {craque.foto_url
                ? <img src={craque.foto_url} alt="" style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", border: `3px solid ${C.gold}`, margin: "0 auto 12px", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                : <div style={{ width: 100, height: 100, borderRadius: "50%", background: C.surf2, border: `3px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800, margin: "0 auto 12px" }}>{iniciais(craque)}</div>}
              <div style={{ fontSize: 26, fontWeight: 900 }}>{craque.apelido || craque.nome}</div>
              {craque.camisa != null && <div style={{ fontSize: 13, color: C.dim }}>Camisa {craque.camisa}</div>}
            </>
          ) : <div style={{ color: C.dim }}>Craque definido pelo time.</div>}
          <div style={{ fontSize: 12, color: C.dim, marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>{jogo.titulo} {dataFmt && `· ${dataFmt}`}</div>
          <div style={{ fontSize: 12, color: C.gold, marginTop: 8, fontWeight: 700 }}>Votação encerrada</div>
        </div>
      </div>
    );
  }

  // votou com sucesso
  if (okMsg) return (
    <div style={wrap}><div style={{ ...card, textAlign: "center", marginTop: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{okMsg}</div>
      <div style={{ fontSize: 13, color: C.dim }}>O resultado sai quando o admin encerrar a votação.</div>
    </div></div>
  );

  return (
    <div style={wrap}>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.gold, marginBottom: 4 }}>🏆 Craque {jogo.tipo === "encontro" ? "do Encontro" : "da Partida"}</div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>{jogo.titulo} {dataFmt && `· ${dataFmt}`}</div>

      <div style={card}>
        {jaVotouLocal() ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Você já votou neste jogo!</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Valeu pela participação. 🏆</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Quem foi o craque?</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 16 }}>
              {euId ? "Agora toque em quem brilhou hoje." : "Primeiro, toque no seu nome. Depois, escolha o craque."}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {elegiveis.map(j => {
                const souEu = euId === j.id_jogador;
                const escolhido = votado === j.id_jogador;
                const bloqueado = euId && souEu; // não vota em si mesmo
                return (
                  <button key={j.id_jogador} disabled={bloqueado}
                    onClick={() => { if (!euId) { setEuId(j.id_jogador); setErro(""); } else if (!souEu) { setVotado(j.id_jogador); setErro(""); } }}
                    style={{
                      display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 10,
                      border: `1px solid ${escolhido ? C.gold : C.border}`, background: escolhido ? C.gold + "1f" : C.surf2,
                      color: C.cream, cursor: bloqueado ? "default" : "pointer", opacity: bloqueado ? 0.4 : 1,
                      fontFamily: "inherit", textAlign: "left", width: "100%",
                    }}>
                    {j.foto_url
                      ? <img src={j.foto_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { e.currentTarget.style.display = "none"; }} />
                      : <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#245038", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{iniciais(j)}</span>}
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{j.apelido || j.nome}{souEu ? " (você)" : ""}</span>
                    {j.camisa != null && <span style={{ fontSize: 12, color: C.gold, fontWeight: 800 }}>#{j.camisa}</span>}
                  </button>
                );
              })}
            </div>

            {erro && <div style={{ color: C.loss, fontSize: 13, marginTop: 12, textAlign: "center" }}>{erro}</div>}

            <button onClick={votar} disabled={enviando || !euId || !votado}
              style={{
                width: "100%", marginTop: 16, padding: 14, borderRadius: 10, border: "none",
                background: (!euId || !votado) ? C.surf2 : C.gold, color: (!euId || !votado) ? C.dim : "#0B3D2E",
                fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: (!euId || !votado) ? "default" : "pointer", textTransform: "uppercase",
              }}>
              {enviando ? "Registrando..." : "🏆 Confirmar meu voto"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
