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

const STATUS_CFG = {
  vou:     { label: "Vou",     cor: C.win,  emoji: "✅" },
  talvez:  { label: "Talvez",  cor: C.gold, emoji: "🤔" },
  nao_vou: { label: "Não vou", cor: C.loss, emoji: "❌" },
};

export function ehLinkConfirmacao() {
  return window.location.pathname.startsWith("/confirmar");
}

export default function Confirmar() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [escolhido, setEscolhido] = useState(null); // {id_jogador} ou {convidado:true}
  const [nomeConvidado, setNomeConvidado] = useState("");
  const [status, setStatus] = useState("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const token = new URLSearchParams(window.location.search).get("t") || "";

  async function carregar() {
    setLoading(true); setErro("");
    try {
      if (!token) { setErro("Link inválido."); setLoading(false); return; }
      const r = await rpc("confirmacao_dados", { p_token: token });
      if (r?.erro) { setErro(r.erro === "link_invalido" ? "Link inválido ou expirado." : r.erro); }
      else setDados(r);
    } catch (e) { setErro("Não foi possível carregar. Tente novamente."); }
    finally { setLoading(false); }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const confirmacoesPorJogador = {};
  (dados?.confirmacoes || []).forEach(c => { if (c.id_jogador) confirmacoesPorJogador[c.id_jogador] = c; });

  async function enviar() {
    if (!status) { setErro("Escolha Vou, Talvez ou Não vou."); return; }
    setEnviando(true); setErro(""); setOkMsg("");
    try {
      const body = {
        p_token: token,
        p_id_jogador: escolhido?.convidado ? null : escolhido?.id_jogador,
        p_nome_convidado: escolhido?.convidado ? nomeConvidado : null,
        p_status: status,
        p_observacao: obs || null,
      };
      const r = await rpc("confirmacao_responder", body);
      if (r?.erro) {
        const msgs = { link_expirado: "Este link expirou.", link_invalido: "Link inválido.", nome_convidado_obrigatorio: "Informe o nome do convidado.", jogador_invalido: "Jogador inválido.", status_invalido: "Resposta inválida." };
        setErro(msgs[r.erro] || "Não foi possível registrar.");
      } else {
        setOkMsg("Resposta registrada! Obrigado.");
        setEscolhido(null); setNomeConvidado(""); setStatus(""); setObs("");
        carregar();
      }
    } catch (e) { setErro("Falha ao enviar. Tente novamente."); }
    finally { setEnviando(false); }
  }

  const wrap = { minHeight:"100vh", background:C.bg, color:C.cream, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", padding:"24px 16px" };
  const card = { maxWidth:560, margin:"0 auto", background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 20px" };

  if (loading) return <div style={wrap}><div style={card}>Carregando…</div></div>;
  if (erro && !dados) return <div style={wrap}><div style={{ ...card, textAlign:"center" }}><div style={{ fontSize:34, marginBottom:10 }}>🔗</div><div style={{ color:C.loss, fontWeight:700 }}>{erro}</div></div></div>;

  const expirado = dados?.expirado;
  const jogadores = dados?.jogadores || [];

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <img src="/logo.png" alt="" style={{ width:54, height:54, borderRadius:"50%", objectFit:"cover" }} onError={e => { e.target.style.display="none"; }} />
          <h1 style={{ fontSize:20, margin:"10px 0 4px" }}>Confirmar presença</h1>
          <div style={{ fontSize:13, color:C.dim }}>Toque no seu nome e diga se vai.</div>
        </div>

        {expirado && <div style={{ background:C.gold+"22", border:`1px solid ${C.gold}`, color:C.gold, borderRadius:8, padding:"10px 12px", fontSize:13, marginBottom:14, textAlign:"center" }}>Este link já expirou — não é mais possível responder.</div>}
        {okMsg && <div style={{ background:C.win+"22", border:`1px solid ${C.win}`, color:C.win, borderRadius:8, padding:"10px 12px", fontSize:13, marginBottom:14, textAlign:"center" }}>{okMsg}</div>}
        {erro && dados && <div style={{ background:C.loss+"18", border:`1px solid ${C.loss}`, color:"#ff8a87", borderRadius:8, padding:"10px 12px", fontSize:13, marginBottom:14 }}>{erro}</div>}

        {/* Passo 1: escolher quem é */}
        {!escolhido && !expirado && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {jogadores.map(j => {
              const conf = confirmacoesPorJogador[j.id_jogador];
              return (
                <button key={j.id_jogador} onClick={() => { setEscolhido({ id_jogador:j.id_jogador }); setStatus(conf?.status||""); setObs(conf?.observacao||""); }}
                  style={{ display:"flex", alignItems:"center", gap:10, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.cream, fontSize:15, fontFamily:"inherit", cursor:"pointer", textAlign:"left" }}>
                  <span style={{ fontWeight:700, flex:1 }}>{j.apelido || j.nome}</span>
                  {conf && <span style={{ fontSize:12, color:STATUS_CFG[conf.status]?.cor }}>{STATUS_CFG[conf.status]?.emoji} {STATUS_CFG[conf.status]?.label}</span>}
                </button>
              );
            })}
            <button onClick={() => { setEscolhido({ convidado:true }); setStatus(""); setObs(""); }}
              style={{ background:"transparent", border:`1px dashed ${C.gold}`, borderRadius:10, padding:"12px 14px", color:C.gold, fontSize:14, fontFamily:"inherit", cursor:"pointer", fontWeight:700 }}>
              + Sou convidado (não estou na lista)
            </button>
          </div>
        )}

        {/* Passo 2: responder */}
        {escolhido && !expirado && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontSize:15, fontWeight:700 }}>
              {escolhido.convidado ? "Convidado" : (jogadores.find(j => j.id_jogador===escolhido.id_jogador)?.apelido || jogadores.find(j => j.id_jogador===escolhido.id_jogador)?.nome)}
            </div>
            {escolhido.convidado && (
              <input value={nomeConvidado} onChange={e => setNomeConvidado(e.target.value)} placeholder="Seu nome"
                style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontSize:15, padding:"11px 13px", fontFamily:"inherit" }} />
            )}
            <div style={{ display:"flex", gap:8 }}>
              {Object.entries(STATUS_CFG).map(([k,cfg]) => (
                <button key={k} onClick={() => setStatus(k)}
                  style={{ flex:1, background: status===k ? cfg.cor : C.surf2, color: status===k ? "#0B1A0F" : C.cream, border:`1px solid ${status===k?cfg.cor:C.border}`, borderRadius:10, padding:"12px 8px", fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                  {cfg.emoji}<br/>{cfg.label}
                </button>
              ))}
            </div>
            <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (opcional)"
              style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontSize:14, padding:"11px 13px", fontFamily:"inherit" }} />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { setEscolhido(null); setErro(""); }} style={{ flex:1, background:C.surf2, color:C.cream, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px", fontFamily:"inherit", fontWeight:700, cursor:"pointer" }}>Voltar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex:2, background:C.gold, color:"#0B3D2E", border:"none", borderRadius:10, padding:"12px", fontFamily:"inherit", fontWeight:800, cursor:"pointer" }}>{enviando ? "Enviando…" : "Confirmar"}</button>
            </div>
          </div>
        )}

        {/* Lista pública de quem vai */}
        {(dados?.confirmacoes||[]).length > 0 && (
          <div style={{ marginTop:22, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
            <div style={{ fontSize:12, color:C.gold, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700, marginBottom:10 }}>Quem respondeu</div>
            {["vou","talvez","nao_vou"].map(st => {
              const grupo = (dados.confirmacoes||[]).filter(c => c.status===st);
              if (grupo.length===0) return null;
              return (
                <div key={st} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:12, color:STATUS_CFG[st].cor, fontWeight:700, marginBottom:4 }}>{STATUS_CFG[st].emoji} {STATUS_CFG[st].label} ({grupo.length})</div>
                  <div style={{ fontSize:13, color:C.cream, lineHeight:1.6 }}>
                    {grupo.map((c,i) => {
                      const nome = c.id_jogador ? (jogadores.find(j=>j.id_jogador===c.id_jogador)?.apelido || jogadores.find(j=>j.id_jogador===c.id_jogador)?.nome || "Jogador") : (c.nome_convidado + " (convidado)");
                      return <span key={i}>{nome}{c.observacao ? ` — ${c.observacao}` : ""}{i<grupo.length-1 ? " · " : ""}</span>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
