import React, { useState, useEffect, useCallback, useRef } from "react";
const APP_VERSION = process.env.REACT_APP_VERSION || "1.1.1";

// ── Supabase ──────────────────────────────────────────────────
const URL  = process.env.REACT_APP_SUPABASE_URL || "https://nxztffulmvohduvudbhg.supabase.co";
const ANON = process.env.REACT_APP_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

let SESSION_TOKEN = sessionStorage.getItem("ndc_token") || null;

async function sbAuth(path, body) {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sb(path, opts = {}) {
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${SESSION_TOKEN || ANON}`,
    "Content-Type": "application/json",
    Prefer: opts.prefer || "return=representation",
    ...opts.headers,
  };
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers, ...opts });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

const api = {
  get:    (path)         => sb(path),
  post:   (path, body)   => sb(path, { method: "POST",   body: JSON.stringify(body) }),
  patch:  (path, body)   => sb(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: (path)         => sb(path, { method: "DELETE",  prefer: "return=minimal" }),
};

// ── Upload de imagem para Supabase Storage ────────────────────
async function uploadImagem(bucket, file, nomeArquivo) {
  const ext  = file.name.split(".").pop();
  const nome = nomeArquivo || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const path = `${nome}.${ext}`;
  const res = await fetch(`${URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${SESSION_TOKEN}`,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: file,
  });
  if (!res.ok) throw new Error("Erro ao fazer upload da imagem");
  // Cache-bust na URL para garantir que o browser carregue a imagem nova
  return `${URL}/storage/v1/object/public/${bucket}/${path}?t=${Date.now()}`;
}

// ── Componente de upload de imagem ────────────────────────────
function ImageUpload({ label, value, onUpload, bucket, nomeArquivo }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = React.useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) {
      alert("Use imagens JPG, PNG ou WebP"); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Imagem muito grande. Máximo 2MB."); return;
    }
    setUploading(true);
    try {
      const url = await uploadImagem(bucket, file, nomeArquivo);
      onUpload(url);
    } catch(e) { alert(e.message); }
    finally { setUploading(false); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {label && <label style={{ fontSize:11, color:"#8FAF9A", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{label}</label>}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {value ? (
          <img src={value} alt="preview" style={{ width:64, height:64, borderRadius:8, objectFit:"cover", border:"2px solid #1F5C3E" }}/>
        ) : (
          <div style={{ width:64, height:64, borderRadius:8, background:"#174D36", border:"2px dashed #1F5C3E", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>📷</div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ background:"#174D36", border:"1px solid #1F5C3E", borderRadius:8, padding:"7px 14px", color:"#F0E8D0", fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:uploading?"not-allowed":"pointer", textTransform:"uppercase" }}>
            {uploading ? "Enviando..." : value ? "Trocar Imagem" : "Escolher Imagem"}
          </button>
          {value && (
            <button onClick={() => onUpload("")}
              style={{ background:"none", border:"none", color:"#E53935", fontSize:12, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
              ✕ Remover
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }}/>
    </div>
  );
}

// ── Paleta ────────────────────────────────────────────────────


// Funções auxiliares compartilhadas
function fmtDataP(ts) { return ts ? new Date(ts).toLocaleDateString("pt-BR") : "—"; }
function fmtHoraP(ts) { return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" }) : "—"; }
function resultadoP(p) {
  if (p.cancelada === "S") return { label:"Cancelado", cor:C.dim };
  if (p.gols_marcados === null) return { label:"Aguardando", cor:C.gold };
  if (p.gols_marcados > p.gols_sofridos) return { label:"Vitória", cor:C.win };
  if (p.gols_marcados < p.gols_sofridos) return { label:"Derrota", cor:C.loss };
  return { label:"Empate", cor:C.draw };
}
function BadgeP({ label, cor }) {
  return <span style={{ background:cor+"22", color:cor, border:`1px solid ${cor}55`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>{label}</span>;
}




// ══════════════════════════════════════════════════════════════
// VISÃO DO APP PÚBLICO — espelhada no admin
// ══════════════════════════════════════════════════════════════

function fmtDataA(ts) { return ts ? new Date(ts).toLocaleDateString("pt-BR") : "—"; }
function fmtHoraA(ts) { return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" }) : "—"; }
function resultadoA(p) {
  if (p.cancelada === "S") return { label:"Cancelado", cor:C.dim };
  if (p.gols_marcados === null) return { label:"Aguardando", cor:C.gold };
  if (p.gols_marcados > p.gols_sofridos) return { label:"Vitória", cor:C.win };
  if (p.gols_marcados < p.gols_sofridos) return { label:"Derrota", cor:C.loss };
  return { label:"Empate", cor:C.draw };
}
function BadgeA({ label, cor }) {
  return <span style={{ background:cor+"22", color:cor, border:`1px solid ${cor}55`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>{label}</span>;
}

function VisaoGeral({ temporada }) {
  const { data: partidas, loading } = useQuery(
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo(nome)&order=data.asc`),
    [temporada.id_temporada]
  );
  const { data: topGols }   = useQuery(() => sb(`vw_stats_temporada?id_temporada=eq.${temporada.id_temporada}&select=*&order=gols_marcados.desc&limit=5`), [temporada.id_temporada]);
  const { data: topAssist } = useQuery(() => sb(`vw_stats_temporada?id_temporada=eq.${temporada.id_temporada}&select=*&order=assistencias.desc&limit=5`), [temporada.id_temporada]);

  if (loading) return <Spinner />;

  const jogadas = (partidas||[]).filter(p => p.cancelada !== "S" && p.gols_marcados !== null);
  const v  = jogadas.filter(p => p.gols_marcados > p.gols_sofridos).length;
  const e  = jogadas.filter(p => p.gols_marcados === p.gols_sofridos).length;
  const d  = jogadas.filter(p => p.gols_marcados < p.gols_sofridos).length;
  const gm = jogadas.reduce((a,p) => a + (p.gols_marcados||0), 0);
  const gs = jogadas.reduce((a,p) => a + (p.gols_sofridos||0), 0);
  const pts = v*3+e;
  const pct = jogadas.length > 0 ? Math.round((pts/(jogadas.length*3))*100) : 0;
  const ultima  = [...jogadas].reverse()[0];
  const proxima = (partidas||[]).find(p => p.cancelada !== "S" && p.gols_marcados === null);
  const maxGols   = topGols?.[0]?.gols_marcados || 1;
  const maxAssist = topAssist?.[0]?.assistencias || 1;

  const StatCard = ({ label, value, cor }) => (
    <Card style={{ textAlign:"center", padding:"18px 10px" }}>
      <div style={{ fontSize:36, fontWeight:800, color:cor||C.gold, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:C.dim, marginTop:6, textTransform:"uppercase", letterSpacing:"0.1em" }}>{label}</div>
    </Card>
  );

  const RankList = ({ items, valKey, cor }) => {
    const max = items?.[0]?.[valKey] || 1;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {(items||[]).map((j,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:13, color:cor, fontWeight:800, width:18, textAlign:"center" }}>{i+1}</span>
            <div style={{ width:34, height:34, borderRadius:"50%", background:C.surf2, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:cor, fontSize:13 }}>{j.camisa||"?"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13 }}>{j.jogador}</div>
              <div style={{ fontSize:11, color:C.dim }}>{j.posicao}</div>
            </div>
            <span style={{ fontSize:22, fontWeight:800, color:cor }}>{j[valKey]}</span>
            <div style={{ width:60, height:5, background:C.surf2, borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${(j[valKey]/max)*100}%`, height:"100%", background:cor, borderRadius:3 }}/>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const uniformes = [
    { url: temporada?.uniforme_1_url, label:"Uniforme 1" },
    { url: temporada?.uniforme_2_url, label:"Uniforme 2" },
    { url: temporada?.uniforme_3_url, label:"Uniforme 3" },
  ].filter(u => u.url);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {(temporada?.escudo_url || uniformes.length > 0) && (
        <Card style={{ padding:"16px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
            {temporada?.escudo_url && (
              <img src={temporada.escudo_url} alt="Escudo"
                style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover", border:`3px solid ${C.gold}` }}/>
            )}
            {uniformes.length > 0 && (
              <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                {uniformes.map(u => (
                  <div key={u.label} style={{ textAlign:"center" }}>
                    <img src={u.url} alt={u.label}
                      style={{ width:72, height:72, objectFit:"contain", borderRadius:8, background:C.surf2, border:`1px solid ${C.border}`, display:"block", marginBottom:4 }}/>
                    <div style={{ fontSize:10, color:C.dim }}>{u.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
      <style>{`.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}@media(max-width:480px){.stat-grid{grid-template-columns:repeat(2,1fr)}}`}</style>
      <div className="stat-grid">
        <StatCard label="Jogos" value={jogadas.length}/>
        <StatCard label="Vitórias" value={v} cor={C.win}/>
        <StatCard label="Empates" value={e} cor={C.draw}/>
        <StatCard label="Derrotas" value={d} cor={C.loss}/>
      </div>
      <div className="stat-grid">
        <StatCard label="Pontos" value={pts} cor={C.gold}/>
        <StatCard label="Gols Pró" value={gm}/>
        <StatCard label="Gols Contra" value={gs} cor={C.dim}/>
        <StatCard label="Aproveit." value={`${pct}%`} cor={pct>=60?C.win:pct>=40?C.draw:C.loss}/>
      </div>

      <style>{`.duo-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:480px){.duo-grid{grid-template-columns:1fr}}`}</style>
      <div className="duo-grid">
        <Card>
          <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:14, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Último Jogo</div>
          {ultima ? (<>
            <div style={{ fontSize:13, color:C.dim, marginBottom:4 }}>{fmtDataA(ultima.data)} · {ultima.em_casa==="S"?"Em Casa":"Fora"}</div>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{ultima.adversario?.nome}</div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:32, fontWeight:800, color:C.gold }}>{ultima.gols_marcados} × {ultima.gols_sofridos}</span>
              <BadgeA {...resultadoA(ultima)}/>
            </div>
            <div style={{ fontSize:12, color:C.dim, marginTop:6 }}>🏟️ {ultima.campo?.nome}</div>
          </>) : <div style={{color:C.dim}}>Nenhum jogo realizado ainda</div>}
        </Card>
        <Card>
          <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:14, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Próximo Jogo</div>
          {proxima ? (<>
            <div style={{ fontSize:13, color:C.dim, marginBottom:4 }}>{fmtDataA(proxima.data)} · {fmtHoraA(proxima.data)} · {proxima.em_casa==="S"?"Em Casa":"Fora"}</div>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{proxima.adversario?.nome||"A definir"}</div>
            <div style={{ fontSize:12, color:C.dim }}>🏟️ {proxima.campo?.nome}</div>
            <div style={{ marginTop:12, padding:"8px 14px", background:C.gold+"22", border:`1px solid ${C.gold}55`, borderRadius:8, display:"inline-block" }}>
              <span style={{ color:C.gold, fontWeight:700, fontSize:13 }}>⏰ Aguardando</span>
            </div>
          </>) : <div style={{color:C.dim}}>Sem jogos agendados</div>}
        </Card>
      </div>

      <div className="duo-grid">
        <Card><div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:14, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>⚽ Artilheiros</div><RankList items={topGols} valKey="gols_marcados" cor={C.gold}/></Card>
        <Card><div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:14, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>🅰️ Assistências</div><RankList items={topAssist} valKey="assistencias" cor={C.win}/></Card>
      </div>
    </div>
  );
}

function FichaPartidaPublica({ partida, onVoltar }) {
  const { data: participacoes, loading: loadPart } = useQuery(
    () => sb(`participacao?id_partida=eq.${partida.id_partida}&id_jogador=gt.0&select=*,jogador(nome,apelido,camisa,foto_url),posicao(nome)&order=titular.desc,camisa.asc`),
    [partida.id_partida]
  );
  const { data: gols, loading: loadGols } = useQuery(
    () => sb(`gol?select=*,participacao!inner(id_jogador,jogador(nome,apelido,camisa))&participacao.id_partida=eq.${partida.id_partida}&order=periodo.asc,minuto.asc`),
    [partida.id_partida]
  );

  const res = resultadoA(partida);
  const titulares = (participacoes||[]).filter(p => p.titular === "S");
  const reservas  = (participacoes||[]).filter(p => p.titular === "N");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <button onClick={onVoltar} style={{ background:"none", border:"none", color:C.gold, fontFamily:"inherit", fontWeight:700, fontSize:13, cursor:"pointer", textAlign:"left", padding:0, display:"flex", alignItems:"center", gap:6 }}>
        ← Voltar ao Calendário
      </button>

      {/* Cabeçalho da partida */}
      <Card style={{ padding:20 }}>
        <div style={{ fontSize:12, color:C.dim, marginBottom:4 }}>
          {fmtDataA(partida.data)} · {fmtHoraA(partida.data)} · {partida.em_casa==="S"?"🏠 Em Casa":"✈️ Fora"}
        </div>
        <div style={{ fontSize:24, fontWeight:800, textTransform:"uppercase", marginBottom:12 }}>{partida.adversario?.nome}</div>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:8 }}>
          <span style={{ fontSize:42, fontWeight:800, color:C.gold }}>{partida.gols_marcados} × {partida.gols_sofridos}</span>
          <BadgeA {...res}/>
        </div>
        <div style={{ fontSize:12, color:C.dim }}>🏟️ {partida.campo?.nome}</div>
        {partida.observacoes && <div style={{ fontSize:12, color:C.dim, marginTop:6 }}>📝 {partida.observacoes}</div>}
      </Card>

      {/* Gols */}
      {(gols||[]).length > 0 && (
        <Card>
          <div style={{fontSize:11,color:C.gold,textTransform:"uppercase",fontWeight:700,marginBottom:14,borderLeft:"3px solid "+C.gold,paddingLeft:10}}>⚽ Gols</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {(gols||[]).map((g,i) => {
              const j = g.participacao?.jogador;
              const nome = j?.apelido || j?.nome || "—";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:i<gols.length-1?`1px solid ${C.border}`:"none" }}>
                  <span style={{ fontSize:20 }}>⚽</span>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:700, color:C.gold }}>{nome}</span>
                    {g.gol_contra==="S" && <span style={{ marginLeft:6, fontSize:11, color:C.loss }}>(GC)</span>}
                    {g.penalti==="S" && <span style={{ marginLeft:6, fontSize:11, color:C.draw }}>(P)</span>}
                  </div>
                  <span style={{ fontSize:13, color:C.dim }}>{g.periodo}° · {g.minuto}'</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Escalação */}
      {titulares.length > 0 && (
        <Card>
          <div style={{fontSize:11,color:C.gold,textTransform:"uppercase",fontWeight:700,marginBottom:14,borderLeft:"3px solid "+C.gold,paddingLeft:10}}>👕 Escalação</div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.gold}`, paddingLeft:8 }}>
              Titulares ({titulares.length})
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
              {titulares.map(p => (
                <div key={p.id_participacao} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:C.surf2, borderRadius:8 }}>
                  {p.jogador?.foto_url
                    ? <img src={p.jogador.foto_url} alt={p.jogador.nome} style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}/>
                    : <div style={{ width:32, height:32, borderRadius:"50%", background:C.border, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:C.gold, fontSize:12, flexShrink:0 }}>{p.camisa}</div>
                  }
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.jogador?.apelido||p.jogador?.nome}</div>
                    <div style={{ fontSize:10, color:C.dim }}>{p.posicao?.nome}</div>
                  </div>
                  {p.capitao==="S" && <span title="Capitão" style={{ fontSize:14, marginLeft:"auto" }}>©</span>}
                </div>
              ))}
            </div>
          </div>
          {reservas.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.dim}`, paddingLeft:8 }}>
                Reservas ({reservas.length})
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
                {reservas.map(p => (
                  <div key={p.id_participacao} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:C.surf2, borderRadius:8, opacity:0.7 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:C.border, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:C.dim, fontSize:11, flexShrink:0 }}>{p.camisa}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.jogador?.apelido||p.jogador?.nome}</div>
                      <div style={{ fontSize:10, color:C.dim }}>{p.posicao?.nome}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}


function Calendario({ temporada }) {
  const [filtro, setFiltro] = useState("pendentes");
  const [partidaSel, setPartidaSel] = useState(null);
  const { data: partidas, loading } = useQuery(
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo(nome)&order=data.asc`),
    [temporada.id_temporada]
  );
  if (loading) return <Spinner />;

  if (partidaSel) return <FichaPartidaPublica partida={partidaSel} onVoltar={() => setPartidaSel(null)}/>;

  const all = partidas||[];
  const jogados   = all.filter(p => p.cancelada!=="S" && p.gols_marcados!==null);
  const pendentes = all.filter(p => p.cancelada!=="S" && p.gols_marcados===null);
  const lista = filtro==="jogados"?jogados:filtro==="pendentes"?pendentes:filtro==="casa"?all.filter(p=>p.em_casa==="S"):filtro==="fora"?all.filter(p=>p.em_casa==="N"):all;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {[["todos",`Todos (${all.length})`],["jogados",`Jogados (${jogados.length})`],["pendentes",`Pendentes (${pendentes.length})`],["casa","Em Casa"],["fora","Fora"]].map(([v,l]) => (
          <button key={v} onClick={()=>setFiltro(v)} style={{ background:filtro===v?C.gold:C.surf2, color:filtro===v?"#0B3D2E":C.dim, border:"none", padding:"6px 14px", borderRadius:8, fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>{l}</button>
        ))}
      </div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
            <thead><tr style={{ background:C.surf2 }}>
              {["Data","Hora","Adversário","Local","Campo","Placar","Resultado"].map(h => <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:C.dim, fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {lista.map((p,i) => {
                const res = resultadoA(p);
                return (
                  <tr key={p.id_partida}
                    onClick={() => { if (p.gols_marcados !== null && p.cancelada !== "S") setPartidaSel(p); }}
                    style={{ background:i%2===0?C.surface:C.bg, cursor: p.gols_marcados !== null && p.cancelada !== "S" ? "pointer" : "default" }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=C.surf2; }}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.surface:C.bg}>
                    <td style={{ padding:"12px 14px", fontWeight:600, whiteSpace:"nowrap" }}>{fmtDataA(p.data)}</td>
                    <td style={{ padding:"12px 14px", color:C.dim }}>{fmtHoraA(p.data)}</td>
                    <td style={{ padding:"12px 14px", fontWeight:700 }}>{p.adversario?.nome||"A definir"}</td>
                    <td style={{ padding:"12px 14px" }}>
                      <span style={{ padding:"2px 8px", borderRadius:4, fontSize:12, fontWeight:700, background:p.em_casa==="S"?C.gold+"22":C.surf2, color:p.em_casa==="S"?C.gold:C.dim }}>
                        {p.em_casa==="S"?"🏠 Casa":"✈️ Fora"}
                      </span>
                    </td>
                    <td style={{ padding:"12px 14px", color:C.dim, fontSize:12, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.campo?.nome}</td>
                    <td style={{ padding:"12px 14px", fontWeight:800, fontSize:16, whiteSpace:"nowrap", color:p.gols_marcados!==null?C.cream:C.dim }}>
                      {p.cancelada==="S"?"—":p.gols_marcados!==null?`${p.gols_marcados} × ${p.gols_sofridos}`:"— × —"}
                    </td>
                    <td style={{ padding:"12px 14px" }}><BadgeA {...res}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"10px 16px", borderTop:`1px solid ${C.border}`, fontSize:12, color:C.dim }}>{lista.length} partida{lista.length!==1?"s":""} exibida{lista.length!==1?"s":""}</div>
      </Card>
    </div>
  );
}

function Elenco({ time, temporada }) {
  const { data: jogadores, loading } = useQuery(
    () => sb(`jogador?id_jogador=gt.0&id_time=eq.${time.id_time}&select=*,posicao(nome)&order=camisa.asc`),
    [time.id_time]
  );
  if (loading) return <Spinner />;
  const ativos = (jogadores||[]).filter(j => !j.data_fim);
  const grupos = [...new Set(ativos.map(j => j.posicao?.nome).filter(Boolean))];
  const uniformes = [
    { url: temporada?.uniforme_1_url, label:"Uniforme 1" },
    { url: temporada?.uniforme_2_url, label:"Uniforme 2" },
    { url: temporada?.uniforme_3_url, label:"Uniforme 3" },
  ].filter(u => u.url);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Comissão da temporada */}
      {(temporada?.tecnico || temporada?.presidente) && (
        <Card>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
            {temporada.tecnico && (
              <div>
                <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>Técnico</div>
                <div style={{ fontWeight:700, color:C.cream }}>{temporada.tecnico}</div>
              </div>
            )}
            {temporada.presidente && (
              <div>
                <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>Presidente</div>
                <div style={{ fontWeight:700, color:C.cream }}>{temporada.presidente}</div>
              </div>
            )}
          </div>
        </Card>
      )}
      {/* Uniformes da temporada */}
      {uniformes.length > 0 && (
        <Card>
          <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", fontWeight:700, marginBottom:12 }}>👕 Uniformes</div>
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            {uniformes.map(u => (
              <div key={u.label} style={{ textAlign:"center" }}>
                <img src={u.url} alt={u.label}
                  style={{ width:100, height:100, objectFit:"contain", borderRadius:8, background:C.surf2, border:`1px solid ${C.border}`, display:"block", marginBottom:6 }}/>
                <div style={{ fontSize:11, color:C.dim }}>{u.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card style={{ padding:"14px 20px", display:"inline-flex", gap:20 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, fontWeight:800, color:C.gold }}>{ativos.length}</div>
          <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase" }}>Jogadores ativos</div>
        </div>
      </Card>
      {grupos.map(grupo => {
        const jogs = ativos.filter(j => j.posicao?.nome === grupo);
        return (
          <div key={grupo}>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>{grupo}</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(190px,1fr))", gap:10 }}>
              {jogs.map(j => (
                <div key={j.id_jogador} style={{ background:C.surface, borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, border:`1px solid ${C.border}` }}>
                  {j.foto_url
                    ? <img src={j.foto_url} alt={j.nome} style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}`, flexShrink:0 }}/>
                    : <div style={{ width:44, height:44, borderRadius:"50%", background:C.surf2, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:C.gold, fontSize:18, flexShrink:0 }}>{j.camisa}</div>
                  }
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{j.apelido||j.nome}</div>
                    {j.apelido && <div style={{ fontSize:11, color:C.dim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{j.nome}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Estatisticas({ time, temporada }) {
  const [sortKey, setSortKey] = useState("gols_marcados");
  const [asc, setAsc] = useState(false);
  const { data: stats, loading } = useQuery(
    () => temporada?.id_temporada ? sb(`vw_stats_temporada?id_temporada=eq.${temporada.id_temporada}&select=*`) : sb(`vw_estatisticas_jogadores?id_time=eq.${time.id_time}&select=*`),
    [temporada?.id_temporada, time.id_time]
  );
  if (loading) return <Spinner />;
  const sorted = [...(stats||[])].sort((a,b) => {
    const va=a[sortKey]??0; const vb=b[sortKey]??0;
    return asc?va-vb:vb-va;
  });
  const COLS = [
    { key:"camisa",           label:"#",       align:"center" },
    { key:"jogador",          label:"Jogador", align:"left", style:{fontWeight:700} },
    { key:"posicao",          label:"Posição", align:"left", style:{color:C.dim,fontSize:13} },
    { key:"total_partidas",   label:"PJ",      align:"center" },
    { key:"partidas_titular", label:"TIT",     align:"center" },
    { key:"partidas_reserva", label:"RES",     align:"center", style:{color:C.dim} },
    { key:"partidas_capitao", label:"CAP",     align:"center", style:{color:C.gold} },
    { key:"gols_marcados",    label:"Gols",    align:"center", style:{color:C.gold,fontWeight:800} },
    { key:"gols_1tempo",      label:"1ºT",     align:"center", style:{color:C.dim} },
    { key:"gols_2tempo",      label:"2ºT",     align:"center", style:{color:C.dim} },
    { key:"gols_penalti",     label:"Pen",     align:"center" },
    { key:"assistencias",     label:"Assist.", align:"center", style:{color:C.win,fontWeight:700} },
    { key:"gols_contra",      label:"GC",      align:"center", style:{color:C.loss} },
    { key:"cartoes_amarelos", label:"🟨",      align:"center" },
    { key:"cartoes_vermelhos",label:"🟥",      align:"center", style:{color:C.loss} },
  ];
  return (
    <Card style={{ padding:0, overflow:"hidden" }}>
      <div style={{ padding:"20px 24px 12px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:14, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Estatísticas dos Jogadores</div>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {COLS.map(c => (
              <th key={c.key} onClick={()=>{if(sortKey===c.key)setAsc(!asc);else{setSortKey(c.key);setAsc(false);}}}
                style={{ padding:"12px 14px", textAlign:c.align||"left", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:sortKey===c.key?C.gold:C.dim, fontWeight:700, cursor:"pointer", userSelect:"none", whiteSpace:"nowrap" }}>
                {c.label} {sortKey===c.key?(asc?"↑":"↓"):""}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {sorted.map((j,i) => (
              <tr key={i} style={{ background:i%2===0?C.surface:C.bg }}
                onMouseEnter={e=>e.currentTarget.style.background=C.surf2}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.surface:C.bg}>
                {COLS.map(c => <td key={c.key} style={{ padding:"12px 14px", textAlign:c.align||"left", ...(c.style||{}) }}>{j[c.key]??"—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding:"12px 24px", borderTop:`1px solid ${C.border}`, fontSize:12, color:C.dim }}>
        PJ=Partidas · TIT=Titular · RES=Reserva · CAP=Capitão · 1ºT/2ºT=Gols por tempo · Pen=Pênaltis · GC=Gols Contra · 🟨=Amarelos · 🟥=Vermelhos · Clique para ordenar
      </div>
    </Card>
  );
}

function Gols({ temporada }) {
  const [filtroPartida, setFiltroPartida] = useState("todos");
  const { data: gols, loading } = useQuery(() => sb(`vw_gols_partida?id_temporada=eq.${temporada.id_temporada}&select=*&order=data_partida.asc,periodo.asc,minuto.asc`), [temporada.id_temporada]);
  const { data: partidas } = useQuery(
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=id_partida,data,adversario(nome)&cancelada=eq.N&gols_marcados=not.is.null&order=data.asc`),
    [temporada.id_temporada]
  );
  if (loading) return <Spinner />;
  const lista = filtroPartida==="todos"?(gols||[]):(gols||[]).filter(g=>g.id_partida===Number(filtroPartida));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em" }}>Filtrar:</span>
        <select value={filtroPartida} onChange={e=>setFiltroPartida(e.target.value)} style={{ background:C.surf2, color:C.cream, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 14px", fontFamily:"inherit", fontSize:13 }}>
          <option value="todos">Todos os jogos ({(gols||[]).length} gols)</option>
          {(partidas||[]).map(p => {
            const qtd = (gols||[]).filter(g=>g.id_partida===p.id_partida).length;
            return <option key={p.id_partida} value={p.id_partida}>{fmtDataA(p.data)} — {p.adversario?.nome} ({qtd} gol{qtd!==1?"s":""})</option>;
          })}
        </select>
      </div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
            <thead><tr style={{ background:C.surf2 }}>
              {["Data","Adversário","Jogador","Período","Minuto","Pênalti","Gol Contra","Assistente"].map(h => <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:C.dim, fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {lista.map((g,i) => (
                <tr key={i} style={{ background:i%2===0?C.surface:C.bg }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surf2}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.surface:C.bg}>
                  <td style={{ padding:"12px 14px", color:C.dim, fontSize:13, whiteSpace:"nowrap" }}>{fmtDataA(g.data_partida)}</td>
                  <td style={{ padding:"12px 14px", fontWeight:700 }}>{g.adversario}</td>
                  <td style={{ padding:"12px 14px" }}>
                    <span style={{ color:C.gold, fontWeight:700 }}>⚽ {g.jogador}</span>
                    {g.gol_contra==="Sim" && <span style={{ marginLeft:6 }}><BadgeA label="GC" cor={C.loss}/></span>}
                    {g.penalti==="Sim" && <span style={{ marginLeft:6 }}><BadgeA label="P" cor={C.draw}/></span>}
                  </td>
                  <td style={{ padding:"12px 14px", textAlign:"center" }}>{g.periodo}°</td>
                  <td style={{ padding:"12px 14px", textAlign:"center", fontWeight:700 }}>{g.minuto}'</td>
                  <td style={{ padding:"12px 14px", textAlign:"center" }}>{g.penalti==="Sim"?<BadgeA label="Sim" cor={C.draw}/>:<span style={{color:C.dim,fontSize:13}}>Não</span>}</td>
                  <td style={{ padding:"12px 14px", textAlign:"center" }}>{g.gol_contra==="Sim"?<BadgeA label="Sim" cor={C.loss}/>:<span style={{color:C.dim,fontSize:13}}>Não</span>}</td>
                  <td style={{ padding:"12px 14px", color:g.assistente?C.win:C.dim }}>{g.assistente?`🅰️ ${g.assistente}`:"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"10px 16px", borderTop:`1px solid ${C.border}`, fontSize:12, color:C.dim }}>{lista.length} gol{lista.length!==1?"s":""} exibido{lista.length!==1?"s":""}</div>
      </Card>
    </div>
  );
}


function VisaoAppPublico({ time, temporadas }) {
  const [aba, setAba] = useState(0);
  const [temporadaSel, setTemporadaSel] = useState(null);
  useEffect(() => { if (temporadas?.length && !temporadaSel) setTemporadaSel(temporadas[0]); }, [temporadas]);

  const TABS_P = [
    { label:"Visão Geral", icon:"📊" },
    { label:"Calendário",  icon:"📅" },
    { label:"Elenco",      icon:"👕" },
    { label:"Estatísticas",icon:"📈" },
    { label:"Gols",        icon:"⚽" },
  ];

  if (!temporadaSel) return <Spinner/>;

  const screens = [
    <VisaoGeral    key="vg"   temporada={temporadaSel}/>,
    <Calendario    key="cal"  temporada={temporadaSel}/>,
    <Elenco        key="el"   time={time} temporada={temporadaSel}/>,
    <Estatisticas  key="st"   time={time} temporada={temporadaSel}/>,
    <Gols          key="gols" temporada={temporadaSel}/>,
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <Card style={{ padding:"16px 20px", background:C.surf2, border:`1px solid ${C.gold}44` }}>
        {/* Cabeçalho */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <span style={{ fontSize:18 }}>👁️</span>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:C.gold, textTransform:"uppercase" }}>Visão App Público</div>
            <div style={{ fontSize:11, color:C.dim }}>{time?.nome} — visualizando como o público vê</div>
          </div>
        </div>

        {/* Seletor de temporada — sempre visível */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Temporada</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {(temporadas||[]).map(t => (
              <button key={t.id_temporada}
                onClick={() => setTemporadaSel(t)}
                style={{ background: temporadaSel?.id_temporada === t.id_temporada ? C.gold : C.surface,
                  color: temporadaSel?.id_temporada === t.id_temporada ? "#0B3D2E" : C.cream,
                  border:`1px solid ${temporadaSel?.id_temporada === t.id_temporada ? C.gold : C.border}`,
                  borderRadius:8, padding:"6px 14px", fontFamily:"inherit", fontWeight:700,
                  fontSize:12, cursor:"pointer", textTransform:"uppercase",
                  display:"flex", alignItems:"center", gap:6 }}>
                {t.publico !== false ? "🌐" : "🔒"} {t.nome}
              </button>
            ))}
            {!(temporadas||[]).length && <span style={{ color:C.dim, fontSize:12 }}>Nenhuma temporada cadastrada</span>}
          </div>
        </div>

        {/* Abas */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
          {TABS_P.map((t,i) => (
            <button key={t.label} onClick={() => setAba(i)}
              style={{ background: aba===i ? C.gold : "transparent", color: aba===i ? "#0B3D2E" : C.dim,
                border:`1px solid ${aba===i ? C.gold : C.border}`, borderRadius:8, padding:"6px 14px",
                fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase",
                display:"flex", alignItems:"center", gap:5 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </Card>
      {screens[aba]}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MÓDULO IMPORTAÇÃO / EXPORTAÇÃO
// ══════════════════════════════════════════════════════════════

function exportarExcel(dados, colunas, nomeArquivo, instrucoes) {
  const XLSX = window.XLSX;
  if (!XLSX) { alert("Recarregue a página para usar esta função."); return; }
  const wb = XLSX.utils.book_new();
  const header = colunas.map(c => c.label);
  const rows = dados.map(row => colunas.map(c => {
    const val = row[c.key];
    if (val === null || val === undefined) return "";
    if (c.format) return c.format(val);
    return val;
  }));
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = colunas.map(c => ({ wch: c.width || 20 }));
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  if (instrucoes) {
    const wsInst = XLSX.utils.aoa_to_sheet([
      ["INSTRUÇÕES DE PREENCHIMENTO"], [""],
      ...instrucoes.map(i => [i]), [""], ["COLUNAS:"],
      ...colunas.map(c => [`${c.label}: ${c.descricao||""}`]),
    ]);
    wsInst["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInst, "Instruções");
  }
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
}

function lerExcel(file) {
  return new Promise((resolve, reject) => {
    const XLSX = window.XLSX;
    if (!XLSX) { reject(new Error("Biblioteca Excel não disponível")); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}

function BotoesImportExport({ onExportar, onImportar, loadingImport }) {
  const inputRef = React.useRef();
  return (
    <div style={{ display:"flex", gap:8 }}>
      <button onClick={onExportar} style={{ background:"#174D36", border:"1px solid #1F5C3E", borderRadius:8, padding:"7px 14px", color:"#F0E8D0", fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
        📥 Exportar
      </button>
      <button onClick={() => inputRef.current?.click()} disabled={loadingImport} style={{ background:"#174D36", border:"1px solid #1F5C3E", borderRadius:8, padding:"7px 14px", color:"#F0E8D0", fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:loadingImport?"not-allowed":"pointer", textTransform:"uppercase" }}>
        📤 {loadingImport?"Validando...":"Importar"}
      </button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={e => { if(e.target.files[0]) onImportar(e.target.files[0]); e.target.value=""; }} style={{ display:"none" }}/>
    </div>
  );
}

function ModalImportacao({ resultado, onClose, onConfirmar, salvando }) {
  if (!resultado) return null;
  const { erros, validos, mensagem } = resultado;
  const temErros = erros && erros.length > 0;
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", display:"flex", alignItems:"center", justifyContent:"center", zIndex:600, padding:24 }}>
      <div style={{ background:"#103D2A", borderRadius:12, border:"1px solid #1F5C3E", width:"100%", maxWidth:600, maxHeight:"80vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1F5C3E" }}>
          <span style={{ fontWeight:700, fontSize:16, textTransform:"uppercase", color:temErros?"#E53935":"#4CAF50" }}>
            {temErros?"❌ Erros Encontrados":"✅ Pronto para Importar"}
          </span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#8FAF9A", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:20, overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
          {temErros ? (
            <>
              <div style={{ background:"#E5393522", border:"1px solid #E5393555", borderRadius:8, padding:"12px 16px" }}>
                <div style={{ color:"#E53935", fontWeight:700, marginBottom:4 }}>⚠️ {erros.length} erro{erros.length!==1?"s":""} — nenhum dado importado.</div>
                <div style={{ fontSize:12, color:"#8FAF9A" }}>Corrija a planilha e tente novamente.</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {erros.map((e,i) => (
                  <div key={i} style={{ background:"#174D36", borderRadius:6, padding:"8px 12px", fontSize:13 }}>
                    <span style={{ color:"#E8A020", fontWeight:700 }}>Linha {e.linha}:</span>{" "}
                    <span style={{ color:"#F0E8D0" }}>{e.mensagem}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ background:"#4CAF5022", border:"1px solid #4CAF5055", borderRadius:8, padding:"12px 16px" }}>
                <div style={{ color:"#4CAF50", fontWeight:700, marginBottom:4 }}>✅ {validos} registro{validos!==1?"s":""} validado{validos!==1?"s":""}</div>
                <div style={{ fontSize:12, color:"#8FAF9A" }}>{mensagem}</div>
              </div>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
                <button onClick={onClose} style={{ background:"#174D36", border:"1px solid #1F5C3E", borderRadius:8, padding:"9px 18px", color:"#F0E8D0", fontFamily:"inherit", fontWeight:700, fontSize:13, cursor:"pointer", textTransform:"uppercase" }}>Cancelar</button>
                <button onClick={onConfirmar} disabled={salvando} style={{ background:"#E8A020", border:"none", borderRadius:8, padding:"9px 18px", color:"#0B3D2E", fontFamily:"inherit", fontWeight:700, fontSize:13, cursor:salvando?"not-allowed":"pointer", textTransform:"uppercase" }}>
                  {salvando?"Importando...":"Confirmar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════

// ── Ordenação — função utilitária pura (sem hooks) ───────────
function sortData(dados, sortKey, asc) {
  if (!sortKey) return [...(dados||[])];
  return [...(dados||[])].sort((a, b) => {
    function getVal(obj, key) {
      if (!key) return "";
      const parts = key.split(".");
      let v = obj;
      for (const p of parts) v = v?.[p];
      return v ?? "";
    }
    const va = String(getVal(a, sortKey)).toLowerCase();
    const vb = String(getVal(b, sortKey)).toLowerCase();
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

function ThSortable({ colKey, sortKey, asc, onSort, children }) {
  const ativo = sortKey === colKey;
  return (
    <th onClick={() => colKey && onSort(colKey)}
      style={{ padding:"10px 14px", textAlign:"left", fontSize:11,
        color: ativo ? C.gold : C.dim, textTransform:"uppercase",
        fontWeight:700, whiteSpace:"nowrap",
        cursor: colKey ? "pointer" : "default",
        userSelect:"none" }}>
      {children}{colKey ? (ativo ? (asc ? " ↑" : " ↓") : " ↕") : ""}
    </th>
  );
}




const C = {
  bg:      "#0B3D2E", surface: "#103D2A", surf2: "#174D36",
  border:  "#1F5C3E", gold: "#E8A020",    cream: "#F0E8D0",
  dim:     "#8FAF9A", win: "#4CAF50",     loss: "#E53935",
  draw:    "#E8A020",
};

// ── Atoms ─────────────────────────────────────────────────────
const f = (tag, base) => ({ children, style: s = {}, ...p }) =>
  { const T = tag; return <T style={{ ...base, ...s }} {...p}>{children}</T>; };

function Card({ children, style: s = {} }) {
  return <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, ...s }}>{children}</div>;
}
function Btn({ children, variant = "primary", onClick, disabled, style: s = {}, type = "button" }) {
  const bg = disabled ? C.surf2 : variant === "primary" ? C.gold : variant === "danger" ? C.loss : C.surf2;
  const color = disabled ? C.dim : variant === "primary" ? "#0B3D2E" : C.cream;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ background: bg, color, border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.06em", transition: "opacity 0.15s", ...s }}>
      {children}
    </button>
  );
}
function Input({ label, error, style: s = {}, ...p }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...s }}>
      {label && <label style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</label>}
      <input {...p} style={{ background: C.surf2, border: `1px solid ${error ? C.loss : C.border}`, borderRadius: 8, padding: "9px 12px", color: C.cream, fontFamily: "inherit", fontSize: 14, outline: "none", width: "100%" }} />
      {error && <span style={{ color: C.loss, fontSize: 12 }}>{error}</span>}
    </div>
  );
}
function Select({ label, children, error, style: s = {}, ...p }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...s }}>
      {label && <label style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</label>}
      <select {...p} style={{ background: C.surf2, border: `1px solid ${error ? C.loss : C.border}`, borderRadius: 8, padding: "9px 12px", color: C.cream, fontFamily: "inherit", fontSize: 14, outline: "none", width: "100%" }}>
        {children}
      </select>
      {error && <span style={{ color: C.loss, fontSize: 12 }}>{error}</span>}
    </div>
  );
}
function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function Toast({ msg, type }) {
  if (!msg) return null;
  const cor = type === "error" ? C.loss : C.win;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, background: C.surf2, border: `1px solid ${cor}`, borderRadius: 10, padding: "12px 20px", color: cor, fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 20px #00000088" }}>
      {type === "error" ? "❌" : "✅"} {msg}
    </div>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000088", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontWeight: 700, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.dim, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </Card>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

function useQuery(fetcher, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetcher()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

function fmtData(ts) { return ts ? new Date(ts).toLocaleDateString("pt-BR") : "—"; }
function fmtHora(ts) { return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"; }
function resultado(p) {
  if (p.cancelada === "S")      return { label: "Cancelado", cor: C.dim };
  if (p.gols_marcados === null) return { label: "Pendente",  cor: C.dim };
  if (p.gols_marcados > p.gols_sofridos) return { label: "Vitória", cor: C.win };
  if (p.gols_marcados < p.gols_sofridos) return { label: "Derrota", cor: C.loss };
  return { label: "Empate", cor: C.draw };
}
function Badge({ label, cor }) {
  return <span style={{ background: cor+"22", color: cor, border:`1px solid ${cor}55`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>{label}</span>;
}

// ── LOGIN ─────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail]   = useState("");
  const [senha, setSenha]   = useState("");
  const [erro, setErro]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setErro(""); setLoading(true);
    const res = await sbAuth("token?grant_type=password", { email, password: senha });
    setLoading(false);
    if (res.access_token) {
      SESSION_TOKEN = res.access_token;
      sessionStorage.setItem("ndc_token", res.access_token);
      onLogin(res);
    }
    else setErro("E-mail ou senha incorretos.");
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif" }}>
      <Card style={{ width: 380, padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:4 }}>
            <img src="/logo.png" alt="Nerd do Campo" style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover" }}/>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.cream, textTransform: "uppercase", letterSpacing: "0.08em" }}>Nerd do Campo</div>
          <div style={{ fontSize: 12, color: C.gold, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.12em" }}>Painel Admin</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@seutime.com" />
          <Input label="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && handleLogin()} />
          {erro && <div style={{ color: C.loss, fontSize: 13, textAlign: "center" }}>{erro}</div>}
          <Btn onClick={handleLogin} disabled={loading} style={{ marginTop: 8, padding: "12px" }}>
            {loading ? "Entrando..." : "Entrar"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ── LISTA DE PARTIDAS ─────────────────────────────────────────
function ListaPartidas({ temporada, onSelect, onNova, adversarios, campos, show: onShow }) {
  const { data: partidas, loading, reload } = useQuery(
    () => api.get(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo(nome)&order=data.asc`),
    [temporada.id_temporada]
  );

  const [filtro, setFiltro] = useState("pendentes");
  const [loadingImportPartida, setLoadingImportPartida] = useState(false);
  const [resultadoImportPartida, setResultadoImportPartida] = useState(null);

  const all      = partidas || [];
  const pendentes = all.filter(p => p.cancelada !== "S" && p.gols_marcados === null);
  const jogados   = all.filter(p => p.cancelada !== "S" && p.gols_marcados !== null);
  const lista = filtro === "pendentes" ? pendentes : filtro === "jogados" ? jogados : all;

  async function confirmarImportPartidas() {
    try {
      for (const row of resultadoImportPartida._dados) {
        const adv = row._adv;
        const campo = (campos||[]).find(c => c.nome.toUpperCase() === String(row.campo||"").trim().toUpperCase());
        const partes = String(row.data||"").split("/");
        const dia = partes[0]?.padStart(2,"0") || "01";
        const mes = partes[1]?.padStart(2,"0") || "01";
        const ano = partes[2] || new Date().getFullYear();
        const hora = String(row.hora||"00:00");
        const dataISO = `${ano}-${mes}-${dia}T${hora}:00`;
        const gm = row["gols_marcados"] !== "" ? Number(row["gols_marcados"]) : null;
        const gs = row["gols_sofridos"] !== "" ? Number(row["gols_sofridos"]) : null;
        const body = {
          id_temporada: temporada.id_temporada,
          id_adversario: adv.id_adversario,
          data: dataISO,
          em_casa: String(row.em_casa||"NAO").toUpperCase()==="SIM"?"S":"N",
          cancelada: String(row.cancelada||"NAO").toUpperCase()==="SIM"?"S":"N",
          id_campo: campo?.id_campo || adv.id_campo || null,
          gols_marcados: gm,
          gols_sofridos: gs,
          observacoes: row.observacoes||null,
        };
        if (row.id_partida) await api.patch(`partida?id_partida=eq.${row.id_partida}`, body);
        else await api.post("partida", body);
      }
      onShow && onShow(`${resultadoImportPartida._dados.length} partida(s) importada(s)!`);
      setResultadoImportPartida(null); reload();
    } catch(e) { onShow && onShow(e.message, "error"); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["pendentes", `Pendentes (${pendentes.length})`], ["jogados", `Jogados (${jogados.length})`], ["todos", `Todos (${all.length})`]].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{ background: filtro === v ? C.gold : C.surf2, color: filtro === v ? "#0B3D2E" : C.dim, border: "none", padding: "6px 14px", borderRadius: 8, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <BotoesImportExport
            onExportar={() => exportarExcel(
              (partidas||[]).map(p => ({
                id_partida: p.id_partida,
                adversario: p.adversario?.nome||"",
                data: p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "",
                hora: p.data ? new Date(p.data).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "",
                em_casa: p.em_casa==="S"?"SIM":"NAO",
                cancelada: p.cancelada==="S"?"SIM":"NAO",
                campo: p.campo?.nome||"",
                gols_marcados: p.gols_marcados??(""),
                gols_sofridos: p.gols_sofridos??(""),
                observacoes: p.observacoes||"",
              })),
              [
                { key:"id_partida",    label:"id",            width:8,  descricao:"NÃO altere. Vazio = nova partida." },
                { key:"adversario",    label:"adversario",    width:25, descricao:"Nome exato do adversário cadastrado. OBRIGATÓRIO." },
                { key:"data",          label:"data",          width:14, descricao:"Data no formato DD/MM/AAAA. OBRIGATÓRIO." },
                { key:"hora",          label:"hora",          width:8,  descricao:"Hora no formato HH:MM. OBRIGATÓRIO." },
                { key:"em_casa",       label:"em_casa",       width:8,  descricao:"SIM ou NAO." },
                { key:"cancelada",     label:"cancelada",     width:8,  descricao:"SIM ou NAO." },
                { key:"campo",         label:"campo",         width:25, descricao:"Nome exato do campo cadastrado." },
                { key:"gols_marcados", label:"gols_marcados", width:12, descricao:"Número de gols do time. Deixe vazio se pendente." },
                { key:"gols_sofridos", label:"gols_sofridos", width:12, descricao:"Número de gols sofridos. Deixe vazio se pendente." },
                { key:"observacoes",   label:"observacoes",   width:40, descricao:"Observações da partida." },
              ],
              "partidas",
              ["- id preenchido = atualiza partida existente", "- id vazio = cria nova partida", "- Adversário e Campo devem estar cadastrados", "- Data: DD/MM/AAAA | Hora: HH:MM"]
            )}
            onImportar={async (file) => {
              setLoadingImportPartida(true);
              try {
                const rows = await lerExcel(file);
                const erros = []; const validos = [];
                rows.forEach((row, i) => {
                  const linha = i + 2;
                  const advNome = String(row["adversario"]||"").trim();
                  if (!advNome) { erros.push({ linha, mensagem: "Campo 'adversario' é obrigatório." }); return; }
                  const advOk = (adversarios||[]).find(a => a.nome.toUpperCase() === advNome.toUpperCase());
                  if (!advOk) { erros.push({ linha, mensagem: `Adversário '${advNome}' não encontrado.` }); return; }
                  if (!String(row["data"]||"").trim()) { erros.push({ linha, mensagem: "Campo 'data' é obrigatório." }); return; }
                  if (!String(row["hora"]||"").trim()) { erros.push({ linha, mensagem: "Campo 'hora' é obrigatório." }); return; }
                  const gm = row["gols_marcados"] !== "" ? Number(row["gols_marcados"]) : null;
                  const gs = row["gols_sofridos"] !== "" ? Number(row["gols_sofridos"]) : null;
                  if (gm !== null && isNaN(gm)) erros.push({ linha, mensagem: "gols_marcados deve ser número." });
                  if (gs !== null && isNaN(gs)) erros.push({ linha, mensagem: "gols_sofridos deve ser número." });
                  if (!erros.find(e => e.linha === linha)) validos.push({...row, _adv: advOk});
                });
                setResultadoImportPartida({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r.id_partida).length} atualizações + ${validos.filter(r=>!r.id_partida).length} novas.`, _dados: validos });
              } catch(e) { onShow(e.message, "error"); } finally { setLoadingImportPartida(false); }
            }}
            loadingImport={loadingImportPartida}
          />
          <Btn onClick={onNova}>+ Nova Partida</Btn>
        </div>
      </div>

      <ModalImportacao resultado={resultadoImportPartida} onClose={() => setResultadoImportPartida(null)} onConfirmar={confirmarImportPartidas} salvando={false}/>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map(p => {
          const res = resultado(p);
          const pendente = p.gols_marcados === null && p.cancelada !== "S";
          return (
            <div key={p.id_partida}
              onClick={() => { console.log("clicou", p.id_partida); onSelect(p); }}
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "background 0.15s", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.surf2}
              onMouseLeave={e => e.currentTarget.style.background = C.surface}>
              <div style={{ minWidth: 80 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: pendente ? C.gold : C.cream }}>{fmtData(p.data)}</div>
                <div style={{ fontSize: 12, color: C.dim }}>{fmtHora(p.data)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.adversario?.nome || "A definir"}</div>
                <div style={{ fontSize: 12, color: C.dim }}>{p.em_casa === "S" ? "🏠 Casa" : "✈️ Fora"} · {p.campo?.nome}</div>
              </div>
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {p.gols_marcados !== null
                  ? <span style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>{p.gols_marcados} × {p.gols_sofridos}</span>
                  : <span style={{ fontSize: 13, color: C.gold }}>⏰ Aguardando</span>}
                <Badge label={res.label} cor={res.cor} />
              </div>
              <div style={{ color: C.dim, fontSize: 18 }}>›</div>
            </div>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: C.dim, padding: 40 }}>Nenhuma partida encontrada</div>}
      </div>
    </div>
  );
}

// Wrapper que busca adversarios e campos para passar à ListaPartidas
function ListaPartidasWrapper({ temporada, onSelect, onNova, show }) {
  const { data: adversarios } = useQuery(() => api.get(`adversario?select=*&order=nome.asc`));
  const { data: campos }      = useQuery(() => api.get(`campo?select=*&order=nome.asc`));
  return <ListaPartidas temporada={temporada} onSelect={onSelect} onNova={onNova} adversarios={adversarios} campos={campos} show={show}/>;
}

// ── FORM NOVA PARTIDA ─────────────────────────────────────────
function FormNovaPartida({ temporada, onSalvo, onCancelar }) {
  const { data: adversarios } = useQuery(() => api.get(`adversario?select=*&order=nome.asc`));
  const { data: campos }      = useQuery(() => api.get(`campo?select=*&order=nome.asc`));
  const { data: time }        = useQuery(() => api.get(`time?select=*&limit=1`));

  const [form, setForm] = useState({ data: "", horario: "14:00", id_adversario: "", em_casa: "S", id_campo: "", observacoes: "" });
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  // auto-preenche campo conforme casa/fora
  useEffect(() => {
    if (form.em_casa === "S" && time?.[0]?.id_campo) {
      setForm(f => ({ ...f, id_campo: String(time[0].id_campo) }));
    } else if (form.em_casa === "N" && form.id_adversario) {
      const adv = (adversarios || []).find(a => String(a.id_adversario) === form.id_adversario);
      if (adv?.id_campo) setForm(f => ({ ...f, id_campo: String(adv.id_campo) }));
    }
  }, [form.em_casa, form.id_adversario, time, adversarios]);

  async function salvar() {
    if (!form.data || !form.id_adversario || !form.id_campo) { show("Preencha todos os campos obrigatórios.", "error"); return; }
    setSaving(true);
    try {
      const dataTs = new Date(`${form.data}T${form.horario}:00`).toISOString();
      await api.post("partida", {
        id_temporada: temporada.id_temporada,
        id_adversario: Number(form.id_adversario),
        data: dataTs,
        em_casa: form.em_casa,
        id_campo: Number(form.id_campo),
        observacoes: form.observacoes,
        cancelada: "N",
      });
      show("Partida criada!");
      setTimeout(onSalvo, 800);
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Toast {...(toast || { msg: null })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Data *" type="date" value={form.data} onChange={e => set("data", e.target.value)} />
        <Input label="Horário *" type="time" value={form.horario} onChange={e => set("horario", e.target.value)} />
      </div>
      <Select label="Adversário *" value={form.id_adversario} onChange={e => set("id_adversario", e.target.value)}>
        <option value="">Selecione...</option>
        {(adversarios || []).map(a => <option key={a.id_adversario} value={a.id_adversario}>{a.nome}</option>)}
      </Select>
      <Select label="Local" value={form.em_casa} onChange={e => set("em_casa", e.target.value)}>
        <option value="S">🏠 Em Casa</option>
        <option value="N">✈️ Fora</option>
      </Select>
      <Select label="Campo *" value={form.id_campo} onChange={e => set("id_campo", e.target.value)}>
        <option value="">Selecione...</option>
        {(campos || []).map(c => <option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
      </Select>
      <Input label="Observações" value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Amistoso, campeonato, etc..." />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <Btn variant="secondary" onClick={onCancelar}>Cancelar</Btn>
        <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Criar Partida"}</Btn>
      </div>
    </div>
  );
}

// ── FICHA DA PARTIDA ──────────────────────────────────────────
function FichaPartida({ partida: p0, onVoltar }) {
  const [partida, setPartida] = useState(p0);
  const { toast, show } = useToast();

  const { data: jogadores }     = useQuery(() => api.get(`jogador?id_jogador=gt.0&select=*,posicao(nome)&order=camisa.asc`));
  const { data: posicoes }      = useQuery(() => api.get(`posicao?select=*&order=ordem.asc`));
  const { data: participacoes, reload: reloadPart } = useQuery(
    () => api.get(`participacao?id_partida=eq.${partida.id_partida}&id_jogador=gt.0&select=*,jogador(nome,apelido,camisa),posicao(nome)&order=camisa.asc`),
    [partida.id_partida]
  );
  const { data: gols, reload: reloadGols } = useQuery(
    () => api.get(`gol?select=*,participacao!inner(id_partida,id_jogador,jogador(nome,apelido)),jogador(nome,apelido)&participacao.id_partida=eq.${partida.id_partida}&order=periodo.asc,minuto.asc`),
    [partida.id_partida]
  );

  const [savingPlacar, setSavingPlacar] = useState(false);
  const [placar, setPlacar] = useState({ gols_marcados: p0.gols_marcados ?? "", gols_sofridos: p0.gols_sofridos ?? "" });
  const [modalEscalacao, setModalEscalacao] = useState(false);
  const [modalGol, setModalGol] = useState(false);
  const [editGol, setEditGol] = useState(null);

  async function salvarPlacar() {
    setSavingPlacar(true);
    try {
      const upd = await api.patch(`partida?id_partida=eq.${partida.id_partida}`, {
        gols_marcados: Number(placar.gols_marcados),
        gols_sofridos: Number(placar.gols_sofridos),
      });
      setPartida(u => ({ ...u, gols_marcados: Number(placar.gols_marcados), gols_sofridos: Number(placar.gols_sofridos) }));
      show("Placar salvo!");
    } catch (e) { show(e.message, "error"); }
    finally { setSavingPlacar(false); }
  }

  async function cancelarPartida() {
    if (!confirm("Cancelar esta partida?")) return;
    try {
      await api.patch(`partida?id_partida=eq.${partida.id_partida}`, { cancelada: "S" });
      setPartida(u => ({ ...u, cancelada: "S" }));
      show("Partida cancelada.");
    } catch (e) { show(e.message, "error"); }
  }

  async function removerGol(id_gol) {
    if (!confirm("Remover este gol?")) return;
    try {
      await api.delete(`gol?id_gol=eq.${id_gol}`);
      show("Gol removido."); reloadGols();
    } catch (e) { show(e.message, "error"); }
  }

  async function removerParticipacao(id) {
    if (!confirm("Remover jogador da partida?")) return;
    try {
      await api.delete(`participacao?id_participacao=eq.${id}`);
      show("Jogador removido."); reloadPart();
    } catch (e) { show(e.message, "error"); }
  }

  const res = resultado(partida);
  const cancelada = partida.cancelada === "S";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Toast {...(toast || { msg: null })} />

      {/* Cabeçalho da partida */}
      <Card style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>{fmtData(partida.data)} · {fmtHora(partida.data)} · {partida.em_casa === "S" ? "🏠 Em Casa" : "✈️ Fora"}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>{partida.adversario?.nome || p0.adversario?.nome}</div>
            <div style={{ fontSize: 13, color: C.dim }}>🏟️ {partida.campo?.nome || p0.campo?.nome}</div>
            {partida.observacoes && <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>📝 {partida.observacoes}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <Badge label={res.label} cor={res.cor} />
            {!cancelada && (
              <Btn variant="danger" style={{ fontSize: 11, padding: "6px 12px" }} onClick={cancelarPartida}>Cancelar Partida</Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Placar */}
      {!cancelada && (
        <Card style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, color: C.gold, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 16 }}>Placar Final</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Input label="Gols Marcados" type="number" min="0" value={placar.gols_marcados}
              onChange={e => setPlacar(p => ({ ...p, gols_marcados: e.target.value }))} style={{ width: 140 }} />
            <div style={{ fontSize: 28, fontWeight: 800, color: C.dim, marginTop: 20 }}>×</div>
            <Input label="Gols Sofridos" type="number" min="0" value={placar.gols_sofridos}
              onChange={e => setPlacar(p => ({ ...p, gols_sofridos: e.target.value }))} style={{ width: 140 }} />
            <Btn onClick={salvarPlacar} disabled={savingPlacar} style={{ marginTop: 20 }}>
              {savingPlacar ? "Salvando..." : "Salvar Placar"}
            </Btn>
          </div>
        </Card>
      )}

      {/* Escalação */}
      {!cancelada && (
        <Card style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: C.gold, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
              Escalação ({(participacoes || []).length} jogadores)
            </div>
            <Btn onClick={() => setModalEscalacao(true)}>+ Adicionar Jogador</Btn>
          </div>
          {(participacoes || []).length === 0
            ? <div style={{ color: C.dim, fontSize: 13 }}>Nenhum jogador adicionado ainda.</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: C.surf2 }}>
                      {["#", "Jogador", "Posição", "Titular", "Capitão", "🟨", "🟥", "GC", ""].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(participacoes || []).map((pa, i) => (
                      <tr key={pa.id_participacao} style={{ background: i % 2 === 0 ? C.surface : C.bg }}>
                        <td style={{ padding: "10px 12px", fontWeight: 800, color: C.gold }}>{pa.camisa}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>{pa.jogador?.apelido || pa.jogador?.nome}</td>
                        <td style={{ padding: "10px 12px", color: C.dim, fontSize: 13 }}>{pa.posicao?.nome}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><ToggleCell pa={pa} field="titular" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><ToggleCell pa={pa} field="capitao" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><NumCell pa={pa} field="cartao_amarelo" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><NumCell pa={pa} field="cartao_vermelho" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><NumCell pa={pa} field="gols_contra" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={() => removerParticipacao(pa.id_participacao)} style={{ background: "none", border: "none", color: C.loss, cursor: "pointer", fontSize: 16 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Card>
      )}

      {/* Gols */}
      {!cancelada && (
        <Card style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: C.gold, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
              Gols ({(gols || []).length})
            </div>
            <Btn onClick={() => { setEditGol(null); setModalGol(true); }}>+ Registrar Gol</Btn>
          </div>
          {(gols || []).length === 0
            ? <div style={{ color: C.dim, fontSize: 13 }}>Nenhum gol registrado ainda.</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(gols || []).map(g => {
                  const j = g.participacao?.jogador;
                  const nome = j?.apelido || j?.nome || "?";
                  const assist = g.jogador;
                  return (
                    <div key={g.id_gol} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.surf2, borderRadius: 8 }}>
                      <span style={{ fontSize: 18 }}>⚽</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, color: C.gold }}>{nome}</span>
                        {g.gol_contra === "S" && <Badge label="GC" cor={C.loss} style={{ marginLeft: 6 }} />}
                        {g.penalti    === "S" && <Badge label="Pen" cor={C.draw} style={{ marginLeft: 6 }} />}
                        {assist && <span style={{ color: C.win, fontSize: 13, marginLeft: 8 }}>🅰️ {assist.apelido || assist.nome}</span>}
                      </div>
                      <span style={{ color: C.dim, fontSize: 13 }}>{g.periodo}° · {g.minuto}'</span>
                      <button onClick={() => removerGol(g.id_gol)} style={{ background: "none", border: "none", color: C.loss, cursor: "pointer", fontSize: 16 }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )
          }
        </Card>
      )}

      {/* Modais */}
      {modalEscalacao && (
        <Modal title="Adicionar Jogador" onClose={() => setModalEscalacao(false)}>
          <FormEscalacao
            partida={partida}
            jogadores={jogadores || []}
            posicoes={posicoes || []}
            participacoes={participacoes || []}
            onSalvo={() => { setModalEscalacao(false); reloadPart(); show("Jogador adicionado!"); }}
            show={show}
          />
        </Modal>
      )}
      {modalGol && (
        <Modal title="Registrar Gol" onClose={() => setModalGol(false)}>
          <FormGol
            partida={partida}
            participacoes={participacoes || []}
            jogadores={jogadores || []}
            onSalvo={() => { setModalGol(false); reloadGols(); show("Gol registrado!"); }}
            show={show}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Células editáveis da escalação ────────────────────────────
function ToggleCell({ pa, field, reload, show }) {
  const [val, setVal]     = useState(pa[field]);
  const [saving, setSaving] = useState(false);
  async function toggle() {
    setSaving(true);
    const novo = val === "S" ? "N" : "S";
    try {
      await api.patch(`participacao?id_participacao=eq.${pa.id_participacao}`, { [field]: novo });
      setVal(novo);
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }
  return (
    <button onClick={toggle} disabled={saving} style={{ background: val === "S" ? C.win + "33" : C.surf2, border: `1px solid ${val === "S" ? C.win : C.border}`, borderRadius: 6, padding: "3px 10px", color: val === "S" ? C.win : C.dim, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
      {val === "S" ? "Sim" : "Não"}
    </button>
  );
}
function NumCell({ pa, field, reload, show }) {
  const [val, setVal]     = useState(pa[field] || 0);
  const [saving, setSaving] = useState(false);
  async function change(novo) {
    if (novo < 0) return;
    setSaving(true);
    try {
      await api.patch(`participacao?id_participacao=eq.${pa.id_participacao}`, { [field]: novo });
      setVal(novo);
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button onClick={() => change(val - 1)} disabled={val <= 0 || saving} style={{ background: C.surf2, border: `1px solid ${C.border}`, borderRadius: 4, width: 22, height: 22, color: C.dim, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>−</button>
      <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700, color: val > 0 ? C.cream : C.dim }}>{val}</span>
      <button onClick={() => change(val + 1)} disabled={saving} style={{ background: C.surf2, border: `1px solid ${C.border}`, borderRadius: 4, width: 22, height: 22, color: C.dim, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>+</button>
    </div>
  );
}

// ── FORM ESCALAÇÃO ────────────────────────────────────────────
function FormEscalacao({ partida, jogadores, posicoes, participacoes, onSalvo, show }) {
  const jaEscalados = new Set((participacoes).map(p => p.id_jogador));
  const disponiveis = jogadores.filter(j => !jaEscalados.has(j.id_jogador));

  const [form, setForm] = useState({ id_jogador: "", camisa: "", id_posicao: "", titular: "S", capitao: "N" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.id_jogador) {
      const j = jogadores.find(j => j.id_jogador === Number(form.id_jogador));
      if (j) setForm(f => ({ ...f, camisa: j.camisa || "", id_posicao: j.id_posicao ? String(j.id_posicao) : "" }));
    }
  }, [form.id_jogador]);

  async function salvar() {
    if (!form.id_jogador) { show("Selecione um jogador.", "error"); return; }
    setSaving(true);
    try {
      await api.post("participacao", {
        id_partida: partida.id_partida,
        id_jogador: Number(form.id_jogador),
        camisa: form.camisa,
        id_posicao: form.id_posicao ? Number(form.id_posicao) : null,
        titular: form.titular,
        capitao: form.capitao,
        cartao_amarelo: 0, cartao_vermelho: 0, gols_contra: 0,
      });
      onSalvo();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Select label="Jogador *" value={form.id_jogador} onChange={e => set("id_jogador", e.target.value)}>
        <option value="">Selecione...</option>
        {disponiveis.map(j => <option key={j.id_jogador} value={j.id_jogador}>#{j.camisa} — {j.apelido || j.nome}</option>)}
      </Select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Camisa" value={form.camisa} onChange={e => set("camisa", e.target.value)} />
        <Select label="Posição" value={form.id_posicao} onChange={e => set("id_posicao", e.target.value)}>
          <option value="">Selecione...</option>
          {posicoes.filter(p => p.id_posicao_pai).map(p => <option key={p.id_posicao} value={p.id_posicao}>{p.nome}</option>)}
        </Select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Select label="Titular" value={form.titular} onChange={e => set("titular", e.target.value)}>
          <option value="S">Sim</option><option value="N">Não</option>
        </Select>
        <Select label="Capitão" value={form.capitao} onChange={e => set("capitao", e.target.value)}>
          <option value="N">Não</option><option value="S">Sim</option>
        </Select>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Btn>
      </div>
    </div>
  );
}

// ── FORM GOL ──────────────────────────────────────────────────
function FormGol({ partida, participacoes, jogadores, onSalvo, show }) {
  const [form, setForm] = useState({ id_participacao: "", periodo: "1", minuto: "", penalti: "N", gol_contra: "N", id_assistente: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function salvar() {
    if (!form.id_participacao || !form.minuto) { show("Selecione o jogador e o minuto.", "error"); return; }
    setSaving(true);
    try {
      await api.post("gol", {
        id_participacao: Number(form.id_participacao),
        periodo: Number(form.periodo),
        minuto: Number(form.minuto),
        penalti: form.penalti,
        gol_contra: form.gol_contra,
        id_assistente: form.id_assistente ? Number(form.id_assistente) : null,
      });
      onSalvo();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Select label="Jogador que fez o gol *" value={form.id_participacao} onChange={e => set("id_participacao", e.target.value)}>
        <option value="">Selecione...</option>
        {participacoes.map(pa => <option key={pa.id_participacao} value={pa.id_participacao}>#{pa.camisa} — {pa.jogador?.apelido || pa.jogador?.nome}</option>)}
      </Select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Período *" type="number" min="1" value={form.periodo} onChange={e => set("periodo", e.target.value)} />
        <Input label="Minuto *" type="number" min="1" max="90" value={form.minuto} onChange={e => set("minuto", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Select label="Pênalti?" value={form.penalti} onChange={e => set("penalti", e.target.value)}>
          <option value="N">Não</option><option value="S">Sim</option>
        </Select>
        <Select label="Gol Contra?" value={form.gol_contra} onChange={e => set("gol_contra", e.target.value)}>
          <option value="N">Não</option><option value="S">Sim</option>
        </Select>
      </div>
      <Select label="Assistência (opcional)" value={form.id_assistente} onChange={e => set("id_assistente", e.target.value)}>
        <option value="">Sem assistência</option>
        {jogadores.map(j => <option key={j.id_jogador} value={j.id_jogador}>#{j.camisa} — {j.apelido || j.nome}</option>)}
      </Select>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Registrar Gol"}</Btn>
      </div>
    </div>
  );
}

// ── APP ADMIN ─────────────────────────────────────────────────
const MENU = [
  { id:"inicio",      label:"Início",      icon:"🏠", grupo:"" },
  { id:"app",         label:"Visão App",   icon:"👁️", grupo:"" },
  { id:"partidas",    label:"Partidas",    icon:"📅", grupo:"Jogos" },
  { id:"jogadores",   label:"Jogadores",   icon:"👕", grupo:"Cadastros" },
  { id:"adversarios", label:"Adversários", icon:"⚔️", grupo:"Cadastros" },
  { id:"campos",      label:"Campos",      icon:"🏟️", grupo:"Cadastros" },
  { id:"cidades",     label:"Cidades",     icon:"📍", grupo:"Cadastros" },
  { id:"posicoes",    label:"Posições",    icon:"🎯", grupo:"Cadastros" },
  { id:"temporadas",  label:"Temporadas",  icon:"📆", grupo:"Configurações" },
  { id:"time",        label:"Meu Time",    icon:"⚙️", grupo:"Configurações" },
  { id:"mensalidades",label:"Mensalidades", icon:"💰", grupo:"Financeiro" },
];


// ══════════════════════════════════════════════════════════════
// PÁGINA DE INÍCIO / ONBOARDING
// ══════════════════════════════════════════════════════════════
function PaginaInicio({ dados, onNavegar }) {
  const { cidades, campos, posicoes, adversarios, jogadores, temporadas, partidas } = dados;

  const etapas = [
    {
      numero: 1,
      titulo: "Cidades",
      icone: "📍",
      menu: "cidades",
      descricao: "Cadastre as cidades onde os jogos acontecem.",
      exemplo: "Ex: Sapiranga, Ivoti, Novo Hamburgo",
      concluido: (cidades||[]).length > 0,
      obrigatorio: true,
      dica: "Necessário antes de cadastrar campos.",
    },
    {
      numero: 2,
      titulo: "Campos",
      icone: "🏟️",
      menu: "campos",
      descricao: "Cadastre os campos/locais onde os jogos são realizados.",
      exemplo: "Ex: Assoc. Esp. Sapiranga, CT do XV",
      concluido: (campos||[]).length > 0,
      obrigatorio: true,
      dica: "Necessário antes de cadastrar adversários e partidas.",
    },
    {
      numero: 3,
      titulo: "Posições",
      icone: "🎯",
      menu: "posicoes",
      descricao: "Configure as posições dos jogadores (já vêm pré-cadastradas).",
      exemplo: "Ex: Goleiro, Zagueiro, Meia, Atacante",
      concluido: (posicoes||[]).length > 0,
      obrigatorio: true,
      dica: "Necessário antes de cadastrar jogadores.",
    },
    {
      numero: 4,
      titulo: "Adversários",
      icone: "⚔️",
      menu: "adversarios",
      descricao: "Cadastre os times adversários que vocês enfrentam.",
      exemplo: "Ex: Trianon, Valencia, Borussia",
      concluido: (adversarios||[]).length > 0,
      obrigatorio: true,
      dica: "Necessário antes de cadastrar partidas.",
    },
    {
      numero: 5,
      titulo: "Jogadores",
      icone: "👕",
      menu: "jogadores",
      descricao: "Cadastre o elenco do time com nome, camisa e posição.",
      exemplo: "Ex: Dudu (camisa 9), Leo (camisa 5)",
      concluido: (jogadores||[]).length > 0,
      obrigatorio: true,
      dica: "Necessário para registrar escalações e gols.",
    },
    {
      numero: 6,
      titulo: "Temporada",
      icone: "📆",
      menu: "temporadas",
      descricao: "Configure a temporada atual com datas e comissão técnica.",
      exemplo: "Ex: Temporada 2025 (Jan/2025 - Dez/2025)",
      concluido: (temporadas||[]).length > 0,
      obrigatorio: true,
      dica: "Necessário antes de cadastrar partidas.",
    },
    {
      numero: 7,
      titulo: "Partidas",
      icone: "📅",
      menu: "partidas",
      descricao: "Monte o calendário com todos os jogos da temporada.",
      exemplo: "Ex: Juventus x Trianon — 21/06/2025 14:00",
      concluido: (partidas||[]).length > 0,
      obrigatorio: true,
      dica: "Após cadastrar, registre o placar e escalação após cada jogo.",
    },
  ];

  const concluidas = etapas.filter(e => e.concluido).length;
  const pct = Math.round((concluidas / etapas.length) * 100);
  const proxima = etapas.find(e => !e.concluido);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Header de boas-vindas */}
      <Card style={{ padding:"24px 28px", background:"linear-gradient(135deg,#103D2A,#174D36)" }}>
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>
          Bem-vindo ao Nerd do Campo
        </div>
        <div style={{ fontSize:22, fontWeight:800, color:C.cream, marginBottom:12 }}>
          {pct === 100 ? "✅ Configuração completa!" : `Configure seu time em ${etapas.length} passos`}
        </div>

        {/* Barra de progresso */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <div style={{ flex:1, height:10, background:C.bg, borderRadius:5, overflow:"hidden" }}>
            <div style={{ width:`${pct}%`, height:"100%", background:C.gold, borderRadius:5, transition:"width 0.4s" }}/>
          </div>
          <span style={{ fontSize:14, fontWeight:800, color:C.gold, minWidth:40 }}>{pct}%</span>
        </div>

        <div style={{ fontSize:13, color:C.dim }}>
          {concluidas} de {etapas.length} etapas concluídas
          {proxima && <> · <span style={{ color:C.cream }}>Próxima: {proxima.titulo}</span></>}
        </div>
      </Card>

      {/* Dica de importação */}
      <Card style={{ padding:"14px 20px", background:C.surf2, border:`1px solid ${C.gold}44`, display:"flex", gap:14, alignItems:"flex-start" }}>
        <span style={{ fontSize:24, flexShrink:0 }}>💡</span>
        <div>
          <div style={{ fontWeight:700, color:C.gold, marginBottom:4, fontSize:14 }}>Dica: Use a importação por planilha!</div>
          <div style={{ fontSize:13, color:C.dim, lineHeight:1.5 }}>
            Em cada cadastro, clique em <strong style={{color:C.cream}}>📥 Exportar</strong> para baixar uma planilha modelo.
            Preencha no Excel e clique em <strong style={{color:C.cream}}>📤 Importar</strong> para cadastrar tudo de uma vez — muito mais rápido do que cadastrar um por um!
          </div>
        </div>
      </Card>

      {/* Lista de etapas */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {etapas.map((etapa, i) => {
          const anterior = i > 0 ? etapas[i-1] : null;
          const bloqueado = anterior && !anterior.concluido;

          return (
            <div key={etapa.numero}
              onClick={() => !bloqueado && onNavegar(etapa.menu)}
              style={{
                background: etapa.concluido ? C.surf2 : C.surface,
                border: `1px solid ${etapa.concluido ? C.win+"55" : bloqueado ? C.border : C.gold+"44"}`,
                borderRadius: 12,
                padding: "16px 20px",
                cursor: bloqueado ? "not-allowed" : "pointer",
                opacity: bloqueado ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: 16,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!bloqueado) e.currentTarget.style.background = C.surf2; }}
              onMouseLeave={e => { e.currentTarget.style.background = etapa.concluido ? C.surf2 : C.surface; }}
            >
              {/* Número/check */}
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: etapa.concluido ? C.win+"33" : bloqueado ? C.surf2 : C.gold+"22",
                border: `2px solid ${etapa.concluido ? C.win : bloqueado ? C.border : C.gold}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: etapa.concluido ? 20 : 18,
              }}>
                {etapa.concluido ? "✅" : bloqueado ? "🔒" : etapa.icone}
              </div>

              {/* Conteúdo */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: etapa.concluido ? C.win : C.cream }}>
                    {etapa.numero}. {etapa.titulo}
                  </span>
                  {etapa.concluido && (
                    <span style={{ fontSize: 11, color: C.win, background: C.win+"22", border:`1px solid ${C.win}44`, borderRadius:4, padding:"1px 6px", fontWeight:700 }}>
                      CONCLUÍDO
                    </span>
                  )}
                  {!etapa.concluido && !bloqueado && proxima?.numero === etapa.numero && (
                    <span style={{ fontSize: 11, color: C.gold, background: C.gold+"22", border:`1px solid ${C.gold}44`, borderRadius:4, padding:"1px 6px", fontWeight:700 }}>
                      PRÓXIMO
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: C.dim, marginBottom: 3 }}>{etapa.descricao}</div>
                <div style={{ fontSize: 11, color: C.dim, fontStyle: "italic" }}>{etapa.exemplo}</div>
                {!etapa.concluido && !bloqueado && (
                  <div style={{ fontSize: 11, color: C.gold, marginTop: 4 }}>ℹ️ {etapa.dica}</div>
                )}
              </div>

              {/* Seta */}
              {!bloqueado && (
                <span style={{ color: etapa.concluido ? C.win : C.gold, fontSize: 20, flexShrink: 0 }}>›</span>
              )}
            </div>
          );
        })}
      </div>

      {pct === 100 && (
        <Card style={{ padding:"20px 24px", textAlign:"center", background:C.win+"11", border:`1px solid ${C.win}44` }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
          <div style={{ fontWeight:800, fontSize:18, color:C.win, marginBottom:6 }}>Sistema configurado!</div>
          <div style={{ fontSize:13, color:C.dim }}>
            Agora vá em <strong style={{color:C.cream}}>Partidas</strong> para registrar os resultados dos jogos e acompanhar as estatísticas em tempo real.
          </div>
        </Card>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// CONTROLE DE MENSALIDADES
// ══════════════════════════════════════════════════════════════

const MESES_LABEL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const STATUS_CFG = {
  pago:      { label:"Pago",       cor: C.win,  icon:"✅" },
  parcial:   { label:"Parcial",    cor: C.gold, icon:"⚠️" },
  nao_pago:  { label:"Não Pago",   cor: C.loss, icon:"❌" },
  isento:    { label:"Isento",     cor: C.dim,  icon:"🔵" },
};

function fmtMoeda(v) {
  return v != null ? `R$ ${Number(v).toFixed(2).replace(".",",")}` : "—";
}

function CrudMensalidades({ show }) {
  const hoje = new Date();
  const [mesSel, setMesSel]   = useState(hoje.getMonth() + 1);
  const [anoSel, setAnoSel]   = useState(hoje.getFullYear());
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [modalJog, setModalJog] = useState(null);
  const [formPag, setFormPag]   = useState({});
  const [saving, setSaving]     = useState(false);
  const [abaRel, setAbaRel]     = useState("mensal"); // mensal | inadimplentes

  const { data: times }     = useQuery(() => api.get(`time?select=id_time,nome,valor_mensalidade&limit=1`));
  const time = times?.[0];

  const { data: jogadores } = useQuery(
    () => api.get(`jogador?id_time=eq.${time?.id_time}&id_jogador=gt.0&select=id_jogador,nome,apelido,camisa,foto_url&data_fim=is.null&order=nome.asc`),
    [time?.id_time]
  );

  const { data: pagamentos, reload: reloadPag } = useQuery(
    () => api.get(`mensalidade?id_time=eq.${time?.id_time}&mes=eq.${mesSel}&ano=eq.${anoSel}&select=*`),
    [time?.id_time, mesSel, anoSel]
  );

  // Relatório — inadimplentes (2+ meses em aberto)
  const { data: todasMens } = useQuery(
    () => api.get(`mensalidade?id_time=eq.${time?.id_time}&select=*&order=ano.desc,mes.desc`),
    [time?.id_time]
  );

  // Cruzar jogadores com pagamentos do mês
  const jogadoresComStatus = (jogadores||[]).map(j => {
    const pag = (pagamentos||[]).find(p => p.id_jogador === j.id_jogador);
    return { ...j, pag: pag || null, status: pag?.status || "nao_pago" };
  });

  const filtrados = filtroStatus === "todos"
    ? jogadoresComStatus
    : jogadoresComStatus.filter(j => j.status === filtroStatus);

  // Totais do mês
  const totalEsperado = jogadoresComStatus
    .filter(j => j.status !== "isento")
    .reduce((s, j) => s + (j.pag?.valor_esperado || time?.valor_mensalidade || 0), 0);
  const totalRecebido = jogadoresComStatus
    .reduce((s, j) => s + (j.pag?.valor_pago || 0), 0);
  const totalPendente = jogadoresComStatus
    .filter(j => j.status === "nao_pago" || j.status === "parcial")
    .reduce((s, j) => s + ((j.pag?.valor_esperado || time?.valor_mensalidade || 0) - (j.pag?.valor_pago || 0)), 0);

  // Inadimplentes — 2+ meses em aberto
  const inadimplentes = (jogadores||[]).filter(j => {
    const debitos = (todasMens||[]).filter(m =>
      m.id_jogador === j.id_jogador &&
      (m.status === "nao_pago" || m.status === "parcial")
    );
    return debitos.length >= 2;
  }).map(j => {
    const debitos = (todasMens||[]).filter(m =>
      m.id_jogador === j.id_jogador &&
      (m.status === "nao_pago" || m.status === "parcial")
    );
    const totalDev = debitos.reduce((s,m) =>
      s + ((m.valor_esperado||0) - (m.valor_pago||0)), 0);
    return { ...j, debitos, totalDev };
  });

  function abrirModal(jog) {
    const valorPadrao = time?.valor_mensalidade || 0;
    setFormPag({
      id_jogador:     jog.id_jogador,
      id_time:        time?.id_time,
      mes:            mesSel,
      ano:            anoSel,
      status:         jog.pag?.status || "pago",
      valor_esperado: jog.pag?.valor_esperado ?? valorPadrao,
      valor_pago:     jog.pag?.valor_pago ?? valorPadrao,
      data_pagamento: jog.pag?.data_pagamento || new Date().toISOString().split("T")[0],
      observacoes:    jog.pag?.observacoes || "",
      _jog: jog,
    });
    setModalJog(jog);
  }

  function setFP(k, v) { setFormPag(f => ({ ...f, [k]: v })); }

  async function salvarPagamento() {
    setSaving(true);
    try {
      const body = {
        id_jogador:    formPag.id_jogador,
        id_time:       formPag.id_time,
        mes:           formPag.mes,
        ano:           formPag.ano,
        status:        formPag.status,
        valor_esperado: Number(formPag.valor_esperado) || 0,
        valor_pago:    Number(formPag.valor_pago) || 0,
        data_pagamento: formPag.data_pagamento || null,
        observacoes:   formPag.observacoes || null,
        atualizado_em: new Date().toISOString(),
      };

      const existe = modalJog.pag?.id_mensalidade;
      if (existe) {
        await api.patch(`mensalidade?id_mensalidade=eq.${existe}`, body);
      } else {
        await api.post(`mensalidade`, body);
      }
      show("Pagamento salvo!"); setModalJog(null); reloadPag();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(false); }
  }

  async function marcarPago(jog) {
    const valorPadrao = time?.valor_mensalidade || 0;
    const body = {
      id_jogador: jog.id_jogador, id_time: time?.id_time,
      mes: mesSel, ano: anoSel, status: "pago",
      valor_esperado: valorPadrao, valor_pago: valorPadrao,
      data_pagamento: new Date().toISOString().split("T")[0],
      atualizado_em: new Date().toISOString(),
    };
    try {
      if (jog.pag?.id_mensalidade) {
        await api.patch(`mensalidade?id_mensalidade=eq.${jog.pag.id_mensalidade}`, body);
      } else {
        await api.post(`mensalidade`, body);
      }
      show(`${jog.apelido||jog.nome}: Pago ✅`); reloadPag();
    } catch(e) { show("Erro: " + e.message, "error"); }
  }

  if (!time) return <Spinner/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Abas */}
      <div style={{ display:"flex", gap:8 }}>
        {[{ id:"mensal", label:"📋 Controle Mensal" }, { id:"inadimplentes", label:"🚨 Inadimplentes" }, { id:"relatorio", label:"📊 Relatório" }].map(a => (
          <button key={a.id} onClick={() => setAbaRel(a.id)}
            style={{ background: abaRel===a.id ? C.gold : C.surface, color: abaRel===a.id ? "#0B3D2E" : C.dim,
              border:`1px solid ${abaRel===a.id ? C.gold : C.border}`, borderRadius:8, padding:"8px 18px",
              fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA MENSAL ── */}
      {abaRel === "mensal" && (<>
        {/* Seletor mês/ano + cards resumo */}
        <Card style={{ padding:"16px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={() => { let m=mesSel-1, a=anoSel; if(m<1){m=12;a--;} setMesSel(m); setAnoSel(a); }}
                style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, cursor:"pointer", padding:"4px 12px", fontFamily:"inherit", fontSize:16 }}>‹</button>
              <div style={{ textAlign:"center", minWidth:160 }}>
                <div style={{ fontSize:18, fontWeight:800, color:C.cream }}>{MESES_LABEL[mesSel-1]} {anoSel}</div>
                <div style={{ fontSize:11, color:C.dim }}>Mensalidade padrão: {fmtMoeda(time?.valor_mensalidade)}</div>
              </div>
              <button onClick={() => { let m=mesSel+1, a=anoSel; if(m>12){m=1;a++;} setMesSel(m); setAnoSel(a); }}
                style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, cursor:"pointer", padding:"4px 12px", fontFamily:"inherit", fontSize:16 }}>›</button>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              {[
                { label:"Esperado", valor: fmtMoeda(totalEsperado), cor: C.cream },
                { label:"Recebido", valor: fmtMoeda(totalRecebido), cor: C.win },
                { label:"Pendente", valor: fmtMoeda(totalPendente), cor: totalPendente>0 ? C.loss : C.win },
              ].map(s => (
                <div key={s.label} style={{ textAlign:"center", background:C.surf2, borderRadius:8, padding:"10px 16px" }}>
                  <div style={{ fontSize:16, fontWeight:800, color:s.cor }}>{s.valor}</div>
                  <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Filtros de status */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["todos","Todos",C.cream], ...Object.entries(STATUS_CFG).map(([k,v])=>[k,v.label,v.cor])].map(([k,l,c]) => (
            <button key={k} onClick={() => setFiltroStatus(k)}
              style={{ background: filtroStatus===k ? c+"33" : C.surface, color: filtroStatus===k ? c : C.dim,
                border:`1px solid ${filtroStatus===k ? c : C.border}`, borderRadius:8, padding:"5px 14px",
                fontFamily:"inherit", fontWeight:700, fontSize:11, cursor:"pointer", textTransform:"uppercase" }}>
              {l} {k !== "todos" && `(${jogadoresComStatus.filter(j=>j.status===k).length})`}
            </button>
          ))}
        </div>

        {/* Tabela de jogadores */}
        <Card style={{ padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr style={{ background:C.surf2 }}>
              {["#","Jogador","Status","Esperado","Pago","Saldo","Ações"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtrados.map((j, i) => {
                const cfg = STATUS_CFG[j.status] || STATUS_CFG.nao_pago;
                const esperado = j.pag?.valor_esperado ?? (time?.valor_mensalidade||0);
                const pago     = j.pag?.valor_pago || 0;
                const saldo    = esperado - pago;
                return (
                  <tr key={j.id_jogador} style={{ background:i%2===0?C.surface:C.bg, transition:"background 0.1s" }}>
                    <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{j.camisa||"—"}</td>
                    <td style={{ padding:"11px 14px", fontWeight:700 }}>
                      {j.apelido ? <>{j.apelido} <span style={{ color:C.dim, fontWeight:400, fontSize:11 }}>({j.nome})</span></> : j.nome}
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ background:cfg.cor+"22", color:cfg.cor, border:`1px solid ${cfg.cor}44`, borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td style={{ padding:"11px 14px", color:C.dim }}>{j.status==="isento" ? "—" : fmtMoeda(esperado)}</td>
                    <td style={{ padding:"11px 14px", color:C.win, fontWeight:700 }}>{pago>0 ? fmtMoeda(pago) : "—"}</td>
                    <td style={{ padding:"11px 14px", color: saldo>0 ? C.loss : C.win, fontWeight:700 }}>
                      {j.status==="isento" ? "—" : saldo>0 ? `-${fmtMoeda(saldo)}` : "✓"}
                    </td>
                    <td style={{ padding:"11px 14px", display:"flex", gap:6 }}>
                      {j.status !== "pago" && j.status !== "isento" && (
                        <Btn style={{ fontSize:11, padding:"4px 10px", background:C.win, color:"white" }}
                          onClick={() => marcarPago(j)}>✅ Pago</Btn>
                      )}
                      <Btn variant="secondary" style={{ fontSize:11, padding:"4px 10px" }}
                        onClick={() => abrirModal(j)}>Detalhes</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </>)}

      {/* ── ABA INADIMPLENTES ── */}
      {abaRel === "inadimplentes" && (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.cream }}>🚨 Inadimplentes — 2 ou mais meses em aberto</div>
            <span style={{ background:C.loss+"22", color:C.loss, border:`1px solid ${C.loss}44`, borderRadius:8, padding:"4px 14px", fontSize:13, fontWeight:800 }}>
              {inadimplentes.length} jogador(es)
            </span>
          </div>
          {inadimplentes.length === 0 ? (
            <div style={{ padding:32, textAlign:"center", color:C.win, fontSize:15, fontWeight:700 }}>
              🎉 Nenhum inadimplente! Todos em dia.
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:C.surf2 }}>
                {["Jogador","Meses em Aberto","Débito Total","Detalhes"].map(h => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {inadimplentes.map((j,i) => (
                  <tr key={j.id_jogador} style={{ background:i%2===0?C.surface:C.bg }}>
                    <td style={{ padding:"12px 14px", fontWeight:700, color:C.cream }}>
                      {j.apelido||j.nome}
                    </td>
                    <td style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {j.debitos.map(d => (
                          <span key={d.id_mensalidade} style={{ background:C.loss+"22", color:C.loss, border:`1px solid ${C.loss}44`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                            {MESES_LABEL[d.mes-1].slice(0,3)}/{d.ano}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding:"12px 14px", color:C.loss, fontWeight:800, fontSize:15 }}>
                      {fmtMoeda(j.totalDev)}
                    </td>
                    <td style={{ padding:"12px 14px" }}>
                      <span style={{ fontSize:11, color:C.dim }}>{j.debitos.length} mês(es)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ── ABA RELATÓRIO ── */}
      {abaRel === "relatorio" && (
        <Card style={{ padding:20 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.cream, marginBottom:16 }}>📊 Relatório por Mês — {anoSel}</div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={() => setAnoSel(a=>a-1)}
              style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, cursor:"pointer", padding:"4px 12px", fontFamily:"inherit", fontSize:16 }}>‹</button>
            <div style={{ fontSize:16, fontWeight:800, color:C.cream, minWidth:80, textAlign:"center" }}>{anoSel}</div>
            <button onClick={() => setAnoSel(a=>a+1)}
              style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, cursor:"pointer", padding:"4px 12px", fontFamily:"inherit", fontSize:16 }}>›</button>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr style={{ background:C.surf2 }}>
              {["Mês","Pagos","Parciais","Não Pagos","Isentos","Arrecadado","Pendente"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {MESES_LABEL.map((mes, idx) => {
                const m = idx + 1;
                const mens = (todasMens||[]).filter(p => p.mes===m && p.ano===anoSel);
                const pagos    = mens.filter(p=>p.status==="pago").length;
                const parciais = mens.filter(p=>p.status==="parcial").length;
                const nao_pagos= mens.filter(p=>p.status==="nao_pago").length;
                const isentos  = mens.filter(p=>p.status==="isento").length;
                const arrec    = mens.reduce((s,p)=>s+(p.valor_pago||0), 0);
                const pend     = mens.reduce((s,p)=>s+((p.valor_esperado||0)-(p.valor_pago||0)), 0);
                const ehAtual  = m===mesSel && anoSel===hoje.getFullYear();
                return (
                  <tr key={m} style={{ background: ehAtual ? C.gold+"11" : idx%2===0?C.surface:C.bg,
                    cursor:"pointer" }} onClick={() => { setMesSel(m); setAbaRel("mensal"); }}>
                    <td style={{ padding:"11px 14px", fontWeight: ehAtual ? 800 : 400, color: ehAtual ? C.gold : C.cream }}>
                      {mes} {ehAtual && "← atual"}
                    </td>
                    <td style={{ padding:"11px 14px", color:C.win, fontWeight:700 }}>{pagos}</td>
                    <td style={{ padding:"11px 14px", color:C.gold }}>{parciais}</td>
                    <td style={{ padding:"11px 14px", color:C.loss }}>{nao_pagos}</td>
                    <td style={{ padding:"11px 14px", color:C.dim }}>{isentos}</td>
                    <td style={{ padding:"11px 14px", color:C.win, fontWeight:700 }}>{arrec>0?fmtMoeda(arrec):"—"}</td>
                    <td style={{ padding:"11px 14px", color:pend>0?C.loss:C.dim }}>{pend>0?fmtMoeda(pend):"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize:11, color:C.dim, marginTop:8, fontStyle:"italic" }}>
            Clique em um mês para abrir o controle detalhado daquele mês.
          </div>
        </Card>
      )}

      {/* Modal de detalhes/edição */}
      {modalJog && (
        <Modal title={`Mensalidade — ${modalJog.apelido||modalJog.nome} — ${MESES_LABEL[mesSel-1]} ${anoSel}`}
          onClose={() => setModalJog(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Status */}
            <div>
              <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase", marginBottom:8 }}>Status</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {Object.entries(STATUS_CFG).map(([k,v]) => (
                  <button key={k} onClick={() => {
                    setFP("status", k);
                    if (k === "pago") setFP("valor_pago", formPag.valor_esperado);
                    if (k === "isento") { setFP("valor_esperado", 0); setFP("valor_pago", 0); }
                    if (k === "nao_pago") setFP("valor_pago", 0);
                  }}
                    style={{ background: formPag.status===k ? v.cor+"33" : C.surface,
                      color: formPag.status===k ? v.cor : C.dim,
                      border:`2px solid ${formPag.status===k ? v.cor : C.border}`,
                      borderRadius:8, padding:"8px 16px", fontFamily:"inherit", fontWeight:700,
                      fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Valores */}
            {formPag.status !== "isento" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Input label="Valor Esperado (R$)" type="number" min="0" step="0.01"
                  value={formPag.valor_esperado||""} onChange={e => setFP("valor_esperado", e.target.value)}/>
                <Input label={formPag.status==="parcial" ? "Valor Pago (R$) — parcial" : "Valor Pago (R$)"}
                  type="number" min="0" step="0.01"
                  value={formPag.valor_pago||""} onChange={e => setFP("valor_pago", e.target.value)}/>
              </div>
            )}
            {formPag.status !== "isento" && formPag.status !== "nao_pago" && (
              <Input label="Data do Pagamento" type="date"
                value={formPag.data_pagamento||""} onChange={e => setFP("data_pagamento", e.target.value)}/>
            )}
            <Input label="Observações" value={formPag.observacoes||""}
              onChange={e => setFP("observacoes", e.target.value)}/>
            {/* Saldo */}
            {formPag.status !== "isento" && (
              <div style={{ background: C.surf2, borderRadius:8, padding:"12px 16px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:C.dim }}>Saldo devedor:</span>
                <span style={{ fontWeight:800, fontSize:15, color:
                  (formPag.valor_esperado||0)-(formPag.valor_pago||0) > 0 ? C.loss : C.win }}>
                  {fmtMoeda((formPag.valor_esperado||0)-(formPag.valor_pago||0))}
                </span>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:4 }}>
              <Btn variant="secondary" onClick={() => setModalJog(null)}>Cancelar</Btn>
              <Btn onClick={salvarPagamento} disabled={saving}>{saving?"Salvando...":"Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AdminAppCompleto() {
  const [session, setSession]       = useState(SESSION_TOKEN ? {access_token: SESSION_TOKEN} : null);
  const [idTime, setIdTime]         = useState(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [menu, setMenu]             = useState("inicio");
  const [partida, setPartida]   = useState(null);
  const [novaPartida, setNovaPartida] = useState(false);
  const { toast, show }         = useToast();

  // Buscar time do usuário logado
  useEffect(() => {
    if (!session) return;
    api.get(`usuario_time?user_id=eq.${session.user?.id || ''}&select=*,time(*)`)
      .then(data => {
        if (data?.length) {
          const ut = data[0];
          if (ut.role === 'superadmin') {
            setIsSuperadmin(true);
            setIdTime(null); // superadmin vê tudo
          } else {
            setIdTime(ut.id_time);
          }
        }
      }).catch(() => {});
  }, [session]);

  const { data: times }      = useQuery(() => 
    idTime ? api.get(`time?id_time=eq.${idTime}&select=*&limit=1`) : api.get(`time?select=*&limit=1`),
    [session, idTime]
  );
  const { data: temporadas } = useQuery(() => 
    idTime ? api.get(`temporada?id_time=eq.${idTime}&select=*&order=data_inicio.desc`) : api.get(`temporada?select=*&order=data_inicio.desc`),
    [session, idTime]
  );
  // Dados para onboarding
  const { data: _cidades }    = useQuery(() => api.get(`cidade?select=id_cidade&limit=1`), [session]);
  const { data: _campos }     = useQuery(() => api.get(`campo?select=id_campo&limit=1`), [session]);
  const { data: _posicoes }   = useQuery(() => api.get(`posicao?select=id_posicao&limit=1`), [session]);
  const { data: _adversarios } = useQuery(() => idTime ? api.get(`adversario?id_time=eq.${idTime}&select=id_adversario&limit=1`) : api.get(`adversario?select=id_adversario&limit=1`), [session, idTime]);
  const { data: _jogadores }  = useQuery(() => idTime ? api.get(`jogador?id_time=eq.${idTime}&id_jogador=gt.0&select=id_jogador&limit=1`) : api.get(`jogador?id_jogador=gt.0&select=id_jogador&limit=1`), [session, idTime]);
  const { data: _partidas }   = useQuery(() => api.get(`partida?select=id_partida&limit=1`), [session]);
  const [temporadaSel, setTemporadaSel] = useState(null);
  useEffect(() => { if (temporadas?.length && !temporadaSel) setTemporadaSel(temporadas[0]); }, [temporadas]);

  if (!session) return <Login onLogin={setSession} />;

  const time = times?.[0];

  function navMenu(id) { setMenu(id); setPartida(null); setNovaPartida(false); }

  const secTitle = (label) => (
    <div style={{ fontSize:18, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:4, height:24, background:C.gold, borderRadius:2 }}/>
      {label}
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif", color:C.cream, display:"flex", flexDirection:"column" }}>
      <Toast {...(toast||{msg:null})} />

      {/* Header */}
      <header style={{ background:"#091F15", borderBottom:`3px solid ${C.gold}`, padding:"0 24px", display:"flex", alignItems:"center", gap:16, height:64, position:"sticky", top:0, zIndex:100, boxShadow:"0 4px 20px #00000066" }}>
        <img src="/logo.png" alt="Nerd do Campo" style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}` }}/>
        <div style={{ fontSize:18, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:C.cream }}>Nerd do Campo</div>
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", background:C.gold+"22", border:`1px solid ${C.gold}44`, borderRadius:6, padding:"2px 8px" }}>Admin</div>
        {process.env.REACT_APP_ENV === "development" && (
          <div style={{ fontSize:10, color:"#ff6b6b", textTransform:"uppercase", letterSpacing:"0.1em", background:"#ff6b6b22", border:"1px solid #ff6b6b44", borderRadius:6, padding:"2px 8px", fontWeight:700 }}>
            🧪 DEV
          </div>
        )}
        <div style={{ fontSize:10, color:C.dim, letterSpacing:"0.05em" }}>
          v{APP_VERSION}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          {time?.escudo_url
            ? <img src={time.escudo_url} alt={time.nome} style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}` }}/>
            : null
          }
          <span style={{ fontSize:12, color:C.dim }}>{time?.nome || ""}</span>
          {(temporadas||[]).length > 1 && (
            <select value={temporadaSel?.id_temporada||""} onChange={e => setTemporadaSel(temporadas.find(t=>t.id_temporada===Number(e.target.value)))}
              style={{ background:C.surf2, color:C.cream, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", fontFamily:"inherit", fontSize:12 }}>
              {(temporadas||[]).map(t=><option key={t.id_temporada} value={t.id_temporada}>{t.nome}</option>)}
            </select>
          )}
          <Btn variant="danger" style={{ fontSize:11, padding:"6px 12px" }} onClick={() => { SESSION_TOKEN=null; sessionStorage.removeItem("ndc_token"); setSession(null); }}>Sair</Btn>
        </div>
      </header>

      <div style={{ display:"flex", flex:1 }}>
        {/* Sidebar */}
        <aside style={{ width:210, background:"#091F15", borderRight:`1px solid ${C.border}`, padding:"16px 0", flexShrink:0, position:"sticky", top:64, height:"calc(100vh - 64px)", overflowY:"auto" }}>
          {/* Itens sem grupo: Início e Visão App */}
          {MENU.filter(m => m.grupo === "").map(m => (
            <button key={m.id} onClick={() => navMenu(m.id)} style={{
              display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 20px",
              background: menu===m.id ? C.gold+"22" : "transparent",
              borderLeft: menu===m.id ? `3px solid ${C.gold}` : "3px solid transparent",
              border:"none", borderRight:"none", color: menu===m.id ? C.gold : C.cream,
              fontFamily:"inherit", fontWeight:700, fontSize:12, textTransform:"uppercase",
              letterSpacing:"0.06em", cursor:"pointer", textAlign:"left", transition:"all 0.15s",
            }}>
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
          <div style={{ height:1, background:C.border, margin:"8px 0" }}/>
          {["Jogos","Cadastros","Configurações","Financeiro"].map(grupo => {
            const itens = MENU.filter(m => m.grupo === grupo);
            return (
              <div key={grupo}>
                <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:700, padding:"12px 20px 6px" }}>{grupo}</div>
                {itens.map(m => (
                  <button key={m.id} onClick={() => navMenu(m.id)} style={{
                    display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 20px",
                    background: menu===m.id ? C.gold+"22" : "transparent",
                    borderLeft: menu===m.id ? `3px solid ${C.gold}` : "3px solid transparent",
                    border:"none", borderRight:"none", color: menu===m.id ? C.gold : C.dim,
                    fontFamily:"inherit", fontWeight:700, fontSize:12, textTransform:"uppercase",
                    letterSpacing:"0.06em", cursor:"pointer", textAlign:"left", transition:"all 0.15s",
                  }}>
                    <span>{m.icon}</span><span>{m.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        {/* Conteúdo */}
        <main style={{ flex:1, padding:"28px 28px", minWidth:0 }}>
          {menu === "inicio" && (
            <PaginaInicio
              dados={{ cidades:_cidades, campos:_campos, posicoes:_posicoes, adversarios:_adversarios, jogadores:_jogadores, temporadas, partidas:_partidas }}
              onNavegar={setMenu}
            />
          )}
          {menu === "app" && (
            <VisaoAppPublico time={(times||[])[0]} temporadas={temporadas}/>
          )}
          {menu === "partidas" && !partida && !novaPartida && temporadaSel && (<>
            {secTitle(`Partidas — ${temporadaSel.nome}`)}
            <ListaPartidasWrapper temporada={temporadaSel} onSelect={p=>{setPartida(p);}} onNova={()=>setNovaPartida(true)} show={show} />
          </>)}

          {menu === "partidas" && novaPartida && temporadaSel && (<>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              {secTitle("Nova Partida")}
              <Btn variant="secondary" style={{ fontSize:11, padding:"6px 12px", marginTop:-20 }} onClick={()=>setNovaPartida(false)}>← Voltar</Btn>
            </div>
            <Card style={{ padding:24 }}>
              <FormNovaPartida temporada={temporadaSel} onSalvo={()=>setNovaPartida(false)} onCancelar={()=>setNovaPartida(false)} />
            </Card>
          </>)}

          {menu === "partidas" && partida && !novaPartida && (<>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              {secTitle("Ficha da Partida")}
              <Btn variant="secondary" style={{ fontSize:11, padding:"6px 12px", marginTop:-20 }} onClick={()=>setPartida(null)}>← Voltar</Btn>
            </div>
            <FichaPartida partida={partida} onVoltar={()=>setPartida(null)} />
          </>)}

          {menu === "jogadores"   && (<>{secTitle("Jogadores")}<CrudJogadores show={show} /></>)}
          {menu === "adversarios" && (<>{secTitle("Adversários")}<CrudAdversarios show={show} /></>)}
          {menu === "campos"      && (<>{secTitle("Campos")}<CrudCampos show={show} /></>)}
          {menu === "cidades"     && (<>{secTitle("Cidades")}<CrudCidades show={show} /></>)}
          {menu === "posicoes"    && (<>{secTitle("Posições")}<CrudPosicoes show={show} /></>)}
          {menu === "temporadas"  && (<>{secTitle("Temporadas")}<CrudTemporadas show={show} /></>)}
          {menu === "mensalidades" && (<CrudMensalidades show={show}/>)}
          {menu === "time"        && (<>{secTitle("Configurações do Time")}<ConfigTime show={show} /></>)}
        </main>
      </div>
    </div>
  );
}


// ── CRUD JOGADORES ────────────────────────────────────────────

function TabelaJogadores({ grupo, lista, sk, asc, onSort, onEditar, onInativar, onReativar }) {
  if (!lista.length) return null;
  const S = k => <ThSortable colKey={k} sortKey={sk} asc={asc} onSort={onSort}/>;
  return (
    <div>
      <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>{grupo} ({lista.length})</div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:C.surf2 }}>
            <ThSortable colKey="camisa"      sortKey={sk} asc={asc} onSort={onSort}>#</ThSortable>
            <ThSortable colKey="nome"        sortKey={sk} asc={asc} onSort={onSort}>Nome</ThSortable>
            <ThSortable colKey="apelido"     sortKey={sk} asc={asc} onSort={onSort}>Apelido</ThSortable>
            <ThSortable colKey="posicao.nome" sortKey={sk} asc={asc} onSort={onSort}>Posição</ThSortable>
            <ThSortable colKey="telefone"    sortKey={sk} asc={asc} onSort={onSort}>Telefone</ThSortable>
            <ThSortable colKey="email"       sortKey={sk} asc={asc} onSort={onSort}>E-mail</ThSortable>
            <ThSortable colKey="data_inicio" sortKey={sk} asc={asc} onSort={onSort}>Início</ThSortable>
            <ThSortable colKey="data_fim"    sortKey={sk} asc={asc} onSort={onSort}>Saída</ThSortable>
            <ThSortable sortKey={sk} asc={asc} onSort={()=>{}}>Obs.</ThSortable>
            <ThSortable sortKey={sk} asc={asc} onSort={()=>{}}></ThSortable>
          </tr></thead>
          <tbody>
            {lista.map((j,i) => (
              <tr key={j.id_jogador} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:800, color:C.gold, whiteSpace:"nowrap" }}>{j.camisa}</td>
                <td style={{ padding:"11px 14px", fontWeight:700, whiteSpace:"nowrap" }}>{j.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{j.apelido || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{j.posicao?.nome || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{j.telefone || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{j.email || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{j.data_inicio ? new Date(j.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{j.data_fim ? new Date(j.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={j.observacoes||""}>{j.observacoes || "—"}</td>
                <td style={{ padding:"11px 14px", whiteSpace:"nowrap" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => onEditar(j)}>Editar</Btn>
                    {!j.data_fim && <Btn variant="danger" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => onInativar(j)}>Inativar</Btn>}
                    {j.data_fim && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px", color:C.win, borderColor:C.win }} onClick={() => onReativar(j)}>Reativar</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}


function CrudJogadores({ show }) {
  const { data: _utj } = useQuery(() => api.get(`usuario_time?select=id_time&limit=1`));
  const _idTimeJ = _utj?.[0]?.id_time;
  const { data: jogadores, loading, reload } = useQuery(() => 
    _idTimeJ ? api.get(`jogador?id_jogador=gt.0&id_time=eq.${_idTimeJ}&select=*,posicao(nome)&order=camisa.asc`) : api.get(`jogador?id_jogador=gt.0&select=*,posicao(nome)&order=camisa.asc`),
    [_idTimeJ]
  );
  const { data: posicoes } = useQuery(() => api.get(`posicao?id_posicao_pai=not.is.null&select=*&order=nome.asc`));
  const posicoesLista = posicoes || [];
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() { setForm({ nome:"", apelido:"", camisa:"", id_posicao:"", telefone:"", email:"", data_inicio:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(j) { setForm({ ...j, id_posicao: j.id_posicao ? String(j.id_posicao) : "" }); setModal(j); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const utData = await api.get(`usuario_time?select=id_time&limit=1`);
      const body = { nome: form.nome, apelido: form.apelido||null, camisa: form.camisa||null, id_posicao: form.id_posicao ? Number(form.id_posicao) : null, telefone: form.telefone||null, email: form.email||null, data_inicio: form.data_inicio||null, observacoes: form.observacoes||null, foto_url: form.foto_url||null, id_time: utData?.[0]?.id_time||null };
      if (modal === "novo") await api.post("jogador", body);
      else await api.patch(`jogador?id_jogador=eq.${form.id_jogador}`, body);
      show(modal === "novo" ? "Jogador criado!" : "Jogador atualizado!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);
  const [_sk, _setSk] = useState("camisa");
  const [_asc, _setAsc] = useState(true);

  async function confirmarImport() {
    setSaving(true);
    try {
      const utData = await api.get(`usuario_time?select=id_time&limit=1`);
      const id_time_val = utData?.[0]?.id_time || null;
      for (const row of resultadoImport._dados) {
        const pos = (_idTimeJ ? posicoes : posicoes||[]).find ? 
          (posicoes||[]).find(p => p.nome.toUpperCase() === String(row.posicao||"").trim().toUpperCase()) : null;
        const body = {
          nome: String(row.nome||"").trim(),
          apelido: row.apelido||null,
          camisa: row.camisa ? String(row.camisa) : null,
          id_posicao: pos?.id_posicao || null,
          telefone: row.telefone||null,
          email: row.email||null,
          data_inicio: row.data_inicio||null,
          data_fim: row.data_fim||null,
          observacoes: row.observacoes||null,
          id_time: id_time_val,
        };
        if (row.id_jogador) await api.patch(`jogador?id_jogador=eq.${row.id_jogador}`, body);
        else await api.post("jogador", body);
      }
      show(`${resultadoImport._dados.length} jogador(es) importado(s)!`); setResultadoImport(null); reload();
    } catch(e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  async function inativar(j) {
    if (!confirm(`Inativar ${j.apelido || j.nome}?`)) return;
    try { await api.patch(`jogador?id_jogador=eq.${j.id_jogador}`, { data_fim: new Date().toISOString().split("T")[0] }); show("Jogador inativado."); reload(); }
    catch (e) { show(e.message, "error"); }
  }

  async function reativar(j) {
    if (!confirm(`Reativar ${j.apelido || j.nome}?`)) return;
    try { await api.patch(`jogador?id_jogador=eq.${j.id_jogador}`, { data_fim: null }); show("Jogador reativado!"); reload(); }
    catch (e) { show(e.message, "error"); }
  }

  if (loading) return <Spinner />;
  const ativos   = (jogadores||[]).filter(j => !j.data_fim);
  const inativos = (jogadores||[]).filter(j =>  j.data_fim);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <BotoesImportExport
          onExportar={() => exportarExcel(
            (jogadores||[]).filter(j=>!j.data_fim).map(j => ({...j, posicao_nome: j.posicao?.nome||""})),
            [
              { key:"id_jogador",    label:"id",          width:8,  descricao:"NÃO altere. Vazio = novo." },
              { key:"nome",          label:"nome",        width:25, descricao:"Nome completo. OBRIGATÓRIO." },
              { key:"apelido",       label:"apelido",     width:20, descricao:"Apelido/nome de guerra." },
              { key:"camisa",        label:"camisa",      width:8,  descricao:"Número da camisa." },
              { key:"posicao_nome",  label:"posicao",     width:20, descricao:"Nome exato da posição cadastrada." },
              { key:"telefone",      label:"telefone",    width:18, descricao:"Telefone do jogador." },
              { key:"email",         label:"email",       width:30, descricao:"E-mail do jogador." },
              { key:"data_inicio",   label:"data_inicio", width:14, descricao:"Data de entrada no time (AAAA-MM-DD)." },
              { key:"data_fim",      label:"data_fim",    width:14, descricao:"Data de saída do time (AAAA-MM-DD). Preencher para inativar." },
              { key:"observacoes",   label:"observacoes", width:40, descricao:"Observações sobre o jogador." },
            ],
            "jogadores",
            ["- id preenchido = atualiza", "- id vazio = cria novo", "- Posição deve estar cadastrada no sistema"]
          )}
          onImportar={async (file) => {
            setLoadingImport("jogadores");
            try {
              const rows = await lerExcel(file);
              const erros = []; const validos = [];
              const camisasVistas = new Set((jogadores||[]).filter(j=>!j.data_fim).map(j=>j.camisa));
              rows.forEach((row, i) => {
                const linha = i + 2;
                const nome = String(row["nome"]||"").trim();
                if (!nome) { erros.push({ linha, mensagem: "Campo 'nome' é obrigatório." }); return; }
                const posNome = String(row["posicao"]||"").trim();
                if (posNome && !posicoesLista.find(p => p.nome.toUpperCase() === posNome.toUpperCase()))
                  erros.push({ linha, mensagem: `Posição '${posNome}' não encontrada.` });
                const camisa = row["camisa"] ? String(row["camisa"]).trim() : null;
                if (camisa && !row["id_jogador"] && camisasVistas.has(camisa))
                  erros.push({ linha, mensagem: `Camisa '${camisa}' já está em uso por outro jogador.` });
                if (camisa && !row["id_jogador"]) camisasVistas.add(camisa);
                if (!erros.find(e => e.linha === linha)) validos.push(row);
              });
              setResultadoImport({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r.id_jogador).length} atualizações + ${validos.filter(r=>!r.id_jogador).length} novos.`, _dados: validos });
            } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
          }}
          loadingImport={loadingImport==="jogadores"}
        />
        <Btn onClick={abrirNovo}>+ Novo Jogador</Btn>
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      {ativos.length > 0 && (
        <TabelaJogadores grupo="Ativos" lista={sortData(ativos, _sk, _asc)} sk={_sk} asc={_asc}
          onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}
          onEditar={abrirEditar} onInativar={inativar} onReativar={reativar}/>
      )}
      {inativos.length > 0 && (
        <TabelaJogadores grupo="Inativos" lista={sortData(inativos, _sk, _asc)} sk={_sk} asc={_asc}
          onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}
          onEditar={abrirEditar} onInativar={inativar} onReativar={reativar}/>
      )}
      {modal && (
        <Modal title={modal === "novo" ? "Novo Jogador" : "Editar Jogador"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <ImageUpload
              label="Foto do Jogador"
              value={form.foto_url||""}
              onUpload={url => set("foto_url", url)}
              bucket="jogadores"
              nomeArquivo={`jogador_${form.id_jogador||"novo_"+Date.now()}`}
            />
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
              <Input label="Apelido" value={form.apelido||""} onChange={e => set("apelido", e.target.value)} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Camisa" value={form.camisa||""} onChange={e => set("camisa", e.target.value)} />
              <Select label="Posição" value={form.id_posicao||""} onChange={e => set("id_posicao", e.target.value)}>
                <option value="">Selecione...</option>
                {(posicoes||[]).map(p => <option key={p.id_posicao} value={p.id_posicao}>{p.nome}</option>)}
              </Select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Telefone" value={form.telefone||""} onChange={e => set("telefone", e.target.value)} />
              <Input label="E-mail" type="email" value={form.email||""} onChange={e => set("email", e.target.value)} />
            </div>
            <Input label="Data de Início" type="date" value={form.data_inicio||""} onChange={e => set("data_inicio", e.target.value)} />
            <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD ADVERSÁRIOS ──────────────────────────────────────────
function CrudAdversarios({ show }) {
  const { data: _uta } = useQuery(() => api.get(`usuario_time?select=id_time&limit=1`));
  const _idTimeA = _uta?.[0]?.id_time;
  const { data: adversarios, loading, reload } = useQuery(() => 
    _idTimeA ? api.get(`adversario?id_time=eq.${_idTimeA}&select=*,campo(nome),cidade(nome,estado)&order=nome.asc`) : api.get(`adversario?select=*,campo(nome),cidade(nome,estado)&order=nome.asc`),
    [_idTimeA]
  );
  const [_sk, _setSk] = useState("nome"); const [_asc, _setAsc] = useState(true);
  const { data: campos }  = useQuery(() => api.get(`campo?select=*&order=nome.asc`));
  const { data: cidades } = useQuery(() => api.get(`cidade?select=*&order=nome.asc`));
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function confirmarImport() {
    setSaving(true);
    try {
      const utData = await api.get(`usuario_time?select=id_time&limit=1`);
      const id_time_val = utData?.[0]?.id_time || null;
      for (const row of resultadoImport._dados) {
        const campo = (campos||[]).find(c => c.nome.toUpperCase() === String(row.campo||"").trim().toUpperCase());
        const body = { nome: String(row.nome||"").trim(), id_campo: campo?.id_campo||null, contato: row.contato||null, observacoes: row.observacoes||null, id_time: id_time_val };
        if (row.id_adversario) await api.patch(`adversario?id_adversario=eq.${row.id_adversario}`, body);
        else await api.post("adversario", body);
      }
      show(`${resultadoImport._dados.length} registro(s) importado(s)!`); setResultadoImport(null); reload();
    } catch(e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  function abrirNovo() { setForm({ nome:"", id_campo:"", id_cidade:"", contato:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(a) { setForm({ ...a, id_campo: a.id_campo?String(a.id_campo):"", id_cidade: a.id_cidade?String(a.id_cidade):"" }); setModal(a); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const utDataA = await api.get(`usuario_time?select=id_time&limit=1`);
      const body = { nome: form.nome, id_campo: form.id_campo?Number(form.id_campo):null, id_cidade: form.id_cidade?Number(form.id_cidade):null, contato: form.contato||null, observacoes: form.observacoes||null, id_time: utDataA?.[0]?.id_time||null };
      if (modal === "novo") await api.post("adversario", body);
      else await api.patch(`adversario?id_adversario=eq.${form.id_adversario}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <BotoesImportExport
          onExportar={() => exportarExcel(
            (adversarios||[]).filter(a=>!a.data_fim).map(a => ({...a, campo: a.campo?.nome||""})),
            [
              { key:"id_adversario", label:"id",          width:8,  descricao:"NÃO altere. Vazio = novo." },
              { key:"nome",          label:"nome",        width:30, descricao:"Nome do adversário. OBRIGATÓRIO." },
              { key:"campo",         label:"campo",       width:30, descricao:"Nome exato do campo cadastrado." },
              { key:"contato",       label:"contato",     width:25, descricao:"Telefone ou nome do contato." },
              { key:"observacoes",   label:"observacoes", width:40, descricao:"Observações sobre o adversário." },
            ],
            "adversarios",
            ["- id preenchido = atualiza", "- id vazio = cria novo", "- Campo deve estar cadastrado"]
          )}
          onImportar={async (file) => {
            setLoadingImport("adversarios");
            try {
              const rows = await lerExcel(file);
              const erros = []; const validos = [];
              rows.forEach((row, i) => {
                const linha = i + 2;
                const nome = String(row["nome"]||"").trim();
                if (!nome) { erros.push({ linha, mensagem: "Campo 'nome' é obrigatório." }); return; }
                const campoNome = String(row["campo"]||"").trim();
                if (campoNome && !(campos||[]).find(c => c.nome.toUpperCase() === campoNome.toUpperCase()))
                  erros.push({ linha, mensagem: `Campo '${campoNome}' não encontrado. Cadastre primeiro.` });
                if (!erros.find(e => e.linha === linha)) validos.push(row);
              });
              setResultadoImport({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r.id_adversario).length} atualizações + ${validos.filter(r=>!r.id_adversario).length} novos.`, _dados: validos });
            } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
          }}
          loadingImport={loadingImport==="adversarios"}
        />
        <Btn onClick={abrirNovo}>+ Novo Adversário</Btn>
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
                  <ThSortable colKey="nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Nome</ThSortable>
                  <ThSortable colKey="campo.nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Campo</ThSortable>
                  <ThSortable colKey="cidade.nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Cidade</ThSortable>
                  <ThSortable colKey="contato" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Contato</ThSortable>
                  <ThSortable colKey="observacoes" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Observações</ThSortable>
                  <ThSortable colKey="data_fim" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Inativo em</ThSortable>
                  <ThSortable sortKey={_sk} asc={_asc} onSort={()=>{}}></ThSortable>
          </tr></thead>
          <tbody>
            {(sortData(adversarios, _sk, _asc)||[]).map((a,i) => (
              <tr key={a.id_adversario} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700 }}>{a.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{a.campo?.nome || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{a.cidade ? `${a.cidade.nome}/${a.cidade.estado}` : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{a.contato || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={a.observacoes||""}>{a.observacoes || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{a.data_fim ? new Date(a.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px" }}><Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(a)}>Editar</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={modal === "novo" ? "Novo Adversário" : "Editar Adversário"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
            <Select label="Campo" value={form.id_campo||""} onChange={e => set("id_campo", e.target.value)}>
              <option value="">Selecione...</option>
              {(campos||[]).map(c => <option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
            </Select>
            <Select label="Cidade" value={form.id_cidade||""} onChange={e => set("id_cidade", e.target.value)}>
              <option value="">Selecione...</option>
              {(cidades||[]).map(c => <option key={c.id_cidade} value={c.id_cidade}>{c.nome}/{c.estado}</option>)}
            </Select>
            <Input label="Contato" value={form.contato||""} onChange={e => set("contato", e.target.value)} />
            <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD CAMPOS ───────────────────────────────────────────────
function CrudCampos({ show }) {
  const { data: campos, loading, reload } = useQuery(() => api.get(`campo?select=*,cidade(nome,estado)&order=nome.asc`));
  const { data: cidades } = useQuery(() => api.get(`cidade?select=*&order=nome.asc`));
  const [_sk, _setSk] = useState("nome"); const [_asc, _setAsc] = useState(true);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function confirmarImport() {
    setSaving(true);
    try {
      for (const row of resultadoImport._dados) {
        const cidade = (cidades||[]).find(c => c.nome.toUpperCase() === String(row.cidade||"").trim().toUpperCase());
        const body = { nome: String(row.nome||"").trim(), endereco: row.endereco||null, id_cidade: cidade?.id_cidade||null };
        if (row.id_campo) await api.patch(`campo?id_campo=eq.${row.id_campo}`, body);
        else await api.post("campo", body);
      }
      show(`${resultadoImport._dados.length} registro(s) importado(s)!`); setResultadoImport(null); reload();
    } catch(e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  function abrirNovo() { setForm({ nome:"", endereco:"", id_cidade:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(c) { setForm({ ...c, id_cidade: c.id_cidade?String(c.id_cidade):"" }); setModal(c); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, endereco: form.endereco||null, id_cidade: form.id_cidade?Number(form.id_cidade):null, observacoes: form.observacoes||null };
      if (modal === "novo") await api.post("campo", body);
      else await api.patch(`campo?id_campo=eq.${form.id_campo}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <BotoesImportExport
          onExportar={() => exportarExcel(
            (campos||[]).map(c => ({...c, cidade: c.cidade ? `${c.cidade.nome}` : ""})),
            [
              { key:"id_campo",  label:"id",       width:8,  descricao:"NÃO altere. Vazio = novo registro." },
              { key:"nome",      label:"nome",     width:30, descricao:"Nome do campo. OBRIGATÓRIO." },
              { key:"endereco",  label:"endereco", width:40, descricao:"Endereço do campo." },
              { key:"cidade",    label:"cidade",   width:25, descricao:"Nome exato da cidade cadastrada no sistema." },
            ],
            "campos",
            ["- id preenchido = atualiza", "- id vazio = cria novo", "- Cidade deve estar cadastrada no sistema"]
          )}
          onImportar={async (file) => {
            setLoadingImport("campos");
            try {
              const rows = await lerExcel(file);
              const erros = []; const validos = [];
              rows.forEach((row, i) => {
                const linha = i + 2;
                const nome = String(row["nome"]||"").trim();
                if (!nome) { erros.push({ linha, mensagem: "Campo 'nome' é obrigatório." }); return; }
                const cidadeNome = String(row["cidade"]||"").trim();
                if (cidadeNome) {
                  const cidadeOk = (cidades||[]).find(c => c.nome.toUpperCase() === cidadeNome.toUpperCase());
                  if (!cidadeOk) erros.push({ linha, mensagem: `Cidade '${cidadeNome}' não encontrada. Cadastre primeiro.` });
                }
                if (!erros.find(e => e.linha === linha)) validos.push(row);
              });
              setResultadoImport({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r.id_campo).length} atualizações + ${validos.filter(r=>!r.id_campo).length} novos.`, _dados: validos });
            } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
          }}
          loadingImport={loadingImport==="campos"}
        />
        <Btn onClick={abrirNovo}>+ Novo Campo</Btn>
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
                  <ThSortable colKey="nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Nome</ThSortable>
                  <ThSortable colKey="endereco" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Endereço</ThSortable>
                  <ThSortable colKey="cidade.nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Cidade</ThSortable>
                  <ThSortable colKey="data_fim" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Inativo em</ThSortable>
                  <ThSortable sortKey={_sk} asc={_asc} onSort={()=>{}}></ThSortable>
          </tr></thead>
          <tbody>
            {(sortData(campos, _sk, _asc)||[]).map((c,i) => (
              <tr key={c.id_campo} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700 }}>{c.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{c.endereco || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{c.cidade ? `${c.cidade.nome}/${c.cidade.estado}` : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{c.data_fim ? new Date(c.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px" }}><Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(c)}>Editar</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={modal === "novo" ? "Novo Campo" : "Editar Campo"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
            <Input label="Endereço" value={form.endereco||""} onChange={e => set("endereco", e.target.value)} />
            <Select label="Cidade" value={form.id_cidade||""} onChange={e => set("id_cidade", e.target.value)}>
              <option value="">Selecione...</option>
              {(cidades||[]).map(c => <option key={c.id_cidade} value={c.id_cidade}>{c.nome}/{c.estado}</option>)}
            </Select>
            <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD CIDADES ──────────────────────────────────────────────
function CrudCidades({ show }) {
  const { data: cidades, loading, reload } = useQuery(() => api.get(`cidade?select=*&order=nome.asc`));
  const [_sk, _setSk] = useState("nome"); const [_asc, _setAsc] = useState(true);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving]           = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function confirmarImport() {
    const { _dados, _tipo } = resultadoImport;
    setSaving(true);
    try {
      for (const row of _dados) {
        const body = { nome: String(row.nome||"").trim(), estado: String(row.estado||"").trim().toUpperCase() };
        if (row.id_cidade) await api.patch(`cidade?id_cidade=eq.${row.id_cidade}`, body);
        else await api.post("cidade", body);
      }
      show(`${_dados.length} registro(s) importado(s)!`); setResultadoImport(null); reload();
    } catch(e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  function abrirNovo() { setForm({ nome:"", estado:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(c) { setForm({ ...c }); setModal(c); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, estado: form.estado||null, observacoes: form.observacoes||null };
      if (modal === "novo") await api.post("cidade", body);
      else await api.patch(`cidade?id_cidade=eq.${form.id_cidade}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <BotoesImportExport
          onExportar={() => exportarExcel(
            cidades||[],
            [
              { key:"id_cidade",    label:"id",     width:8,  descricao:"NÃO altere este campo. Deixe vazio para criar nova cidade." },
              { key:"nome",         label:"nome",   width:25, descricao:"Nome da cidade. OBRIGATÓRIO." },
              { key:"estado",       label:"estado", width:8,  descricao:"UF com 2 letras. Ex: RS, SP. OBRIGATÓRIO." },
            ],
            "cidades",
            ["Regras:", "- id preenchido = atualiza registro existente", "- id vazio = cria novo registro", "- Todos os erros devem ser corrigidos antes de importar"]
          )}
          onImportar={async (file) => {
            setLoadingImport("cidades");
            try {
              const rows = await lerExcel(file);
              const erros = [];
              const validos = [];
              rows.forEach((row, i) => {
                const linha = i + 2;
                const nome = String(row["nome"]||"").trim();
                const estado = String(row["estado"]||"").trim().toUpperCase();
                if (!nome) erros.push({ linha, mensagem: "Campo 'nome' é obrigatório." });
                if (!estado) erros.push({ linha, mensagem: "Campo 'estado' é obrigatório." });
                else if (estado.length !== 2) erros.push({ linha, mensagem: `Estado '${estado}' inválido. Use 2 letras (ex: RS).` });
                if (!erros.find(e => e.linha === linha)) validos.push({ ...row, nome, estado });
              });
              setResultadoImport({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r.id_cidade).length} atualizações + ${validos.filter(r=>!r.id_cidade).length} novos registros.`, _dados: validos, _tipo: "cidades" });
            } catch(e) { show(e.message, "error"); }
            finally { setLoadingImport(null); }
          }}
          loadingImport={loadingImport==="cidades"}
        />
        <Btn onClick={abrirNovo}>+ Nova Cidade</Btn>
      </div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
                  <ThSortable colKey="nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Cidade</ThSortable>
                  <ThSortable colKey="estado" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Estado</ThSortable>
                  <ThSortable sortKey={_sk} asc={_asc} onSort={()=>{}}></ThSortable>
          </tr></thead>
          <tbody>
            {(sortData(cidades, _sk, _asc)||[]).map((c,i) => (
              <tr key={c.id_cidade} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700 }}>{c.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim }}>{c.estado || "—"}</td>
                <td style={{ padding:"11px 14px" }}><Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(c)}>Editar</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      {modal && (
        <Modal title={modal === "novo" ? "Nova Cidade" : "Editar Cidade"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
            <Input label="Estado (UF)" value={form.estado||""} onChange={e => set("estado", e.target.value.toUpperCase().slice(0,2))} placeholder="RS" />
            <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD POSIÇÕES ─────────────────────────────────────────────
function CrudPosicoes({ show }) {
  const { data: posicoes, loading, reload } = useQuery(() =>
    api.get(`posicao?select=*,posicao_pai:posicao!id_posicao_pai(nome)&order=ordem.asc,nome.asc`)
  );
  const [_sk, _setSk] = useState("nome"); const [_asc, _setAsc] = useState(true);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);

  async function confirmarImportPosicoes() {
    setSaving(true);
    try {
      for (const row of resultadoImport._dados) {
        const body = { nome: String(row.nome||"").trim(), id_posicao_pai: row.id_grupo ? Number(row.id_grupo) : null, ordem: row.ordem ? Number(row.ordem) : null, descricao: row.descricao||null };
        if (row.id_posicao) await api.patch(`posicao?id_posicao=eq.${row.id_posicao}`, body);
        else await api.post("posicao", body);
      }
      show(`${resultadoImport._dados.length} registro(s) importado(s)!`); setResultadoImport(null); reload();
    } catch(e) { show(e.message, "error"); } finally { setSaving(false); }
  }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() { setForm({ nome:"", descricao:"", ordem:"", id_posicao_pai:"" }); setModal("novo"); }
  function abrirEditar(p) { setForm({ ...p, id_posicao_pai: p.id_posicao_pai ? String(p.id_posicao_pai) : "" }); setModal(p); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, descricao: form.descricao || null, ordem: form.ordem ? Number(form.ordem) : null, id_posicao_pai: form.id_posicao_pai ? Number(form.id_posicao_pai) : null };
      if (modal === "novo") await api.post("posicao", body);
      else await api.patch(`posicao?id_posicao=eq.${form.id_posicao}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function inativar(p) {
    if (!confirm(`Inativar a posição "${p.nome}"?`)) return;
    try { await api.patch(`posicao?id_posicao=eq.${p.id_posicao}`, { data_fim: new Date().toISOString().split("T")[0] }); show("Inativado."); reload(); }
    catch (e) { show(e.message, "error"); }
  }

  if (loading) return <Spinner />;

  const grupos = (sortData(posicoes, _sk, _asc)||[]).filter(p => !p.id_posicao_pai);
  const filhas  = (sortData(posicoes, _sk, _asc)||[]).filter(p =>  p.id_posicao_pai);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <BotoesImportExport
          onExportar={() => exportarExcel(
            posicoes||[],
            [
              { key:"id_posicao",     label:"id",        width:8,  descricao:"NÃO altere. Vazio = novo." },
              { key:"nome",           label:"nome",      width:25, descricao:"Nome da posição. OBRIGATÓRIO." },
              { key:"id_posicao_pai", label:"id_grupo",  width:8,  descricao:"ID do grupo pai. Deixe vazio se for grupo principal." },
              { key:"ordem",          label:"ordem",     width:8,  descricao:"Ordem de exibição (número)." },
              { key:"descricao",      label:"descricao", width:40, descricao:"Descrição da posição." },
            ],
            "posicoes",
            ["- Grupos não têm id_grupo", "- Posições específicas devem ter id_grupo preenchido"]
          )}
          onImportar={async (file) => {
            setLoadingImport("posicoes");
            try {
              const rows = await lerExcel(file);
              const erros = []; const validos = [];
              rows.forEach((row, i) => {
                const linha = i + 2;
                const nome = String(row["nome"]||"").trim();
                if (!nome) erros.push({ linha, mensagem: "Campo 'nome' é obrigatório." });
                else validos.push(row);
              });
              setResultadoImport({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r.id_posicao).length} atualizações + ${validos.filter(r=>!r.id_posicao).length} novos.`, _dados: validos });
            } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
          }}
          loadingImport={loadingImport==="posicoes"}
        />
        <Btn onClick={abrirNovo}>+ Nova Posição</Btn>
      </div>
      {["Grupos (pai)","Posições detalhadas"].map((titulo, gi) => {
        const lista = gi === 0 ? grupos : filhas;
        if (!lista.length) return null;
        return (
          <div key={titulo}>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>{titulo}</div>
            <Card style={{ padding:0, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
                <thead><tr style={{ background:C.surf2 }}>
                  <ThSortable colKey="nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Nome</ThSortable>
                  <ThSortable colKey="descricao" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Descrição</ThSortable>
                  <ThSortable colKey="ordem" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Ordem</ThSortable>
                  <ThSortable colKey="posicao_pai.nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Grupo pai</ThSortable>
                  <ThSortable colKey="data_fim" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Inativo em</ThSortable>
                  <ThSortable sortKey={_sk} asc={_asc} onSort={()=>{}}></ThSortable>
                </tr></thead>
                <tbody>
                  {lista.map((p, i) => (
                    <tr key={p.id_posicao} style={{ background: i%2===0?C.surface:C.bg }}>
                      <td style={{ padding:"11px 14px", fontWeight:700 }}>{p.nome}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{p.descricao || "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, textAlign:"center" }}>{p.ordem ?? "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{p.posicao_pai?.nome || "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{p.data_fim ? new Date(p.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                      <td style={{ padding:"11px 14px", display:"flex", gap:8 }}>
                        <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(p)}>Editar</Btn>
                        {!p.data_fim && <Btn variant="danger" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => inativar(p)}>Inativar</Btn>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        );
      })}
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImportPosicoes} salvando={saving}/>
      {modal && (
        <Modal title={modal === "novo" ? "Nova Posição" : "Editar Posição"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
            <Input label="Descrição (sigla)" value={form.descricao||""} onChange={e => set("descricao", e.target.value)} placeholder="ex: VOL, ZAG, CA..." />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Ordem" type="number" min="1" value={form.ordem||""} onChange={e => set("ordem", e.target.value)} />
              <Select label="Grupo pai (deixe vazio se for grupo)" value={form.id_posicao_pai||""} onChange={e => set("id_posicao_pai", e.target.value)}>
                <option value="">— É um grupo —</option>
                {(posicoes||[]).filter(p => !p.id_posicao_pai).map(p => <option key={p.id_posicao} value={p.id_posicao}>{p.nome}</option>)}
              </Select>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD TEMPORADAS ───────────────────────────────────────────
function CrudTemporadas({ show }) {
  const { data: temporadas, loading, reload } = useQuery(() =>
    api.get(`temporada?select=*,time(nome)&order=data_inicio.desc`)
  );
  const { data: times } = useQuery(() => api.get(`time?select=*&order=nome.asc`));
  const [_sk, _setSk] = useState("data_inicio"); const [_asc, _setAsc] = useState(false);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);

  async function confirmarImportTemporadas() {
    setSaving(true);
    try {
      const utData = await api.get(`usuario_time?select=id_time&limit=1`);
      const id_time_val = utData?.[0]?.id_time || null;
      for (const row of resultadoImport._dados) {
        const body = { nome: String(row.nome||"").trim(), data_inicio: row.data_inicio||null, data_fim: row.data_fim||null, publico: row.publico !== "NAO" && row.publico !== false, tecnico: row.tecnico||null, presidente: row.presidente||null, vice_presidente: row.vice_presidente||null, financeiro: row.financeiro||null, vice_financeiro: row.vice_financeiro||null, marca_jogos: row.marca_jogos||null, resp_redes_sociais: row.resp_redes_sociais||null, resp_eventos: row.resp_eventos||null, id_time: id_time_val };
        if (row.id_temporada) await api.patch(`temporada?id_temporada=eq.${row.id_temporada}`, body);
        else await api.post("temporada", body);
      }
      show(`${resultadoImport._dados.length} temporada(s) importada(s)!`); setResultadoImport(null); reload();
    } catch(e) { show(e.message, "error"); } finally { setSaving(false); }
  }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() {
    const t = times?.[0];
    setForm({ nome:"", id_time: t ? String(t.id_time) : "", data_inicio:"", data_fim:"", publico: true, tecnico: t?.tecnico||"", presidente: t?.presidente||"", vice_presidente: t?.vice_presidente||"", financeiro: t?.financeiro||"", vice_financeiro: t?.vice_financeiro||"", marca_jogos: t?.marca_jogos||"", resp_redes_sociais: t?.resp_redes_sociais||"", resp_eventos: t?.resp_eventos||"", observacoes:"" });
    setModal("novo");
  }
  function abrirEditar(t) { setForm({ ...t, publico: t.publico !== false, uniforme_1_url: t.uniforme_1_url||null, uniforme_2_url: t.uniforme_2_url||null, uniforme_3_url: t.uniforme_3_url||null, escudo_url: t.escudo_url||null, id_time: t.id_time ? String(t.id_time) : "" }); setModal(t); }

  async function salvar() {
    if (!form.nome || !form.data_inicio || !form.data_fim) { show("Nome e datas são obrigatórios.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, id_time: form.id_time ? Number(form.id_time) : null, data_inicio: form.data_inicio, data_fim: form.data_fim, publico: form.publico !== false, uniforme_1_url: form.uniforme_1_url||null, uniforme_2_url: form.uniforme_2_url||null, uniforme_3_url: form.uniforme_3_url||null, escudo_url: form.escudo_url||null, tecnico: form.tecnico||null, presidente: form.presidente||null, vice_presidente: form.vice_presidente||null, financeiro: form.financeiro||null, vice_financeiro: form.vice_financeiro||null, marca_jogos: form.marca_jogos||null, resp_redes_sociais: form.resp_redes_sociais||null, resp_eventos: form.resp_eventos||null, observacoes: form.observacoes||null };
      if (modal === "novo") await api.post("temporada", body);
      else await api.patch(`temporada?id_temporada=eq.${form.id_temporada}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <BotoesImportExport
          onExportar={() => exportarExcel(
            temporadas||[],
            [
              { key:"id_temporada",      label:"id",                width:8,  descricao:"NÃO altere. Vazio = nova temporada." },
              { key:"nome",              label:"nome",              width:25, descricao:"Nome da temporada. OBRIGATÓRIO." },
              { key:"data_inicio",       label:"data_inicio",       width:14, descricao:"Data de início (AAAA-MM-DD). OBRIGATÓRIO." },
              { key:"data_fim",          label:"data_fim",          width:14, descricao:"Data de fim (AAAA-MM-DD). OBRIGATÓRIO." },
              { key:"tecnico",           label:"tecnico",           width:20, descricao:"Nome do técnico." },
              { key:"presidente",        label:"presidente",        width:20, descricao:"Nome do presidente." },
              { key:"vice_presidente",   label:"vice_presidente",   width:20, descricao:"Nome do vice-presidente." },
              { key:"financeiro",        label:"financeiro",        width:20, descricao:"Nome do financeiro." },
              { key:"vice_financeiro",   label:"vice_financeiro",   width:20, descricao:"Nome do vice-financeiro." },
              { key:"marca_jogos",       label:"marca_jogos",       width:20, descricao:"Nome de quem marca os jogos." },
              { key:"resp_redes_sociais",label:"resp_redes_sociais",width:20, descricao:"Responsável pelas redes sociais." },
              { key:"resp_eventos",      label:"resp_eventos",      width:20, descricao:"Responsável pelos eventos." },
            ],
            "temporadas",
            ["- id preenchido = atualiza", "- id vazio = cria nova temporada", "- Datas no formato AAAA-MM-DD"]
          )}
          onImportar={async (file) => {
            setLoadingImport("temporadas");
            try {
              const rows = await lerExcel(file);
              const erros = []; const validos = [];
              rows.forEach((row, i) => {
                const linha = i + 2;
                if (!String(row["nome"]||"").trim()) erros.push({ linha, mensagem: "Campo 'nome' é obrigatório." });
                if (!String(row["data_inicio"]||"").trim()) erros.push({ linha, mensagem: "Campo 'data_inicio' é obrigatório." });
                if (!String(row["data_fim"]||"").trim()) erros.push({ linha, mensagem: "Campo 'data_fim' é obrigatório." });
                if (!erros.find(e => e.linha === linha)) validos.push(row);
              });
              setResultadoImport({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r.id_temporada).length} atualizações + ${validos.filter(r=>!r.id_temporada).length} novas.`, _dados: validos });
            } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
          }}
          loadingImport={loadingImport==="temporadas"}
        />
        <Btn onClick={abrirNovo}>+ Nova Temporada</Btn>
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImportTemporadas} salvando={saving}/>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
                  <ThSortable colKey="nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Temporada</ThSortable>
                  <ThSortable colKey="time.nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Time</ThSortable>
                  <ThSortable colKey="data_inicio" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Início</ThSortable>
                  <ThSortable colKey="data_fim" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Fim</ThSortable>
                  <ThSortable colKey="tecnico" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Técnico</ThSortable>
                  <ThSortable colKey="presidente" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Presidente</ThSortable>
                  <ThSortable colKey="vice_presidente" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Vice-Pres.</ThSortable>
                  <ThSortable colKey="financeiro" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Financeiro</ThSortable>
                  <ThSortable colKey="vice_financeiro" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Vice-Fin.</ThSortable>
                  <ThSortable colKey="marca_jogos" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Marca Jogos</ThSortable>
                  <ThSortable colKey="resp_redes_sociais" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Redes</ThSortable>
                  <ThSortable colKey="resp_eventos" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Eventos</ThSortable>
                  <ThSortable colKey="fardamento_titular_url" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Fardamentos</ThSortable>
                  <ThSortable colKey="publico" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Público</ThSortable>
                  <ThSortable sortKey={_sk} asc={_asc} onSort={()=>{}}></ThSortable>
          </tr></thead>
          <tbody>
            {(sortData(temporadas, _sk, _asc)||[]).map((t,i) => (
              <tr key={t.id_temporada} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700, color:C.gold, whiteSpace:"nowrap" }}>{t.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.time?.nome || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{t.data_inicio ? new Date(t.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{t.data_fim ? new Date(t.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.tecnico || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.presidente || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.vice_presidente || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.financeiro || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.vice_financeiro || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.marca_jogos || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.resp_redes_sociais || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{t.resp_eventos || "—"}</td>
                <td style={{ padding:"11px 14px", textAlign:"center" }}>
                  <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
                    {t.escudo_url      && <img src={t.escudo_url}      alt="Escudo"    style={{ width:24, height:24, objectFit:"contain", borderRadius:"50%" }} title="Escudo"/>}
                    {t.uniforme_1_url  && <img src={t.uniforme_1_url}  alt="Uniforme 1" style={{ width:24, height:24, objectFit:"contain" }} title="Uniforme 1"/>}
                    {t.uniforme_2_url  && <img src={t.uniforme_2_url}  alt="Uniforme 2" style={{ width:24, height:24, objectFit:"contain" }} title="Uniforme 2"/>}
                    {t.uniforme_3_url  && <img src={t.uniforme_3_url}  alt="Uniforme 3" style={{ width:24, height:24, objectFit:"contain" }} title="Uniforme 3"/>}
                    {!t.escudo_url && !t.uniforme_1_url && !t.uniforme_2_url && !t.uniforme_3_url && <span style={{ color:C.dim, fontSize:11 }}>—</span>}
                  </div>
                </td>
                <td style={{ padding:"11px 14px", textAlign:"center" }}>
                  <span style={{ color: t.publico !== false ? C.win : C.dim, fontWeight:700, fontSize:12 }}>{t.publico !== false ? "🌐" : "🔒"}</span>
                </td>
                <td style={{ padding:"11px 14px" }}><Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(t)}>Editar</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {modal && (
        <Modal title={modal === "novo" ? "Nova Temporada" : "Editar Temporada"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} placeholder="ex: Temporada 2026" />
              <Select label="Time *" value={form.id_time||""} onChange={e => set("id_time", e.target.value)}>
                <option value="">Selecione...</option>
                {(times||[]).map(t => <option key={t.id_time} value={t.id_time}>{t.nome}</option>)}
              </Select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Data Início *" type="date" value={form.data_inicio||""} onChange={e => set("data_inicio", e.target.value)} />
              <Input label="Data Fim *"   type="date" value={form.data_fim||""}    onChange={e => set("data_fim",    e.target.value)} />
            </div>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginTop:4 }}>Comissão</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Técnico"          value={form.tecnico||""}          onChange={e => set("tecnico",          e.target.value)} />
              <Input label="Presidente"       value={form.presidente||""}       onChange={e => set("presidente",       e.target.value)} />
              <Input label="Vice-Presidente"  value={form.vice_presidente||""}  onChange={e => set("vice_presidente",  e.target.value)} />
              <Input label="Financeiro"       value={form.financeiro||""}       onChange={e => set("financeiro",       e.target.value)} />
              <Input label="Vice-Financeiro"  value={form.vice_financeiro||""}  onChange={e => set("vice_financeiro",  e.target.value)} />
              <Input label="Marca Jogos"      value={form.marca_jogos||""}      onChange={e => set("marca_jogos",      e.target.value)} />
              <Input label="Resp. Redes"      value={form.resp_redes_sociais||""} onChange={e => set("resp_redes_sociais", e.target.value)} />
              <Input label="Resp. Eventos"    value={form.resp_eventos||""}     onChange={e => set("resp_eventos",     e.target.value)} />
            </div>
            <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />

            {/* Escudo da temporada */}
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginTop:4 }}>Escudo da Temporada</div>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              {form.escudo_url
                ? <img src={form.escudo_url} alt="Escudo" style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}` }}/>
                : <div style={{ width:64, height:64, borderRadius:"50%", background:C.surf2, border:`2px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🏆</div>
              }
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <ImageUpload bucket="escudos" onUpload={url => set("escudo_url", url)} style={{ fontSize:11 }}/>
                {form.escudo_url && <button onClick={() => set("escudo_url", null)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:11 }}>✕ Remover</button>}
                <div style={{ fontSize:10, color:C.dim }}>Opcional — se diferente do escudo do time</div>
              </div>
            </div>

            {/* Uniformes */}
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginTop:4 }}>Uniformes</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              {/* Uniforme 1 */}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ fontSize:11, color:C.dim, fontWeight:700 }}>👕 Uniforme 1</div>
                {form.uniforme_1_url && (
                  <img src={form.uniforme_1_url} alt="Uniforme 1"
                    style={{ width:"100%", height:80, objectFit:"contain", borderRadius:8, background:C.surf2, border:`1px solid ${C.border}` }}/>
                )}
                <ImageUpload bucket="uniformes" value={form.uniforme_1_url} onUpload={url => set("uniforme_1_url", url)} nomeArquivo={`uniforme_1_${form.id_temporada||'novo'}`}/>
                {form.uniforme_1_url && (
                  <button onClick={() => set("uniforme_1_url", null)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:11 }}>✕ Remover</button>
                )}
              </div>
              {/* Uniforme 2 */}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ fontSize:11, color:C.dim, fontWeight:700 }}>👕 Uniforme 2</div>
                {form.uniforme_2_url && (
                  <img src={form.uniforme_2_url} alt="Uniforme 2"
                    style={{ width:"100%", height:80, objectFit:"contain", borderRadius:8, background:C.surf2, border:`1px solid ${C.border}` }}/>
                )}
                <ImageUpload bucket="uniformes" value={form.uniforme_2_url} onUpload={url => set("uniforme_2_url", url)} nomeArquivo={`uniforme_2_${form.id_temporada||'novo'}`}/>
                {form.uniforme_2_url && (
                  <button onClick={() => set("uniforme_2_url", null)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:11 }}>✕ Remover</button>
                )}
              </div>
              {/* Uniforme 3 */}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ fontSize:11, color:C.dim, fontWeight:700 }}>🧤 Uniforme 3</div>
                {form.uniforme_3_url && (
                  <img src={form.uniforme_3_url} alt="Uniforme 3"
                    style={{ width:"100%", height:80, objectFit:"contain", borderRadius:8, background:C.surf2, border:`1px solid ${C.border}` }}/>
                )}
                <ImageUpload bucket="uniformes" value={form.uniforme_3_url} onUpload={url => set("uniforme_3_url", url)} nomeArquivo={`uniforme_3_${form.id_temporada||'novo'}`}/>
                {form.uniforme_3_url && (
                  <button onClick={() => set("uniforme_3_url", null)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:11 }}>✕ Remover</button>
                )}
              </div>
            </div>

            {/* Toggle público temporada */}
            <div style={{ background: form.publico !== false ? C.win+"11" : C.loss+"11", border:`1px solid ${form.publico !== false ? C.win+"44" : C.loss+"44"}`, borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color: form.publico !== false ? C.win : C.loss, marginBottom:2 }}>
                  {form.publico !== false ? "🌐 Temporada Pública" : "🔒 Temporada Privada"}
                </div>
                <div style={{ fontSize:11, color:C.dim }}>
                  {form.publico !== false ? "Aparece no app público." : "Não aparece no app público."}
                </div>
              </div>
              <button onClick={() => set("publico", form.publico === false ? true : false)}
                style={{ flexShrink:0, width:48, height:26, borderRadius:13, border:"none", cursor:"pointer", position:"relative", background: form.publico !== false ? C.win : C.dim, transition:"background 0.2s" }}>
                <span style={{ position:"absolute", top:3, left: form.publico !== false ? 24 : 3, width:20, height:20, borderRadius:"50%", background:"white", transition:"left 0.2s", display:"block" }}/>
              </button>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CONFIGURAÇÕES DO TIME ─────────────────────────────────────
function ConfigTime({ show }) {
  const { data: times, loading, reload } = useQuery(() => api.get(`time?select=*,campo(nome)&limit=1`));
  const { data: campos  } = useQuery(() => api.get(`campo?select=*&order=nome.asc`));
  const { data: cidades } = useQuery(() => api.get(`cidade?select=*&order=nome.asc`));
  const { data: tipos   } = useQuery(() => api.get(`tipo_time?select=*&status=eq.Ativo&order=descricao.asc`));
  const [form, setForm]   = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (times?.[0] && !form) {
      const t = times[0];
      setForm({ ...t, id_campo: t.id_campo ? String(t.id_campo) : "", id_cidade_sede: t.id_cidade_sede ? String(t.id_cidade_sede) : "", id_tipo_time: t.id_tipo_time ? String(t.id_tipo_time) : "", data_fundacao: t.data_fundacao ? t.data_fundacao.split("T")[0] : "" });
    }
  }, [times]);

  function aplicarTipo(id_tipo) {
    const tipo = (tipos||[]).find(t => String(t.id_tipo_time) === String(id_tipo));
    if (!tipo) return;
    setForm(f => ({ ...f,
      id_tipo_time: String(id_tipo),
      numero_titulares: tipo.numero_titulares,
      quantidade_periodos: tipo.quantidade_periodos,
      minutos_padrao_periodo: tipo.minutos_padrao_periodo,
      permite_acrescimos: tipo.permite_acrescimos,
    }));
  }

  async function salvar() {
    if (!form?.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = {
        nome: form.nome, telefone: form.telefone||null,
        escudo_url: form.escudo_url||null,
        id_campo: form.id_campo ? Number(form.id_campo) : null,
        id_cidade_sede: form.id_cidade_sede ? Number(form.id_cidade_sede) : null,
        id_tipo_time: form.id_tipo_time ? Number(form.id_tipo_time) : null,
        valor_mensalidade: form.valor_mensalidade ? Number(form.valor_mensalidade) : null,
        data_fundacao: form.data_fundacao||null,
        numero_titulares: form.numero_titulares ? Number(form.numero_titulares) : null,
        quantidade_periodos: form.quantidade_periodos ? Number(form.quantidade_periodos) : null,
        minutos_padrao_periodo: form.minutos_padrao_periodo ? Number(form.minutos_padrao_periodo) : null,
        permite_acrescimos: form.permite_acrescimos||"N",
        tecnico: form.tecnico||null, presidente: form.presidente||null,
        vice_presidente: form.vice_presidente||null, financeiro: form.financeiro||null,
        vice_financeiro: form.vice_financeiro||null, marca_jogos: form.marca_jogos||null,
        resp_redes_sociais: form.resp_redes_sociais||null, resp_eventos: form.resp_eventos||null,
        observacoes: form.observacoes||null, publico: form.publico !== false
      };
      await api.patch(`time?id_time=eq.${form.id_time}`, body);
      show("Configurações salvas!"); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading || !form) return <Spinner />;

  return (
    <Card style={{ padding:24 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

        {/* Identidade do Time */}
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Identidade</div>
        <div style={{ display:"flex", alignItems:"flex-start", gap:20 }}>
          <ImageUpload label="Escudo" value={form.escudo_url||""} onUpload={url => set("escudo_url", url)} bucket="escudos" nomeArquivo={`time_${form.id_time}`}/>
          <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Input label="Nome do Time *" value={form.nome||""} onChange={e => set("nome", e.target.value)}/>
            <Input label="Telefone" value={form.telefone||""} onChange={e => set("telefone", e.target.value)}/>
            <Input label="Data de Fundação" type="date" value={form.data_fundacao||""} onChange={e => set("data_fundacao", e.target.value)}/>
            <Select label="Cidade Sede" value={form.id_cidade_sede||""} onChange={e => set("id_cidade_sede", e.target.value)}>
              <option value="">Selecione...</option>
              {(cidades||[]).map(c => <option key={c.id_cidade} value={c.id_cidade}>{c.nome}{c.estado ? ` — ${c.estado}` : ""}</option>)}
            </Select>
            <Select label="Campo Principal" value={form.id_campo||""} onChange={e => set("id_campo", e.target.value)}>
              <option value="">Selecione...</option>
              {(campos||[]).map(c => <option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
            </Select>
            <Input label="Valor Mensalidade (R$)" type="number" min="0" step="0.01" value={form.valor_mensalidade||""} onChange={e => set("valor_mensalidade", e.target.value)}/>
          </div>
        </div>

        {/* Tipo de Time */}
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Tipo de Time</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, alignItems:"end" }}>
          <Select label="Tipo de Time" value={form.id_tipo_time||""} onChange={e => aplicarTipo(e.target.value)}>
            <option value="">Selecione...</option>
            {(tipos||[]).map(t => <option key={t.id_tipo_time} value={t.id_tipo_time}>{t.descricao}</option>)}
          </Select>
          <div style={{ fontSize:11, color:C.dim, fontStyle:"italic", paddingBottom:4 }}>
            Ao mudar o tipo, as regras abaixo são atualizadas automaticamente
          </div>
        </div>

        {/* Regras do Jogo */}
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Regras do Jogo</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          <Input label="Nº Titulares"    type="number" min="1" value={form.numero_titulares||""} onChange={e => set("numero_titulares", e.target.value)} />
          <Input label="Qtd. Períodos"   type="number" min="1" value={form.quantidade_periodos||""} onChange={e => set("quantidade_periodos", e.target.value)} />
          <Input label="Min. por Período" type="number" min="1" value={form.minutos_padrao_periodo||""} onChange={e => set("minutos_padrao_periodo", e.target.value)} />
          <Select label="Permite Acrés." value={form.permite_acrescimos||"N"} onChange={e => set("permite_acrescimos", e.target.value)}>
            <option value="N">Não</option>
            <option value="S">Sim</option>
          </Select>
        </div>

        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginTop:4, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Comissão Atual</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Input label="Técnico"         value={form.tecnico||""}         onChange={e => set("tecnico",          e.target.value)} />
          <Input label="Presidente"      value={form.presidente||""}      onChange={e => set("presidente",       e.target.value)} />
          <Input label="Vice-Presidente" value={form.vice_presidente||""} onChange={e => set("vice_presidente",  e.target.value)} />
          <Input label="Financeiro"      value={form.financeiro||""}      onChange={e => set("financeiro",       e.target.value)} />
          <Input label="Vice-Financeiro" value={form.vice_financeiro||""} onChange={e => set("vice_financeiro",  e.target.value)} />
          <Input label="Marca Jogos"     value={form.marca_jogos||""}     onChange={e => set("marca_jogos",      e.target.value)} />
          <Input label="Resp. Redes"     value={form.resp_redes_sociais||""} onChange={e => set("resp_redes_sociais", e.target.value)} />
          <Input label="Resp. Eventos"   value={form.resp_eventos||""}    onChange={e => set("resp_eventos",     e.target.value)} />
        </div>
        <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />
        {/* Toggle público/privado */}
        <div style={{ background: form.publico !== false ? C.win+"11" : C.loss+"11", border:`1px solid ${form.publico !== false ? C.win+"44" : C.loss+"44"}`, borderRadius:10, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color: form.publico !== false ? C.win : C.loss, marginBottom:4 }}>
              {form.publico !== false ? "🌐 Perfil Público" : "🔒 Perfil Privado"}
            </div>
            <div style={{ fontSize:12, color:C.dim, lineHeight:1.5 }}>
              {form.publico !== false
                ? "Seu time aparece no app público e qualquer pessoa pode ver as estatísticas."
                : "Seu time não aparece no app público. Apenas admins têm acesso às informações."}
            </div>
          </div>
          <button
            onClick={() => set("publico", form.publico === false ? true : false)}
            style={{ flexShrink:0, width:52, height:28, borderRadius:14, border:"none", cursor:"pointer", position:"relative", background: form.publico !== false ? C.win : C.dim, transition:"background 0.2s" }}>
            <span style={{ position:"absolute", top:3, left: form.publico !== false ? 26 : 3, width:22, height:22, borderRadius:"50%", background:"white", transition:"left 0.2s", display:"block" }}/>
          </button>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
          <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar Configurações"}</Btn>
        </div>
      </div>
    </Card>
  );
}
