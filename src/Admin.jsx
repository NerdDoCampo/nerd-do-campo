import React, { useState, useEffect, useCallback, useRef } from "react";
const APP_VERSION = process.env.REACT_APP_VERSION || "1.4.5";
const UFS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

// Paleta de cores do sistema — declarada no topo para evitar "Cannot access 'C' before initialization"
const C = {
  bg:      "#0B3D2E", surface: "#103D2A", surf2: "#174D36",
  border:  "#1F5C3E", gold: "#E8A020",    cream: "#F0E8D0",
  dim:     "#8FAF9A", win: "#4CAF50",     loss: "#E53935",
  draw:    "#E8A020",
};

// Calcula o esquema tático (ex: "4-4-2") a partir das participações de uma partida.
// Usa a posição cadastrada NA PARTIDA. Considera só titulares (titular = 'S') com posição.
// Resolve o grupo (posição-pai; se plana, a própria); descarta o grupo de menor ordem
// (goleiro); ordena pela ordem do grupo. mapaPos: { id_posicao: {ordem, id_posicao_pai} }
// vindo das posições do tipo do time (para resolver a ordem do pai sem self-join).
function calcularEsquema(participacoes, mapaPos) {
  const titulares = (participacoes || []).filter(p => p.titular === "S" && p.posicao);
  if (titulares.length === 0) return null;
  const mp = mapaPos || {};
  const grupos = {}; // idGrupo -> { ordem, count }
  titulares.forEach(p => {
    const pos = p.posicao;
    const temPai = !!pos.id_posicao_pai;
    const idGrupo = temPai ? pos.id_posicao_pai : pos.id_posicao;
    // ordem do grupo: se tem pai, a ordem do pai (via mapa); senão, a ordem da própria
    let ordem;
    if (temPai) {
      ordem = (mp[pos.id_posicao_pai]?.ordem != null) ? mp[pos.id_posicao_pai].ordem
            : (pos.pai?.ordem != null ? pos.pai.ordem : 999);
    } else {
      ordem = (pos.ordem != null) ? pos.ordem : 999;
    }
    if (!grupos[idGrupo]) grupos[idGrupo] = { ordem, count: 0 };
    grupos[idGrupo].count++;
  });
  const ordenados = Object.values(grupos).sort((a, b) => a.ordem - b.ordem);
  const semGoleiro = ordenados.slice(1); // descarta o 1º grupo (menor ordem = goleiro)
  if (semGoleiro.length === 0) return null;
  return semGoleiro.map(g => g.count).join("-");
}
// Distância em km entre dois pontos (lat/long) — fórmula de Haversine
function distanciaKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v == null || isNaN(Number(v)))) return null;
  const R = 6371; // raio da Terra em km
  const rad = (g) => (Number(g) * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon/2)**2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// ── Supabase ──────────────────────────────────────────────────
const URL  = process.env.REACT_APP_SUPABASE_URL || "https://nxztffulmvohduvudbhg.supabase.co";
const ANON = process.env.REACT_APP_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

let SESSION_TOKEN = sessionStorage.getItem("ndc_token") || null;
let REFRESH_TOKEN = sessionStorage.getItem("ndc_refresh") || null;

// Extrai o e-mail do usuário logado a partir do token JWT (payload base64).
// Usado para registrar quem lançou cada movimento de caixa.
function emailUsuarioLogado() {
  try {
    if (!SESSION_TOKEN) return null;
    const payload = SESSION_TOKEN.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))));
    return json.email || null;
  } catch { return null; }
}

async function sbAuth(path, body) {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Renova o access_token usando o refresh_token. Retorna true se renovou.
async function renovarToken() {
  if (!REFRESH_TOKEN) return false;
  try {
    const res = await sbAuth("token?grant_type=refresh_token", { refresh_token: REFRESH_TOKEN });
    if (res?.access_token) {
      SESSION_TOKEN = res.access_token;
      sessionStorage.setItem("ndc_token", res.access_token);
      if (res.refresh_token) { REFRESH_TOKEN = res.refresh_token; sessionStorage.setItem("ndc_refresh", res.refresh_token); }
      return true;
    }
  } catch (e) {}
  return false;
}

// Limpa a sessão e força relogin (chamado quando o refresh falha).
function encerrarSessao() {
  SESSION_TOKEN = null; REFRESH_TOKEN = null;
  sessionStorage.removeItem("ndc_token");
  sessionStorage.removeItem("ndc_refresh");
  window.dispatchEvent(new CustomEvent("ndc-sessao-expirada"));
}

async function sb(path, opts = {}, _jaTentou = false) {
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${SESSION_TOKEN || ANON}`,
    "Content-Type": "application/json",
    Prefer: opts.prefer || "return=representation",
    ...opts.headers,
  };
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers, ...opts });
  if (res.status === 401 && !_jaTentou && SESSION_TOKEN) {
    const renovou = await renovarToken();
    if (renovou) return sb(path, opts, true);
    encerrarSessao();
    throw new Error("Sua sessão expirou. Faça login novamente.");
  }
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
// ── Tratamento de HORA — "hora da parede" (Caminho A) ──
// Convenção: a hora é gravada e lida literalmente em UTC, sem conversão
// de fuso. Assim "14h" digitado é "14h" em qualquer lugar do mundo.
// Monta o timestamp para salvar: data (YYYY-MM-DD) + hora (HH:MM) -> ISO com Z
function montarDataHoraUTC(dataYMD, horaHM) {
  if (!dataYMD) return null;
  const h = (horaHM && /^\d{1,2}:\d{2}$/.test(horaHM)) ? horaHM : "00:00";
  const [hh, mm] = h.split(":");
  return `${dataYMD}T${hh.padStart(2,"0")}:${mm}:00.000Z`;
}
// Lê a hora (HH:MM) de um timestamp, sem conversão de fuso
function horaDeTS(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}
// Lê a data (YYYY-MM-DD) de um timestamp, sem conversão de fuso
function dataDeTS(ts) {
  if (!ts) return "";
  return String(ts).slice(0,10);
}
function fmtHoraP(ts) { return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit", timeZone:"UTC" }) : "—"; }
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

function fmtDataA(ts) { return ts ? new Date(ts).toLocaleDateString("pt-BR", { timeZone:"UTC" }) : "—"; }
// valida link de localização: aceita vazio, ou texto que CONTENHA uma URL
function extrairURL(v) {
  if (!v) return null;
  const t = String(v).trim();
  if (!t) return null;
  // procura uma URL http(s) dentro do texto
  const m = t.match(/https?:\/\/[^\s]+/i);
  if (m) return m[0];
  // sem protocolo: procura algo tipo dominio.xx/...
  const m2 = t.match(/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?/i);
  if (m2) return `https://${m2[0]}`;
  return null;
}
function linkLocalValido(v) {
  if (!v || !String(v).trim()) return true; // vazio é permitido (campo opcional)
  return extrairURL(v) !== null;
}
// normaliza o link para salvar: extrai a URL e garante o https://
function normalizarLink(v) {
  return extrairURL(v); // retorna a URL pronta, ou null se não achar
}
function fmtHoraA(ts) { return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit", timeZone:"UTC" }) : "—"; }
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
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo:id_campo(nome)&order=data.asc`),
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
                style={{ width:88, height:88, borderRadius:"50%", objectFit:"cover", border:`3px solid ${C.gold}` }}/>
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
            <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{ultima.adversario?.nome || "A definir"}</div>
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
    () => sb(`gol?select=*,participacao!inner(id_jogador,jogador(nome,apelido,camisa))&participacao.id_partida=eq.${partida.id_partida}&participacao.id_jogador=gt.0&order=periodo.asc,minuto.asc`),
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
        <div style={{ fontSize:24, fontWeight:800, textTransform:"uppercase", marginBottom:12 }}>{partida.adversario?.nome || "🔍 Procurando adversário"}</div>
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
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo:id_campo(nome)&order=data.asc`),
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
                const procurando = !p.id_adversario && p.cancelada !== "S";
                const bgBase = procurando ? "rgba(232,160,32,0.12)" : (i%2===0?C.surface:C.bg);
                return (
                  <tr key={p.id_partida}
                    onClick={() => { if (p.gols_marcados !== null && p.cancelada !== "S") setPartidaSel(p); }}
                    style={{ background:bgBase, cursor: p.gols_marcados !== null && p.cancelada !== "S" ? "pointer" : "default", borderLeft: procurando ? `3px solid ${C.gold}` : "3px solid transparent" }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=C.surf2; }}
                    onMouseLeave={e=>e.currentTarget.style.background=bgBase}>
                    <td style={{ padding:"12px 14px", fontWeight:600, whiteSpace:"nowrap" }}>{fmtDataA(p.data)}</td>
                    <td style={{ padding:"12px 14px", color:C.dim }}>{fmtHoraA(p.data)}</td>
                    <td style={{ padding:"12px 14px", fontWeight:700, color: procurando ? C.gold : C.cream }}>{procurando ? "🔍 Procurando adversário" : (p.adversario?.nome||"A definir")}</td>
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
    () => sb(`jogador?id_jogador=gt.0&id_time=eq.${time.id_time}&select=*,posicao(nome,ordem)&order=camisa.asc`),
    [time.id_time]
  );
  if (loading) return <Spinner />;
  const ativos = (jogadores||[]).filter(j => !j.data_fim);
  const grupos = [...new Set(ativos.map(j => j.posicao?.nome).filter(Boolean))]
    .sort((a, b) => {
      const ordemA = ativos.find(j => j.posicao?.nome === a)?.posicao?.ordem ?? 999;
      const ordemB = ativos.find(j => j.posicao?.nome === b)?.posicao?.ordem ?? 999;
      return ordemA - ordemB;
    });
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
                  style={{ width:130, height:130, objectFit:"contain", borderRadius:8, background:C.surf2, border:`1px solid ${C.border}`, display:"block", marginBottom:6 }}/>
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
        const jogs = ativos.filter(j => j.posicao?.nome === grupo)
          .sort((a, b) => {
            const na = Number(a.camisa), nb = Number(b.camisa);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a.camisa||"").localeCompare(String(b.camisa||""));
          });
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
            return <option key={p.id_partida} value={p.id_partida}>{fmtDataA(p.data)} — {p.adversario?.nome || "A definir"} ({qtd} gol{qtd!==1?"s":""})</option>;
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

// Carrega TODAS as cidades da base nacional (paginando o limite de 1000 do PostgREST).
// Usado nas planilhas (aba de referência) e na validação de importação por nome+UF.
async function carregarTodasCidades() {
  const todas = [];
  let offset = 0;
  const pag = 1000;
  // Limite de segurança: ~6 páginas cobrem os 5570 municípios do Brasil.
  for (let i = 0; i < 8; i++) {
    const lote = await api.get(`cidade?select=id_cidade,nome,estado&order=estado.asc,nome.asc&limit=${pag}&offset=${offset}`);
    if (!lote || lote.length === 0) break;
    todas.push(...lote);
    if (lote.length < pag) break;
    offset += pag;
  }
  return todas;
}

function exportarExcel(dados, colunas, nomeArquivo, instrucoes, abaReferencia) {
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
  // Aba de referência opcional (ex: lista de cidades válidas com UF, para consulta)
  if (abaReferencia && abaReferencia.dados && abaReferencia.dados.length) {
    const wsRef = XLSX.utils.aoa_to_sheet([abaReferencia.colunas, ...abaReferencia.dados]);
    wsRef["!cols"] = (abaReferencia.larguras || abaReferencia.colunas.map(()=>25)).map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsRef, abaReferencia.nome || "Referência");
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
// Calcula a idade (anos completos) a partir da data de nascimento até hoje.
function calcularIdade(dataNasc) {
  if (!dataNasc) return null;
  const nasc = new Date(String(dataNasc).slice(0,10) + "T00:00:00");
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

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
    const rawA = getVal(a, sortKey);
    const rawB = getVal(b, sortKey);
    // Comparação numérica quando ambos são números (ex: camisa, ordem)
    const numA = Number(rawA), numB = Number(rawB);
    const ambosNum = rawA !== "" && rawB !== "" && !isNaN(numA) && !isNaN(numB);
    if (ambosNum) {
      if (numA < numB) return asc ? -1 : 1;
      if (numA > numB) return asc ? 1 : -1;
      return 0;
    }
    // Vazios sempre por último
    if (rawA === "" && rawB !== "") return 1;
    if (rawA !== "" && rawB === "") return -1;
    const va = String(rawA).toLowerCase();
    const vb = String(rawB).toLowerCase();
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
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, ...s }}>
      {label && <label style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</label>}
      <input {...p} style={{ background: C.surf2, border: `1px solid ${error ? C.loss : C.border}`, borderRadius: 8, padding: "9px 12px", color: C.cream, fontFamily: "inherit", fontSize: 14, outline: "none", width: "100%", minWidth: 0, boxSizing: "border-box" }} />
      {error && <span style={{ color: C.loss, fontSize: 12 }}>{error}</span>}
    </div>
  );
}
function Select({ label, children, error, style: s = {}, ...p }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, ...s }}>
      {label && <label style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</label>}
      <select {...p} style={{ background: C.surf2, border: `1px solid ${error ? C.loss : C.border}`, borderRadius: 8, padding: "9px 12px", color: C.cream, fontFamily: "inherit", fontSize: 14, outline: "none", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
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
  const timerRef = React.useRef(null);
  const show = (msg, type = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    // Erros ficam mais tempo; mensagens longas ganham tempo proporcional à leitura.
    const base = type === "error" ? 7000 : 4000;
    const leitura = String(msg || "").length * 60;
    const dur = Math.min(base + leitura, type === "error" ? 16000 : 9000);
    timerRef.current = setTimeout(() => setToast(null), dur);
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
function fmtHora(ts) { return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone:"UTC" }) : "—"; }
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
function Login({ onLogin, aviso }) {
  const [email, setEmail]   = useState("");
  const [senha, setSenha]   = useState("");
  const [erro, setErro]     = useState(aviso || "");
  const [loading, setLoading] = useState(false);
  const [modalRecuperar, setModalRecuperar] = useState(false);
  const [emailRec, setEmailRec] = useState("");
  const [enviandoRec, setEnviandoRec] = useState(false);
  const [msgRec, setMsgRec] = useState(null);

  async function handleLogin() {
    setErro(""); setLoading(true);
    const res = await sbAuth("token?grant_type=password", { email, password: senha });
    setLoading(false);
    if (res.access_token) {
      SESSION_TOKEN = res.access_token;
      sessionStorage.setItem("ndc_token", res.access_token);
      if (res.refresh_token) { REFRESH_TOKEN = res.refresh_token; sessionStorage.setItem("ndc_refresh", res.refresh_token); }
      onLogin(res);
    }
    else setErro("E-mail ou senha incorretos.");
  }

  async function enviarRecuperacao() {
    setMsgRec(null);
    if (!emailRec || !emailRec.includes("@")) { setMsgRec({ tipo:"error", txt:"Informe um e-mail válido." }); return; }
    setEnviandoRec(true);
    try {
      // Dispara o e-mail de recuperação. O redirect_to leva o usuário de volta
      // à raiz do app, onde a tela de redefinição de senha assume.
      await sbAuth("recover", { email: emailRec.trim().toLowerCase(), redirect_to: window.location.origin });
      // O Supabase responde OK mesmo se o e-mail não existir (por segurança). Mensagem genérica.
      setMsgRec({ tipo:"ok", txt:"Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha. Verifique a caixa de entrada e o spam." });
    } catch (e) {
      setMsgRec({ tipo:"error", txt:"Não foi possível enviar agora. Tente novamente em instantes." });
    } finally {
      setEnviandoRec(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif" }}>
      <Card style={{ width: "100%", maxWidth: 380, padding: "32px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display:"inline-block", position:"relative", marginBottom:16 }}>
            <div style={{ position:"absolute", inset:-10, borderRadius:"50%",
              background:`radial-gradient(circle, ${C.gold}33 0%, transparent 70%)`,
              filter:"blur(8px)" }}/>
            <img src="/logo.png" alt="Nerd do Campo"
              style={{ width:88, height:88, borderRadius:"50%", objectFit:"cover",
                border:`3px solid ${C.gold}`, position:"relative",
                boxShadow:`0 8px 28px ${C.gold}44` }}/>
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
          <button onClick={() => { setModalRecuperar(true); setEmailRec(email); setMsgRec(null); }}
            style={{ background:"none", border:"none", color:C.dim, fontSize:13, cursor:"pointer", fontFamily:"inherit", marginTop:4, textDecoration:"underline" }}>
            Esqueci minha senha
          </button>
        </div>
        <div style={{ textAlign:"center", marginTop:24, fontSize:11, color:C.gold, letterSpacing:"0.08em", opacity:0.8 }}>
          ⚽ Designed by Caxpa Augsten
        </div>
      </Card>

      {modalRecuperar && (
        <Modal title="Recuperar senha" onClose={() => setModalRecuperar(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontSize:13, color:C.dim }}>
              Informe o e-mail cadastrado. Enviaremos um link para você criar uma nova senha.
            </div>
            <Input label="E-mail" type="email" value={emailRec} onChange={e => setEmailRec(e.target.value)} placeholder="seu@email.com"
              onKeyDown={e => e.key === "Enter" && enviarRecuperacao()} />
            {msgRec && (
              <div style={{ fontSize:13, borderRadius:8, padding:"10px 14px",
                background: msgRec.tipo === "ok" ? `${C.win}22` : `${C.loss}22`,
                border: `1px solid ${msgRec.tipo === "ok" ? C.win : C.loss}55`,
                color: msgRec.tipo === "ok" ? C.win : C.loss }}>
                {msgRec.txt}
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:4 }}>
              <Btn variant="secondary" onClick={() => setModalRecuperar(false)}>Fechar</Btn>
              <Btn onClick={enviarRecuperacao} disabled={enviandoRec}>{enviandoRec ? "Enviando..." : "Enviar link"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── LISTA DE PARTIDAS ─────────────────────────────────────────
function ListaPartidas({ temporada, onSelect, onNova, adversarios, campos, show: onShow }) {
  const { data: partidas, loading, reload } = useQuery(
    () => api.get(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo:id_campo(nome),participacao(titular,id_jogador,posicao(id_posicao,id_posicao_pai,ordem))&order=data.asc`),
    [temporada.id_temporada]
  );
  // Tipo do time e posições do tipo — para resolver a ordem do pai no esquema tático
  const { data: _timeLista } = useQuery(() => temporada?.id_time ? api.get(`time?id_time=eq.${temporada.id_time}&select=id_tipo_time,id_subtipo&limit=1`) : Promise.resolve([]), [temporada]);
  const _tipoLista = _timeLista?.[0]?.id_subtipo || _timeLista?.[0]?.id_tipo_time;
  const { data: _posLista } = useQuery(() => _tipoLista ? api.get(`posicao?id_tipo_time=eq.${_tipoLista}&select=id_posicao,id_posicao_pai,ordem`) : Promise.resolve([]), [_tipoLista]);
  const mapaPosLista = {};
  (_posLista || []).forEach(p => { mapaPosLista[p.id_posicao] = p; });

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
          id_adversario: adv?.id_adversario || null,
          data: dataISO,
          em_casa: String(row.em_casa||"NAO").toUpperCase()==="SIM"?"S":"N",
          cancelada: String(row.cancelada||"NAO").toUpperCase()==="SIM"?"S":"N",
          id_campo: campo?.id_campo || adv?.id_campo || null,
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
                hora: horaDeTS(p.data),
                em_casa: p.em_casa==="S"?"SIM":"NAO",
                cancelada: p.cancelada==="S"?"SIM":"NAO",
                campo: p.campo?.nome||"",
                gols_marcados: p.gols_marcados??(""),
                gols_sofridos: p.gols_sofridos??(""),
                observacoes: p.observacoes||"",
              })),
              [
                { key:"id_partida",    label:"id",            width:8,  descricao:"NÃO altere. Vazio = nova partida." },
                { key:"adversario",    label:"adversario",    width:25, descricao:"Nome exato do adversário cadastrado. Deixe vazio se ainda está procurando." },
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
              ["- id preenchido = atualiza partida existente", "- id vazio = cria nova partida", "- Campo deve estar cadastrado; Adversário é opcional (vazio = procurando jogo)", "- Data: DD/MM/AAAA | Hora: HH:MM"]
            )}
            onImportar={async (file) => {
              setLoadingImportPartida(true);
              try {
                const rows = await lerExcel(file);
                const erros = []; const validos = [];
                rows.forEach((row, i) => {
                  const linha = i + 2;
                  const advNome = String(row["adversario"]||"").trim();
                  let advOk = null;
                  if (advNome) {
                    advOk = (adversarios||[]).find(a => a.nome.toUpperCase() === advNome.toUpperCase());
                    if (!advOk) { erros.push({ linha, mensagem: `Adversário '${advNome}' não encontrado.` }); return; }
                  }
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
          const esq = calcularEsquema(p.participacao, mapaPosLista);
          const pendente = p.gols_marcados === null && p.cancelada !== "S";
          const procurando = !p.id_adversario && p.cancelada !== "S";
          return (
            <div key={p.id_partida}
              onClick={() => { onSelect(p); }}
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "background 0.15s", background: procurando ? "rgba(232,160,32,0.10)" : C.surface, borderRadius: 12, border: procurando ? `1px solid ${C.gold}` : `1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = procurando ? "rgba(232,160,32,0.16)" : C.surf2}
              onMouseLeave={e => e.currentTarget.style.background = procurando ? "rgba(232,160,32,0.10)" : C.surface}>
              <div style={{ minWidth: 80 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: pendente ? C.gold : C.cream }}>{fmtData(p.data)}</div>
                <div style={{ fontSize: 12, color: C.dim }}>{fmtHora(p.data)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: procurando ? C.gold : C.cream }}>{procurando ? "🔍 Procurando adversário" : (p.adversario?.nome || "A definir")}</div>
                <div style={{ fontSize: 12, color: C.dim }}>{p.em_casa === "S" ? "🏠 Casa" : "✈️ Fora"}{p.campo?.nome ? ` · ${p.campo.nome}` : ""}</div>
              </div>
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {p.gols_marcados !== null
                  ? <span style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>{p.gols_marcados} × {p.gols_sofridos}</span>
                  : <span style={{ fontSize: 13, color: C.gold }}>⏰ Aguardando</span>}
                <Badge label={res.label} cor={res.cor} />
                {esq && <span title="Esquema tático" style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: "1px", border: `1px solid ${C.border}`, borderRadius: 5, padding: "1px 7px" }}>{esq}</span>}
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
function ListaPartidasWrapper({ temporada, onSelect, onNova, show, readOnly }) {
  const { data: adversarios } = useQuery(() => temporada?.id_time ? api.get(`adversario?id_time=eq.${temporada.id_time}&select=*&order=nome.asc`) : Promise.resolve([]), [temporada]);
  const { data: campos }      = useQuery(() => temporada?.id_time ? api.get(`campo?id_time=eq.${temporada.id_time}&select=*&order=nome.asc`) : Promise.resolve([]), [temporada]);
  return <ListaPartidas temporada={temporada} onSelect={onSelect} onNova={onNova} adversarios={adversarios} campos={campos} show={show}/>;
}

// ── FORM NOVA PARTIDA ─────────────────────────────────────────
function FormNovaPartida({ temporada, onSalvo, onCancelar, readOnly = false }) {
  const { data: adversarios } = useQuery(() => temporada?.id_time ? api.get(`adversario?id_time=eq.${temporada.id_time}&select=*&order=nome.asc`) : Promise.resolve([]), [temporada]);
  const { data: campos }      = useQuery(() => temporada?.id_time ? api.get(`campo?id_time=eq.${temporada.id_time}&select=*&order=nome.asc`) : Promise.resolve([]), [temporada]);
  const { data: time }        = useQuery(() => temporada?.id_time ? api.get(`time?id_time=eq.${temporada.id_time}&select=*&limit=1`) : Promise.resolve([]), [temporada]);

  const [form, setForm] = useState({ data: "", horario: "14:00", id_adversario: "", em_casa: "S", id_campo: "", observacoes: "", link_local: "" });
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
    if (!form.data || !form.id_campo) { show("Preencha a data e o campo.", "error"); return; }
    if (!linkLocalValido(form.link_local)) { show(`Link inválido. Recebido: "${String(form.link_local).slice(0,60)}". Cole um link do mapa.`, "error"); return; }
    // Validar que a data está dentro do intervalo da temporada
    if (temporada?.data_inicio && form.data < temporada.data_inicio.split("T")[0]) {
      show(`A data não pode ser anterior ao início da temporada (${temporada.data_inicio.split("T")[0].split("-").reverse().join("/")}).`, "error"); return;
    }
    if (temporada?.data_fim && form.data > temporada.data_fim.split("T")[0]) {
      show(`A data não pode ser posterior ao fim da temporada (${temporada.data_fim.split("T")[0].split("-").reverse().join("/")}).`, "error"); return;
    }
    setSaving(true);
    try {
      // REGRA 10: não permitir 2 partidas na mesma data para o mesmo time (via temporada)
      const dataDia = form.data; // YYYY-MM-DD
      const jaTem = await api.get(`partida?id_temporada=eq.${temporada.id_temporada}&data=gte.${dataDia}T00:00:00&data=lte.${dataDia}T23:59:59&cancelada=eq.N&select=id_partida&limit=1`);
      if (jaTem && jaTem.length > 0) {
        show("Já existe uma partida cadastrada nesta data para este time.", "error");
        setSaving(false); return;
      }

      const dataTs = montarDataHoraUTC(form.data, form.horario);
      const nova = await api.post("partida", {
        id_temporada: temporada.id_temporada,
        id_adversario: form.id_adversario ? Number(form.id_adversario) : null,
        data: dataTs,
        em_casa: form.em_casa,
        id_campo: Number(form.id_campo),
        observacoes: form.observacoes,
        link_local: normalizarLink(form.link_local),
        cancelada: "N",
      });
      // REGRA 12: registrar automaticamente a participação do jogador 0 (adversário) na partida
      const idPartida = Array.isArray(nova) ? nova[0]?.id_partida : nova?.id_partida;
      if (idPartida) {
        try { await api.post("participacao", { id_partida: idPartida, id_jogador: 0, titular: "N" }); } catch {}
      }
      show(form.id_adversario ? "Partida criada!" : "Partida criada (procurando adversário)!");
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
      <Select label="Adversário (deixe em branco se ainda está procurando)" value={form.id_adversario} onChange={e => set("id_adversario", e.target.value)}>
        <option value="">🔍 Procurando adversário</option>
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
      <Input label="Link de localização (opcional)" value={form.link_local} onChange={e => set("link_local", e.target.value)} placeholder="https://maps.google.com/..." />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <Btn variant="secondary" onClick={onCancelar}>Cancelar</Btn>
        <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Criar Partida"}</Btn>
      </div>
    </div>
  );
}

// ── FICHA DA PARTIDA ──────────────────────────────────────────
// ── Compartilhar resultado: desenha um card no canvas e compartilha a imagem ──
function CompartilharResultado({ partida, gols, jogadores, time, temporada, idTime, show }) {
  const [gerando, setGerando] = useState(false);

  // dados extras para o resumo da temporada
  const { data: partidasTemp } = useQuery(
    () => temporada?.id_temporada ? api.get(`partida?id_temporada=eq.${temporada.id_temporada}&select=gols_marcados,gols_sofridos,cancelada`) : Promise.resolve([]),
    [temporada?.id_temporada]
  );
  const { data: artilheiros } = useQuery(
    () => temporada?.id_temporada ? api.get(`vw_stats_temporada?id_temporada=eq.${temporada.id_temporada}&select=*&order=gols_marcados.desc&limit=3`) : Promise.resolve([]),
    [temporada?.id_temporada]
  );

  function nomeCurto(j) { return (j?.apelido || j?.nome || "").trim(); }

  // agrupa gols e assistências do jogo por jogador → "Fulano (2), Beltrano"
  function listaGols() {
    const cont = {};
    (gols||[]).forEach(g => {
      const n = nomeCurto(g.jogador || g.participacao?.jogador);
      if (n) cont[n] = (cont[n]||0) + 1;
    });
    return Object.entries(cont).map(([n,q]) => q>1 ? `${n} (${q})` : n).join(", ");
  }
  function listaAssist() {
    const mapaJog = {};
    (jogadores||[]).forEach(j => { mapaJog[j.id_jogador] = j; });
    const cont = {};
    (gols||[]).forEach(g => {
      const a = g.id_assistente;
      if (!a) return;
      const j = mapaJog[a];
      const nome = j ? nomeCurto(j) : null;
      if (nome) cont[nome] = (cont[nome]||0) + 1;
    });
    return Object.entries(cont).map(([n,q]) => q>1 ? `${n} (${q})` : n).join(", ");
  }

  function desenharCard() {
    const W = 1080, H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // fundo gradiente
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0B3D2E"); grad.addColorStop(0.6, "#08321F"); grad.addColorStop(1, "#05130D");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    const GOLD = "#E8A020", CREAM = "#F0E8D0", DIM = "#8FAF9A", SURF = "#103D2A", WIN = "#4CAF50", LOSS = "#E53935";
    function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

    // estatísticas da temporada
    const jogadas = (partidasTemp||[]).filter(p => p.cancelada !== "S" && p.gols_marcados !== null);
    const V = jogadas.filter(p => p.gols_marcados > p.gols_sofridos).length;
    const E = jogadas.filter(p => p.gols_marcados === p.gols_sofridos).length;
    const D = jogadas.filter(p => p.gols_marcados < p.gols_sofridos).length;
    const J = jogadas.length;
    const aprov = J > 0 ? Math.round(((V*3 + E) / (J*3)) * 100) : 0;

    const PAD = 56;
    let y = 56;

    // header: escudo + nome
    ctx.fillStyle = SURF; ctx.beginPath(); ctx.arc(PAD+58, y+58, 58, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(PAD+58, y+58, 58, 0, Math.PI*2); ctx.stroke();
    ctx.font = "54px Arial"; ctx.textAlign = "center"; ctx.fillStyle = CREAM; ctx.fillText("⚽", PAD+58, y+76);
    ctx.textAlign = "left";
    ctx.fillStyle = CREAM; ctx.font = "800 44px Arial";
    ctx.fillText((time?.nome || "MEU TIME").toUpperCase().slice(0,22), PAD+140, y+50);
    ctx.fillStyle = DIM; ctx.font = "22px Arial";
    const cidade = time?.cidade?.nome ? `${time.cidade.nome} — ${time.cidade.estado||""}` : "";
    ctx.fillText(`${cidade}${cidade?" · ":""}${temporada?.nome||""}`.slice(0,46), PAD+140, y+92);
    y += 150;

    // bloco resultado
    const emCasa = partida.em_casa === "S";
    const nomeTime = time?.nome || "Meu Time";
    const nomeAdv = partida.adversario?.nome || "Adversário";
    const mandante = emCasa ? nomeTime : nomeAdv;
    const visitante = emCasa ? nomeAdv : nomeTime;
    const golsCasa = emCasa ? partida.gols_marcados : partida.gols_sofridos;
    const golsVis  = emCasa ? partida.gols_sofridos : partida.gols_marcados;

    const blocoH = 320;
    ctx.fillStyle = SURF; rr(PAD, y, W-PAD*2, blocoH, 24); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3; rr(PAD, y, W-PAD*2, blocoH, 24); ctx.stroke();

    // tag
    ctx.fillStyle = GOLD; rr(PAD+34, y+30, 330, 50, 25); ctx.fill();
    ctx.fillStyle = "#0B3D2E"; ctx.font = "800 22px Arial"; ctx.textAlign = "center";
    ctx.fillText("⚽ RESULTADO DA PARTIDA", PAD+34+165, y+63);

    // placar
    const cy = y + 150;
    ctx.fillStyle = GOLD; ctx.font = "800 92px Arial"; ctx.textAlign = "center";
    ctx.fillText(`${golsCasa} × ${golsVis}`, W/2, cy+20);
    ctx.fillStyle = CREAM; ctx.font = "800 32px Arial";
    ctx.fillText(mandante.slice(0,18), W*0.23, cy-10);
    ctx.fillText(visitante.slice(0,18), W*0.77, cy-10);
    ctx.fillStyle = DIM; ctx.font = "18px Arial";
    ctx.fillText("mandante", W*0.23, cy+22);
    ctx.fillText("visitante", W*0.77, cy+22);
    const dataFmt = partida.data ? new Date(partida.data).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}) : "";
    ctx.fillText(`${dataFmt}${partida.campo?.nome ? " · "+partida.campo.nome : ""}`.slice(0,40), W/2, cy+62);

    // gols e assistências
    ctx.font = "22px Arial"; ctx.fillStyle = CREAM;
    const g = listaGols(); const a = listaAssist();
    if (g) ctx.fillText(`⚽ Gols: ${g}`.slice(0,52), W/2, y+blocoH-46);
    if (a) ctx.fillText(`🅰️ Assist.: ${a}`.slice(0,52), W/2, y+blocoH-16);
    y += blocoH + 28;

    // título temporada
    ctx.fillStyle = GOLD; ctx.font = "800 22px Arial"; ctx.textAlign = "center";
    ctx.fillText("— COMO VAI A TEMPORADA —", W/2, y+8); y += 38;

    // 4 contadores
    const sw = (W-PAD*2-48)/4;
    const stats = [["JOGOS",J,GOLD],["VITÓRIAS",V,WIN],["EMPATES",E,GOLD],["DERROTAS",D,LOSS]];
    stats.forEach((s,i) => {
      const sx = PAD + i*(sw+16);
      ctx.fillStyle = SURF; rr(sx, y, sw, 130, 18); ctx.fill();
      ctx.fillStyle = s[2]; ctx.font = "800 50px Arial"; ctx.textAlign = "center";
      ctx.fillText(String(s[1]), sx+sw/2, y+62);
      ctx.fillStyle = DIM; ctx.font = "18px Arial";
      ctx.fillText(s[0], sx+sw/2, y+100);
    });
    y += 154;

    // aproveitamento
    ctx.fillStyle = SURF; rr(PAD, y, W-PAD*2, 130, 18); ctx.fill();
    ctx.fillStyle = DIM; ctx.font = "18px Arial"; ctx.textAlign = "left";
    ctx.fillText("APROVEITAMENTO NA TEMPORADA", PAD+28, y+34);
    // barra
    const barX = PAD+28, barY = y+52, barW = W-PAD*2-56, barH = 22;
    ctx.fillStyle = "#0B3D2E"; rr(barX, barY, barW, barH, 11); ctx.fill();
    const fillW = Math.max(barH, barW * aprov/100);
    const bg = ctx.createLinearGradient(barX, 0, barX+fillW, 0);
    bg.addColorStop(0, GOLD); bg.addColorStop(1, WIN);
    ctx.fillStyle = bg; rr(barX, barY, fillW, barH, 11); ctx.fill();
    ctx.fillStyle = GOLD; ctx.font = "800 40px Arial"; ctx.textAlign = "right";
    ctx.fillText(`${aprov}%`, W-PAD-28, y+118);
    y += 158;

    // artilheiros
    const artH = 60 + (artilheiros?.length||0)*54;
    ctx.fillStyle = SURF; rr(PAD, y, W-PAD*2, artH, 18); ctx.fill();
    ctx.fillStyle = DIM; ctx.font = "20px Arial"; ctx.textAlign = "left";
    ctx.fillText("🏆 ARTILHEIROS DA TEMPORADA", PAD+32, y+38);
    let ay = y + 78;
    (artilheiros||[]).slice(0,3).forEach((art,i) => {
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(PAD+50, ay-8, 19, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#0B3D2E"; ctx.font = "800 20px Arial"; ctx.textAlign = "center";
      ctx.fillText(String(i+1), PAD+50, ay-1);
      ctx.fillStyle = CREAM; ctx.font = "700 28px Arial"; ctx.textAlign = "left";
      ctx.fillText((art.apelido||art.nome||"").slice(0,22), PAD+85, ay);
      ctx.fillStyle = GOLD; ctx.font = "800 24px Arial"; ctx.textAlign = "right";
      ctx.fillText(`${art.gols_marcados||0} gols`, W-PAD-130, ay);
      ctx.fillStyle = DIM; ctx.font = "18px Arial";
      ctx.fillText(`· ${art.assistencias||0} assist.`, W-PAD-32, ay);
      ay += 54;
    });

    // rodapé marca
    ctx.fillStyle = CREAM; ctx.font = "800 30px Arial"; ctx.textAlign = "center";
    ctx.fillText("⚽ NERD DO CAMPO", W/2, H-72);
    ctx.fillStyle = GOLD; ctx.font = "22px Arial";
    ctx.fillText("nerddocampo.com.br", W/2, H-38);

    return canvas;
  }

  async function compartilhar() {
    setGerando(true);
    try {
      const canvas = desenharCard();
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Falha ao gerar imagem");
      const arquivo = new File([blob], "resultado-nerd-do-campo.png", { type: "image/png" });

      // tenta Web Share com arquivo (celular)
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo] });
      } else {
        // fallback: baixar a imagem
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "resultado-nerd-do-campo.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        show && show("Imagem baixada! É só anexar no grupo.", "success");
      }
    } catch (e) {
      if (e.name !== "AbortError") show && show("Não consegui compartilhar: " + e.message, "error");
    } finally { setGerando(false); }
  }

  // só aparece se a partida tem placar
  if (partida.gols_marcados === null || partida.gols_marcados === undefined) return null;

  return (
    <Btn onClick={compartilhar} disabled={gerando} style={{ fontSize:13, padding:"8px 16px" }}>
      {gerando ? "Gerando..." : "📲 Compartilhar resultado"}
    </Btn>
  );
}

// ── Convocar para a próxima partida: card de convocação + link de presença ──
function ConvocarPartida({ partida, time, idTime, show }) {
  const [gerando, setGerando] = useState(false);

  // busca o link de confirmação desta partida (se já existir)
  const { data: links, reload } = useQuery(
    () => partida?.id_partida ? api.get(`link_confirmacao?tipo=eq.partida&id_ref=eq.${partida.id_partida}&select=*&limit=1`) : Promise.resolve([]),
    [partida?.id_partida]
  );
  const urlBase = (typeof window !== "undefined") ? `${window.location.origin}/confirmar?t=` : "/confirmar?t=";

  // garante que existe um link; se não, cria e retorna o token
  async function garantirLink() {
    if (links?.[0]?.token) return links[0].token;
    const token = (crypto?.randomUUID ? crypto.randomUUID().replace(/-/g,"") : (Math.random().toString(36).slice(2)+Date.now().toString(36)));
    const expira = partida.data ? new Date(new Date(partida.data).getTime() + 24*60*60*1000).toISOString() : null;
    await api.post("link_confirmacao", { token, tipo:"partida", id_ref: partida.id_partida, id_time: idTime, expira_em: expira });
    reload();
    return token;
  }

  function desenharCard() {
    const W = 1080, H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0B3D2E"); grad.addColorStop(0.6, "#08321F"); grad.addColorStop(1, "#05130D");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    const GOLD = "#E8A020", CREAM = "#F0E8D0", DIM = "#8FAF9A", SURF = "#103D2A";
    function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

    const PAD = 56; let y = 56;
    // header
    ctx.fillStyle = SURF; ctx.beginPath(); ctx.arc(PAD+58, y+58, 58, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(PAD+58, y+58, 58, 0, Math.PI*2); ctx.stroke();
    ctx.font = "54px Arial"; ctx.textAlign = "center"; ctx.fillStyle = CREAM; ctx.fillText("⚽", PAD+58, y+76);
    ctx.textAlign = "left"; ctx.fillStyle = CREAM; ctx.font = "800 44px Arial";
    ctx.fillText((time?.nome||"MEU TIME").toUpperCase().slice(0,22), PAD+140, y+50);
    ctx.fillStyle = DIM; ctx.font = "22px Arial";
    const cidade = time?.cidade?.nome ? `${time.cidade.nome} — ${time.cidade.estado||""}` : "";
    ctx.fillText(cidade.slice(0,46), PAD+140, y+92);
    y += 165;

    // chamada
    ctx.textAlign = "center";
    ctx.fillStyle = GOLD; rr(W/2-180, y, 360, 56, 28); ctx.fill();
    ctx.fillStyle = "#0B3D2E"; ctx.font = "800 24px Arial"; ctx.fillText("📣 PRÓXIMO JOGO", W/2, y+37);
    y += 100;
    ctx.fillStyle = CREAM; ctx.font = "800 60px Arial"; ctx.fillText("É dia de BOLA!", W/2, y+20);
    y += 90;

    // confronto
    const emCasa = partida.em_casa === "S";
    const nomeTime = time?.nome || "Meu Time";
    const nomeAdv = partida.adversario?.nome || "Adversário";
    const mandante = emCasa ? nomeTime : nomeAdv;
    const visitante = emCasa ? nomeAdv : nomeTime;
    const blocoH = 230;
    ctx.fillStyle = SURF; rr(PAD, y, W-PAD*2, blocoH, 28); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3; rr(PAD, y, W-PAD*2, blocoH, 28); ctx.stroke();
    ctx.fillStyle = CREAM; ctx.font = "800 38px Arial";
    ctx.fillText(mandante.slice(0,16), W*0.27, y+105);
    ctx.fillText(visitante.slice(0,16), W*0.73, y+105);
    ctx.fillStyle = GOLD; ctx.font = "800 54px Arial"; ctx.fillText("×", W/2, y+118);
    ctx.fillStyle = DIM; ctx.font = "20px Arial";
    ctx.fillText(emCasa?"🏠 mandante":"visitante", W*0.27, y+150);
    ctx.fillText(emCasa?"visitante":"🏠 mandante", W*0.73, y+150);
    y += blocoH + 34;

    // infos: data, horário, local
    const dt = partida.data ? new Date(partida.data) : null;
    const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
    const dataTxt = dt ? `${dias[dt.getUTCDay()]}, ${dt.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",timeZone:"UTC"})}` : "A definir";
    const horaTxt = dt ? dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"}).replace(":","h") : "A definir";
    const localTxt = partida.campo?.nome || (emCasa ? (cidade||"A definir") : "Fora");
    const infos = [["📅","DATA",dataTxt],["⏰","HORÁRIO",horaTxt],["📍","LOCAL",localTxt]];
    infos.forEach(([ic,lbl,val]) => {
      ctx.fillStyle = SURF; rr(PAD, y, W-PAD*2, 96, 18); ctx.fill();
      ctx.fillStyle = "#0B3D2E"; ctx.beginPath(); ctx.arc(PAD+58, y+48, 32, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(PAD+58, y+48, 32, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = CREAM; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText(ic, PAD+58, y+59);
      ctx.textAlign = "left";
      ctx.fillStyle = DIM; ctx.font = "19px Arial"; ctx.fillText(lbl, PAD+115, y+38);
      ctx.fillStyle = CREAM; ctx.font = "800 32px Arial"; ctx.fillText(String(val).slice(0,30), PAD+115, y+72);
      y += 112;
    });
    y += 8;

    // chamada de presença
    ctx.fillStyle = SURF; rr(PAD, y, W-PAD*2, 130, 18); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; rr(PAD, y, W-PAD*2, 130, 18); ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = GOLD; ctx.font = "800 38px Arial"; ctx.fillText("✅ Você vai?", W/2, y+58);
    ctx.fillStyle = CREAM; ctx.font = "22px Arial"; ctx.fillText("Confirme sua presença no link da mensagem 👇", W/2, y+96);

    // rodapé
    ctx.fillStyle = CREAM; ctx.font = "800 30px Arial"; ctx.fillText("⚽ NERD DO CAMPO", W/2, H-72);
    ctx.fillStyle = GOLD; ctx.font = "22px Arial"; ctx.fillText("nerddocampo.com.br", W/2, H-38);
    return canvas;
  }

  async function convocar() {
    setGerando(true);
    try {
      const token = await garantirLink();
      const url = urlBase + token;
      const canvas = desenharCard();
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Falha ao gerar imagem");
      const arquivo = new File([blob], "convocacao-nerd-do-campo.png", { type: "image/png" });
      const texto = `📣 Confirme sua presença no próximo jogo:\n${url}` + (partida.link_local && partida.link_local.trim() ? `\n\n📍 Local: ${partida.link_local.trim()}` : "");

      // tenta compartilhar imagem + texto (com o link) juntos
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: texto });
      } else {
        // fallback: baixa a imagem e copia o link
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u; a.download = "convocacao-nerd-do-campo.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(u);
        if (navigator?.clipboard) { try { await navigator.clipboard.writeText(url); } catch(e){} }
        show && show("Imagem baixada e link copiado! Cole no grupo junto da imagem.", "success");
      }
    } catch (e) {
      if (e.name !== "AbortError") show && show("Não consegui convocar: " + e.message, "error");
    } finally { setGerando(false); }
  }

  // só faz sentido para partida futura (sem placar) e com adversário definido
  if (partida.gols_marcados !== null && partida.gols_marcados !== undefined) return null;
  if (!partida.id_adversario) return null;

  return (
    <Btn onClick={convocar} disabled={gerando} style={{ fontSize:13, padding:"8px 16px" }}>
      {gerando ? "Gerando..." : "📣 Convocar para o jogo"}
    </Btn>
  );
}

// ── Card de presença genérico (evento ou encontro): imagem + link ──
function CompartilharPresenca({ tipo, idRef, idTime, titulo, data, local, linkLocal, time, show }) {
  const [gerando, setGerando] = useState(false);
  const { data: links, reload } = useQuery(
    () => (tipo && idRef) ? api.get(`link_confirmacao?tipo=eq.${tipo}&id_ref=eq.${idRef}&select=*&limit=1`) : Promise.resolve([]),
    [tipo, idRef]
  );
  const urlBase = (typeof window !== "undefined") ? `${window.location.origin}/confirmar?t=` : "/confirmar?t=";

  async function garantirLink() {
    if (links?.[0]?.token) return links[0].token;
    const token = (crypto?.randomUUID ? crypto.randomUUID().replace(/-/g,"") : (Math.random().toString(36).slice(2)+Date.now().toString(36)));
    const expira = data ? new Date(new Date(data).getTime() + 24*60*60*1000).toISOString() : null;
    await api.post("link_confirmacao", { token, tipo, id_ref: idRef, id_time: idTime, expira_em: expira });
    reload();
    return token;
  }

  function desenharCard() {
    const W = 1080, H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0B3D2E"); grad.addColorStop(0.6, "#08321F"); grad.addColorStop(1, "#05130D");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    const GOLD = "#E8A020", CREAM = "#F0E8D0", DIM = "#8FAF9A", SURF = "#103D2A";
    function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

    const ehEvento = tipo === "evento";
    const PAD = 56; let y = 56;
    // header
    ctx.fillStyle = SURF; ctx.beginPath(); ctx.arc(PAD+58, y+58, 58, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(PAD+58, y+58, 58, 0, Math.PI*2); ctx.stroke();
    ctx.font = "54px Arial"; ctx.textAlign = "center"; ctx.fillStyle = CREAM; ctx.fillText(ehEvento?"🎉":"⚽", PAD+58, y+76);
    ctx.textAlign = "left"; ctx.fillStyle = CREAM; ctx.font = "800 44px Arial";
    ctx.fillText((time?.nome||"MEU TIME").toUpperCase().slice(0,22), PAD+140, y+50);
    ctx.fillStyle = DIM; ctx.font = "22px Arial";
    const cidade = time?.cidade?.nome ? `${time.cidade.nome} — ${time.cidade.estado||""}` : "";
    ctx.fillText(cidade.slice(0,46), PAD+140, y+92);
    y += 175;

    // tag + título
    ctx.textAlign = "center";
    ctx.fillStyle = GOLD; rr(W/2-200, y, 400, 56, 28); ctx.fill();
    ctx.fillStyle = "#0B3D2E"; ctx.font = "800 24px Arial";
    ctx.fillText(ehEvento ? "🎉 NOSSO EVENTO" : "⚽ NOSSO ENCONTRO", W/2, y+37);
    y += 110;
    // título (nome do evento, ou "Bora jogar!" para encontro)
    ctx.fillStyle = CREAM; ctx.font = "800 58px Arial";
    const tituloShow = (titulo && titulo.trim()) ? titulo.trim() : (ehEvento ? "Nosso evento" : "Bora jogar!");
    // quebra título em até 2 linhas se longo
    const palavras = tituloShow.split(" "); let linha = "", linhas = [];
    palavras.forEach(p => { const teste = linha ? linha+" "+p : p; if (teste.length > 18 && linha) { linhas.push(linha); linha = p; } else linha = teste; });
    if (linha) linhas.push(linha);
    linhas.slice(0,2).forEach((l,i) => { ctx.fillText(l, W/2, y + i*64); });
    y += linhas.slice(0,2).length*64 + 30;

    // infos: data, (hora), (local)
    const dt = data ? new Date(data) : null;
    const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
    const temHora = data && String(data).length > 10; // TIMESTAMPTZ tem hora; DATE não
    const dataTxt = dt ? `${dias[dt.getUTCDay()]}, ${dt.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",timeZone:"UTC"})}` : "A definir";
    const infos = [["📅","DATA",dataTxt]];
    if (temHora && dt) infos.push(["⏰","HORÁRIO", dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"}).replace(":","h")]);
    if (local && local.trim()) infos.push(["📍","LOCAL", local.trim()]);

    infos.forEach(([ic,lbl,val]) => {
      ctx.fillStyle = SURF; rr(PAD, y, W-PAD*2, 100, 18); ctx.fill();
      ctx.fillStyle = "#0B3D2E"; ctx.beginPath(); ctx.arc(PAD+60, y+50, 34, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(PAD+60, y+50, 34, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = CREAM; ctx.font = "32px Arial"; ctx.textAlign = "center"; ctx.fillText(ic, PAD+60, y+62);
      ctx.textAlign = "left";
      ctx.fillStyle = DIM; ctx.font = "20px Arial"; ctx.fillText(lbl, PAD+120, y+40);
      ctx.fillStyle = CREAM; ctx.font = "800 34px Arial"; ctx.fillText(String(val).slice(0,28), PAD+120, y+76);
      y += 120;
    });
    y += 20;

    // chamada de presença
    ctx.fillStyle = SURF; rr(PAD, y, W-PAD*2, 140, 18); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; rr(PAD, y, W-PAD*2, 140, 18); ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = GOLD; ctx.font = "800 40px Arial"; ctx.fillText("✅ Você vai?", W/2, y+62);
    ctx.fillStyle = CREAM; ctx.font = "24px Arial"; ctx.fillText("Confirme sua presença no link da mensagem 👇", W/2, y+104);

    // rodapé
    ctx.fillStyle = CREAM; ctx.font = "800 30px Arial"; ctx.fillText("⚽ NERD DO CAMPO", W/2, H-72);
    ctx.fillStyle = GOLD; ctx.font = "22px Arial"; ctx.fillText("nerddocampo.com.br", W/2, H-38);
    return canvas;
  }

  async function compartilhar() {
    setGerando(true);
    try {
      const token = await garantirLink();
      const url = urlBase + token;
      const canvas = desenharCard();
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Falha ao gerar imagem");
      const arquivo = new File([blob], "convite-nerd-do-campo.png", { type: "image/png" });
      const texto = `📣 Confirme sua presença:\n${url}` + (linkLocal && linkLocal.trim() ? `\n\n📍 Local: ${linkLocal.trim()}` : "");
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: texto });
      } else {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u; a.download = "convite-nerd-do-campo.png";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(u);
        if (navigator?.clipboard) { try { await navigator.clipboard.writeText(url); } catch(e){} }
        show && show("Imagem baixada e link copiado! Cole no grupo junto da imagem.", "success");
      }
    } catch (e) {
      if (e.name !== "AbortError") show && show("Não consegui compartilhar: " + e.message, "error");
    } finally { setGerando(false); }
  }

  return (
    <Btn onClick={compartilhar} disabled={gerando} style={{ fontSize:13, padding:"8px 16px" }}>
      {gerando ? "Gerando..." : "📣 Compartilhar convite"}
    </Btn>
  );
}

function FichaPartida({ partida: p0, onVoltar, readOnly, idTime, temporada }) {
  const [partida, setPartida] = useState(p0);
  const [editDados, setEditDados] = useState(null); // {data, hora, id_campo, link_local} quando editando
  async function salvarDadosPartida() {
    if (!editDados.data) { show("Informe a data.", "error"); return; }
    if (!linkLocalValido(editDados.link_local)) { show(`Link inválido. Recebido: "${String(editDados.link_local).slice(0,60)}". Cole um link do mapa.`, "error"); return; }
    try {
      const novaData = montarDataHoraUTC(editDados.data, editDados.hora || "12:00");
      const body = {
        data: novaData,
        id_campo: editDados.id_campo ? Number(editDados.id_campo) : null,
        link_local: normalizarLink(editDados.link_local),
      };
      await api.patch(`partida?id_partida=eq.${partida.id_partida}`, body);
      setPartida(u => ({ ...u, ...body }));
      setEditDados(null);
      show("Dados do jogo atualizados!");
    } catch (e) { show(e.message, "error"); }
  }
  const { toast, show } = useToast();

  const { data: jogadores }     = useQuery(() => idTime ? api.get(`jogador?id_jogador=gt.0&id_time=eq.${idTime}&select=*,posicao(nome)&order=camisa.asc`) : Promise.resolve([]), [idTime]);
  // Meu time: tipo, raio padrão e coordenadas da cidade-sede — declarado ANTES das queries que usam meuTipoTime (evita TDZ no bundle de produção)
  const { data: meuTimeData } = useQuery(() => idTime ? api.get(`time?id_time=eq.${idTime}&select=id_time,nome,id_tipo_time,id_subtipo,raio_busca_km,numero_titulares,quantidade_periodos,minutos_padrao_periodo,permite_acrescimos,cidade:id_cidade_sede(nome,estado,latitude,longitude)&limit=1`) : Promise.resolve([]), [idTime]);
  const meuTime = meuTimeData?.[0];
  const meuTipoTime = meuTime?.id_tipo_time;
  const meuTipoPosicoes = meuTime?.id_subtipo || meuTime?.id_tipo_time; // posições vêm do subtipo na turma
  const minhaCidade = meuTime?.cidade; // {nome, estado, latitude, longitude}
  const { data: posicoes }      = useQuery(() => meuTipoPosicoes ? api.get(`posicao?id_tipo_time=eq.${meuTipoPosicoes}&select=*&order=ordem.asc`) : Promise.resolve([]), [meuTipoPosicoes]);
  const { data: advsFicha } = useQuery(() => idTime ? api.get(`adversario?id_time=eq.${idTime}&select=id_adversario,nome&order=nome.asc`) : Promise.resolve([]), [idTime]);
  const { data: camposFicha } = useQuery(() => idTime ? api.get(`campo?id_time=eq.${idTime}&select=id_campo,nome&order=nome.asc`) : Promise.resolve([]), [idTime]);
  // Raio ajustável na tela (inicia com o padrão do time; ajuste é temporário, não salva)
  const [raioKm, setRaioKm] = useState(null);
  useEffect(() => { if (meuTime?.raio_busca_km != null && raioKm === null) setRaioKm(meuTime.raio_busca_km); }, [meuTime]);
  // Buscar times disponíveis na mesma data (partida em branco, público, mesmo tipo)
  const dataPartida = partida.data ? partida.data.split("T")[0] : null;
  const semAdversario = !(partida.id_adversario); // partida "procurando" se não tem adversário
  const [verProcurando, setVerProcurando] = useState(false); // botão: ver times procurando jogo mesmo com adversário definido
  const mostrarDisponiveis = (semAdversario || verProcurando) && !!dataPartida;
  const { data: disponiveis, loading: loadingDisp } = useQuery(
    () => mostrarDisponiveis
      ? api.get(`partida?id_adversario=is.null&cancelada=eq.N&data=gte.${dataPartida}T00:00:00&data=lte.${dataPartida}T23:59:59&select=id_partida,data,temporada(id_time,time(id_time,nome,escudo_url,telefone,resp_redes_sociais,marca_jogos,data_fundacao,publico,destaque,id_tipo_time,cidade:id_cidade_sede(nome,estado,latitude,longitude),campo:id_campo(nome)))`)
      : Promise.resolve([]),
    [mostrarDisponiveis, dataPartida]
  );
  const [modalAdv, setModalAdv] = useState(false);
  const [advSel, setAdvSel] = useState("");
  const [savingAdv, setSavingAdv] = useState(false);
  const { data: participacoes, reload: reloadPart } = useQuery(
    () => api.get(`participacao?id_partida=eq.${partida.id_partida}&id_jogador=gt.0&select=*,jogador(nome,apelido,camisa),posicao(nome,id_posicao,id_posicao_pai,ordem)&order=camisa.asc`),
    [partida.id_partida]
  );
  // Esquema tático dos titulares (ex: 4-4-2), pela posição cadastrada nesta partida.
  const mapaPosicoes = {};
  (posicoes || []).forEach(p => { mapaPosicoes[p.id_posicao] = p; });
  const esquemaTatico = calcularEsquema(participacoes, mapaPosicoes);
  const { data: gols, reload: reloadGols } = useQuery(
    () => api.get(`gol?select=*,participacao!inner(id_partida,id_jogador,jogador(nome,apelido)),jogador(nome,apelido)&participacao.id_partida=eq.${partida.id_partida}&order=periodo.asc,minuto.asc`),
    [partida.id_partida]
  );
  const idTimeP = idTime; // recebido por prop (filtrado pelo usuário logado)
  const { data: tiposMovP } = useQuery(() => idTimeP ? api.get(`tipo_movimento?id_time=eq.${idTimeP}&status=eq.Ativo&select=*&order=descricao.asc`) : Promise.resolve([]), [idTimeP]);
  const { data: movsPartida, reload: reloadMovsP } = useQuery(
    () => partida?.id_partida ? api.get(`movimento_caixa?origem=eq.partida&id_partida=eq.${partida.id_partida}&select=*,tipo_movimento(descricao)&order=id_movimento.asc`) : Promise.resolve([]),
    [partida.id_partida]
  );
  const [modalMovP, setModalMovP] = useState(false);
  const [formMovP, setFormMovP] = useState({});
  const [savingMovP, setSavingMovP] = useState(false);

  const [savingPlacar, setSavingPlacar] = useState(false);
  const [placar, setPlacar] = useState({ gols_marcados: p0.gols_marcados ?? "", gols_sofridos: p0.gols_sofridos ?? "" });
  const [modalEscalacao, setModalEscalacao] = useState(false);
  const [modalGol, setModalGol] = useState(false);
  const [editGol, setEditGol] = useState(null);

  async function salvarPlacar() {
    // REGRA 9 (parte 2): se a escalação tem MENOS titulares que o parametrizado, confirmar
    const numeroTitulares = meuTime?.numero_titulares || null;
    if (numeroTitulares) {
      const titularesEscalados = (participacoes || []).filter(p => p.titular === "S" && p.id_jogador > 0).length;
      if (titularesEscalados > 0 && titularesEscalados < numeroTitulares) {
        if (!confirm(`A escalação tem ${titularesEscalados} titulares, mas o time joga com ${numeroTitulares}. Confirmar mesmo assim? (Ex: faltaram jogadores no dia.)`)) return;
      }
    }
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

  async function definirAdversario() {
    const novoId = advSel ? Number(advSel) : null;
    const temPlacar = (partida.gols_marcados !== null && partida.gols_marcados !== undefined);
    // Ao remover adversário de partida com placar/gols, avisar que tudo será apagado
    if (!novoId && temPlacar) {
      if (!confirm("Esta partida já tem placar e gols lançados. Ao remover o adversário, o resultado, os gols e a escalação desta partida serão APAGADOS. Deseja continuar?")) return;
    }
    setSavingAdv(true);
    try {
      if (novoId) {
        // Definir/trocar adversário (não mexe em placar/escalação)
        await api.patch(`partida?id_partida=eq.${partida.id_partida}`, { id_adversario: novoId });
        const adv = (advsFicha || []).find(a => String(a.id_adversario) === String(advSel));
        setPartida(u => ({ ...u, id_adversario: novoId, adversario: adv ? { nome: adv.nome } : u.adversario }));
        show("Adversário definido!");
      } else {
        // Remover adversário: apaga gols + participações + zera placar e remove o campo
        const parts = await api.get(`participacao?id_partida=eq.${partida.id_partida}&select=id_participacao`);
        const ids = (parts || []).map(p => p.id_participacao);
        if (ids.length) {
          // 1) deletar gols dessas participações
          await api.delete(`gol?id_participacao=in.(${ids.join(",")})`);
          // 2) deletar as participações
          await api.delete(`participacao?id_partida=eq.${partida.id_partida}`);
        }
        // 3) zerar adversário, placar e campo da partida
        await api.patch(`partida?id_partida=eq.${partida.id_partida}`, {
          id_adversario: null, id_campo: null, gols_marcados: null, gols_sofridos: null,
        });
        setPartida(u => ({ ...u, id_adversario: null, adversario: null, id_campo: null, gols_marcados: null, gols_sofridos: null }));
        setPlacar({ gols_marcados: "", gols_sofridos: "" });
        show("Adversário removido — partida procurando jogo.");
      }
      setModalAdv(false); setAdvSel("");
    } catch (e) { show(e.message, "error"); }
    finally { setSavingAdv(false); }
  }

  async function removerGol(id_gol) {
    if (!confirm("Remover este gol?")) return;
    try {
      await api.delete(`gol?id_gol=eq.${id_gol}`);
      show("Gol removido."); reloadGols();
    } catch (e) { show(e.message, "error"); }
  }

  function abrirMovP() {
    setFormMovP({ id_tipo_movimento:"", valor:"", data_movimento: (partida.data ? partida.data.split("T")[0] : new Date().toISOString().split("T")[0]), observacao:"" });
    setModalMovP(true);
  }
  async function salvarMovP() {
    const tipo = (tiposMovP||[]).find(t => String(t.id_tipo_movimento)===String(formMovP.id_tipo_movimento));
    if (!tipo) { show("Selecione o tipo.", "error"); return; }
    if (!formMovP.valor || Number(formMovP.valor)<=0) { show("Informe um valor válido.", "error"); return; }
    setSavingMovP(true);
    try {
      await api.post(`movimento_caixa`, {
        id_time: idTimeP, id_tipo_movimento: tipo.id_tipo_movimento, natureza: tipo.natureza,
        valor: Number(formMovP.valor), data_movimento: formMovP.data_movimento,
        observacao: formMovP.observacao||null, origem:"partida", id_partida: partida.id_partida,
        registrado_por: emailUsuarioLogado(),
      });
      show("Lançamento adicionado!"); setModalMovP(false); reloadMovsP();
    } catch(e){ show("Erro: "+e.message, "error"); }
    finally { setSavingMovP(false); }
  }
  async function removerMovP(m) {
    if (!confirm("Remover este lançamento?")) return;
    try { await api.delete(`movimento_caixa?id_movimento=eq.${m.id_movimento}`); show("Removido."); reloadMovsP(); }
    catch(e){ show("Erro: "+e.message, "error"); }
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
            {partida.id_adversario ? (
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {partida.adversario?.nome || "Adversário"}
                {!readOnly && <button onClick={() => { setAdvSel(String(partida.id_adversario || "")); setModalAdv(true); }} title="Trocar ou remover adversário" style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 6, padding: "2px 8px", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ alterar</button>}
              </div>
            ) : (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>🔍 Procurando adversário</div>
                {!readOnly && <button onClick={() => { setAdvSel(""); setModalAdv(true); }} style={{ marginTop: 6, background: "none", border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 8, padding: "4px 12px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Definir adversário</button>}
              </div>
            )}
            <div style={{ fontSize: 13, color: C.dim }}>🏟️ {partida.campo?.nome || (partida.id_campo ? p0.campo?.nome : "")}</div>
            {partida.observacoes && <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>📝 {partida.observacoes}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <Badge label={res.label} cor={res.cor} />
            {esquemaTatico && (
              <div title="Esquema tático dos titulares (sem o goleiro)" style={{ background: C.surf2, border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 8, padding: "4px 12px", fontSize: 14, fontWeight: 800, letterSpacing: "2px" }}>
                {esquemaTatico}
              </div>
            )}
            {!cancelada && (
              <CompartilharResultado partida={partida} gols={gols} jogadores={jogadores} time={meuTimeData?.[0]} temporada={temporada} idTime={idTime} show={show}/>
            )}
            {!cancelada && (
              <ConvocarPartida partida={partida} time={meuTimeData?.[0]} idTime={idTime} show={show}/>
            )}
            {!cancelada && !readOnly && (
              <Btn variant="secondary" style={{ fontSize: 11, padding: "6px 12px" }} onClick={()=>setEditDados({ data: dataDeTS(partida.data), hora: horaDeTS(partida.data), id_campo: partida.id_campo ? String(partida.id_campo) : "", link_local: partida.link_local || "" })}>📅 Editar dados</Btn>
            )}
            {!cancelada && (
              <Btn variant="danger" style={{ fontSize: 11, padding: "6px 12px" }} onClick={cancelarPartida}>Cancelar Partida</Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Botão: ver times procurando jogo nesta data (quando a partida JÁ tem adversário) */}
      {!cancelada && !semAdversario && dataPartida && (
        <button onClick={() => setVerProcurando(v => !v)}
          style={{ alignSelf: "flex-start", background: verProcurando ? C.surf2 : "none", border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 8, padding: "8px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          🔍 {verProcurando ? "Ocultar" : "Ver"} times procurando jogo nesta data
        </button>
      )}

      {/* Link de confirmação de presença */}
      {!readOnly && !cancelada && <LinkConfirmacao tipo="partida" idRef={partida.id_partida} idTime={idTime} dataRef={partida.data} show={show} />}

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
                        <td style={{ padding: "10px 12px" }}><CamisaCell pa={pa} reload={reloadPart} show={show} readOnly={readOnly} /></td>
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>{pa.jogador?.apelido || pa.jogador?.nome}</td>
                        <td style={{ padding: "10px 12px" }}><PosicaoCell pa={pa} posicoes={posicoes} reload={reloadPart} show={show} readOnly={readOnly} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><ToggleCell pa={pa} field="titular" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><ToggleCell pa={pa} field="capitao" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><NumCell pa={pa} field="cartao_amarelo" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><NumCell pa={pa} field="cartao_vermelho" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><NumCell pa={pa} field="gols_contra" reload={reloadPart} show={show} /></td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={() => !readOnly && removerParticipacao(pa.id_participacao)} style={{ background: "none", border: "none", color: C.loss, cursor: "pointer", fontSize: 16 }}>✕</button>
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
                  const ehAdv = g.participacao?.id_jogador === 0;
                  const nome = ehAdv ? "Adversário" : (j?.apelido || j?.nome || "?");
                  const assist = g.jogador;
                  return (
                    <div key={g.id_gol} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: C.surf2, borderRadius: 8 }}>
                      <span style={{ fontSize: 18 }}>⚽</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, color: C.gold }}>{nome}</span>
                        {ehAdv ? <Badge label="Gol contra a nosso favor" cor={C.win} style={{ marginLeft: 6 }} />
                               : g.gol_contra === "S" && <Badge label="GC" cor={C.loss} style={{ marginLeft: 6 }} />}
                        {!ehAdv && g.penalti === "S" && <Badge label="Pen" cor={C.draw} style={{ marginLeft: 6 }} />}
                        {assist && <span style={{ color: C.win, fontSize: 13, marginLeft: 8 }}>🅰️ {assist.apelido || assist.nome}</span>}
                      </div>
                      <span style={{ color: C.dim, fontSize: 13 }}>{g.periodo}° · {g.minuto}'</span>
                      <button onClick={() => !readOnly && removerGol(g.id_gol)} style={{ background: "none", border: "none", color: C.loss, cursor: "pointer", fontSize: 16 }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )
          }
        </Card>
      )}

      {/* Times disponíveis nesta data (quando procurando adversário OU quando o admin clica em "ver times procurando") */}
      {mostrarDisponiveis && partida.cancelada !== "S" && (() => {
        // Sei calcular distância? (meu time precisa ter cidade-sede com coordenadas)
        const temCoordenadas = !!(minhaCidade?.latitude != null && minhaCidade?.longitude != null);
        const raioAtual = raioKm ?? 50;
        // Filtra: público, mesmo tipo, não o próprio time; dedupe; calcula distância
        const vistos = new Set();
        let times = [];
        for (const pt of (disponiveis || [])) {
          const t = pt.temporada?.time;
          if (!t) continue;
          if (t.id_time === idTime) continue;
          if (t.publico === false) continue;
          if (meuTipoTime && t.id_tipo_time !== meuTipoTime) continue;
          if (vistos.has(t.id_time)) continue;
          vistos.add(t.id_time);
          const dist = temCoordenadas ? distanciaKm(minhaCidade.latitude, minhaCidade.longitude, t.cidade?.latitude, t.cidade?.longitude) : null;
          times.push({ ...t, _dist: dist });
        }
        // Se sei calcular distância, filtra pelo raio. Times sem coordenada calculável
        // (sem cidade-sede definida) são ocultados, pois não dá para saber se estão no raio.
        let semLocalizacao = 0;
        if (temCoordenadas) {
          semLocalizacao = times.filter(t => t._dist == null).length;
          times = times.filter(t => t._dist != null && t._dist <= raioAtual);
          // Destaque primeiro; depois por distância
          times.sort((a, b) => (b.destaque === true) - (a.destaque === true) || a._dist - b._dist);
        } else {
          // Sem coordenadas: ao menos destaque vem primeiro, depois alfabético
          times.sort((a, b) => (b.destaque === true) - (a.destaque === true) || (a.nome || "").localeCompare(b.nome || ""));
        }
        return (
          <Card style={{ padding: "20px 24px", marginTop: 16 }}>
            <div style={{ fontSize: 13, color: C.gold, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>
              🤝 Times disponíveis nesta data
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>
              Outros times do mesmo tipo que também têm {fmtData(partida.data)} livre. Entre em contato para combinar o jogo.
            </div>
            {!temCoordenadas && (
              <div style={{ fontSize: 12, color: C.gold, background: C.gold + "18", border: `1px solid ${C.gold}55`, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                ⚠️ Defina a Cidade Sede do seu time (em Meu Time) para filtrar adversários por distância. Mostrando todos por enquanto.
              </div>
            )}
            {temCoordenadas && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: C.dim }}>Raio de busca:</span>
                <input type="number" min="1" step="5" value={raioAtual} onChange={e => setRaioKm(Number(e.target.value) || 1)}
                  style={{ width: 80, background: C.surf2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.cream, fontFamily: "inherit", fontSize: 13, padding: "6px 10px", outline: "none" }} />
                <span style={{ fontSize: 12, color: C.dim }}>km a partir de {minhaCidade.nome}</span>
              </div>
            )}
            {temCoordenadas && semLocalizacao > 0 && (
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 12, fontStyle: "italic" }}>
                {semLocalizacao} {semLocalizacao === 1 ? "time disponível foi ocultado" : "times disponíveis foram ocultados"} por não ter cidade sede definida.
              </div>
            )}
            {loadingDisp ? <Spinner /> : times.length === 0 ? (
              <div style={{ color: C.dim, fontSize: 13 }}>{temCoordenadas ? `Nenhum time disponível nesta data dentro de ${raioAtual} km. Tente aumentar o raio.` : "Nenhum time disponível nesta data por enquanto."}</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
                {times.map(t => (
                  <div key={t.id_time} style={{ background: C.surface, borderRadius: 12, padding: "18px 16px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                    {t.escudo_url
                      ? <img src={t.escudo_url} alt={t.nome} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.gold}`, margin: "0 auto 10px", display: "block" }} />
                      : <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.surf2, border: `2px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 22 }}>⚽</div>
                    }
                    <div style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>{t.nome}</div>
                    {t._dist != null && <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, marginBottom: 4 }}>📏 ~{t._dist} km</div>}
                    {t.cidade && <div style={{ fontSize: 12, color: C.dim, marginBottom: 3 }}>📍 <span style={{ color: C.cream }}>{t.cidade.nome}{t.cidade.estado ? ` — ${t.cidade.estado}` : ""}</span></div>}
                    {t.campo && <div style={{ fontSize: 12, color: C.dim, marginBottom: 3 }}>🏟️ <span style={{ color: C.cream }}>{t.campo.nome}</span></div>}
                    {t.marca_jogos && <div style={{ fontSize: 12, color: C.dim, marginBottom: 3 }}>📋 <span style={{ color: C.cream }}>{t.marca_jogos}</span></div>}
                    {t.telefone && <div style={{ fontSize: 13, color: C.dim, marginBottom: 2 }}>📞 <span style={{ color: C.cream, fontWeight: 700 }}>{t.telefone}</span></div>}
                    {t.resp_redes_sociais && <div style={{ fontSize: 12, color: C.dim }}>📱 <span style={{ color: C.cream }}>{t.resp_redes_sociais}</span></div>}
                    {!t.telefone && !t.resp_redes_sociais && <div style={{ fontSize: 11, color: C.dim, fontStyle: "italic" }}>Sem contato cadastrado</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      {/* Financeiro da Partida */}
      {partida.cancelada !== "S" && (() => {
        const receitas = (movsPartida||[]).filter(m=>m.natureza==="receita").reduce((s,m)=>s+Number(m.valor||0),0);
        const despesas = (movsPartida||[]).filter(m=>m.natureza==="despesa").reduce((s,m)=>s+Number(m.valor||0),0);
        const saldo = receitas - despesas;
        return (
          <Card style={{ padding:"20px 24px", marginTop:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:8 }}>
              <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700 }}>
                💵 Financeiro da Partida
              </div>
              {!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={abrirMovP}>+ Lançar receita/despesa</Btn>}
            </div>
            {(movsPartida||[]).length === 0 ? (
              <div style={{ color:C.dim, fontSize:13 }}>Nenhum lançamento financeiro nesta partida.</div>
            ) : (
              <>
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                  {(movsPartida||[]).map(m => (
                    <div key={m.id_movimento} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                      <span style={{ color:C.cream }}>{m.tipo_movimento?.descricao}{m.observacao?<span style={{ color:C.dim }}> — {m.observacao}</span>:""}</span>
                      <span style={{ display:"flex", gap:12, alignItems:"center" }}>
                        <span style={{ color: m.natureza==="receita"?C.win:C.loss, fontWeight:700 }}>{m.natureza==="receita"?"+":"−"} {fmtMoeda(m.valor)}</span>
                        {!readOnly && <button onClick={()=>removerMovP(m)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:14 }}>✕</button>}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:16, justifyContent:"flex-end", fontSize:13 }}>
                  <span style={{ color:C.win }}>Receitas: {fmtMoeda(receitas)}</span>
                  <span style={{ color:C.loss }}>Despesas: {fmtMoeda(despesas)}</span>
                  <span style={{ fontWeight:800, color: saldo>=0?C.gold:C.loss }}>Saldo: {fmtMoeda(saldo)}</span>
                </div>
              </>
            )}
          </Card>
        );
      })()}

      {/* Modais */}
      {editDados && (
        <Modal title="Editar dados do jogo" onClose={() => setEditDados(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Data" type="date" value={editDados.data} onChange={e=>setEditDados(d=>({...d, data:e.target.value}))}/>
              <Input label="Horário" type="time" value={editDados.hora} onChange={e=>setEditDados(d=>({...d, hora:e.target.value}))}/>
            </div>
            <Select label="Campo" value={editDados.id_campo} onChange={e=>setEditDados(d=>({...d, id_campo:e.target.value}))}>
              <option value="">Sem campo definido</option>
              {(camposFicha||[]).map(c=><option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
            </Select>
            <Input label="Link de localização (opcional)" placeholder="https://maps.google.com/..." value={editDados.link_local} onChange={e=>setEditDados(d=>({...d, link_local:e.target.value}))}/>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={()=>setEditDados(null)}>Cancelar</Btn>
              <Btn onClick={salvarDadosPartida}>Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}
      {modalAdv && (
        <Modal title={partida.id_adversario || p0.id_adversario ? "Trocar ou Remover Adversário" : "Definir Adversário"} onClose={() => setModalAdv(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Select label="Adversário" value={advSel} onChange={e => setAdvSel(e.target.value)}>
              <option value="">🔍 Procurando adversário (deixar em branco)</option>
              {(advsFicha || []).map(a => <option key={a.id_adversario} value={a.id_adversario}>{a.nome}</option>)}
            </Select>
            <div style={{ fontSize: 12, color: C.dim }}>Deixe em branco para liberar a data e procurar outro time. Não encontrou o adversário? Cadastre-o primeiro em Adversários.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="secondary" onClick={() => setModalAdv(false)}>Cancelar</Btn>
              <Btn onClick={definirAdversario} disabled={savingAdv}>{savingAdv ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
      {modalMovP && (
        <Modal title="Lançar Movimento — Partida" onClose={() => setModalMovP(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Select label="Tipo (receita/despesa)" value={formMovP.id_tipo_movimento} onChange={e=>setFormMovP(f=>({...f,id_tipo_movimento:e.target.value}))}>
              <option value="">Selecione...</option>
              <optgroup label="Receitas">
                {(tiposMovP||[]).filter(t=>t.natureza==="receita").map(t=><option key={t.id_tipo_movimento} value={t.id_tipo_movimento}>{t.descricao}</option>)}
              </optgroup>
              <optgroup label="Despesas">
                {(tiposMovP||[]).filter(t=>t.natureza==="despesa").map(t=><option key={t.id_tipo_movimento} value={t.id_tipo_movimento}>{t.descricao}</option>)}
              </optgroup>
            </Select>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Valor (R$)" type="number" min="0" step="0.01" value={formMovP.valor||""} onChange={e=>setFormMovP(f=>({...f,valor:e.target.value}))}/>
              <Input label="Data" type="date" value={formMovP.data_movimento||""} onChange={e=>setFormMovP(f=>({...f,data_movimento:e.target.value}))}/>
            </div>
            <Input label="Observação" value={formMovP.observacao||""} onChange={e=>setFormMovP(f=>({...f,observacao:e.target.value}))}/>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <Btn variant="secondary" onClick={()=>setModalMovP(false)}>Cancelar</Btn>
              <Btn onClick={salvarMovP} disabled={savingMovP}>{savingMovP?"Salvando...":"Adicionar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
      {modalEscalacao && (
        <Modal title="Adicionar Jogador" onClose={() => setModalEscalacao(false)}>
          <FormEscalacao
            partida={partida}
            jogadores={jogadores || []}
            posicoes={posicoes || []}
            participacoes={participacoes || []}
            meuTime={meuTime}
            onSalvo={() => { setModalEscalacao(false); reloadPart(); show("Jogador adicionado!"); }}
            show={show}
            readOnly={readOnly}
          />
        </Modal>
      )}
      {modalGol && (
        <Modal title="Registrar Gol" onClose={() => setModalGol(false)}>
          <FormGol
            partida={partida}
            participacoes={participacoes || []}
            jogadores={jogadores || []}
            meuTime={meuTime}
            onSalvo={() => { setModalGol(false); reloadGols(); show("Gol registrado!"); }}
            show={show}
            readOnly={readOnly}
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
// Célula editável de camisa (input inline)
function CamisaCell({ pa, reload, show, readOnly }) {
  const [val, setVal] = useState(pa.camisa || "");
  const [editando, setEditando] = useState(false);
  async function salvar() {
    setEditando(false);
    if (String(val) === String(pa.camisa || "")) return;
    try { await api.patch(`participacao?id_participacao=eq.${pa.id_participacao}`, { camisa: val || null }); reload(); }
    catch (e) { show(e.message, "error"); }
  }
  if (readOnly) return <span style={{ fontWeight:800, color:C.gold }}>{pa.camisa}</span>;
  return editando
    ? <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={salvar} onKeyDown={e => e.key==="Enter" && salvar()}
        style={{ width:42, background:C.bg, border:`1px solid ${C.gold}`, borderRadius:4, color:C.cream, fontSize:13, padding:"4px 6px", fontFamily:"inherit", textAlign:"center" }} />
    : <span onClick={() => setEditando(true)} style={{ fontWeight:800, color:C.gold, cursor:"pointer", borderBottom:`1px dotted ${C.gold}66` }}>{pa.camisa || "—"}</span>;
}
// Célula editável de posição (select inline)
function PosicaoCell({ pa, posicoes, reload, show, readOnly }) {
  const [editando, setEditando] = useState(false);
  async function muda(novo) {
    setEditando(false);
    try { await api.patch(`participacao?id_participacao=eq.${pa.id_participacao}`, { id_posicao: novo ? Number(novo) : null }); reload(); }
    catch (e) { show(e.message, "error"); }
  }
  if (readOnly) return <span style={{ color:C.dim, fontSize:13 }}>{pa.posicao?.nome}</span>;
  const idsComFilhas = new Set((posicoes||[]).filter(p => p.id_posicao_pai).map(p => p.id_posicao_pai));
  const opcoes = (posicoes||[]).filter(p => p.id_posicao_pai || !idsComFilhas.has(p.id_posicao));
  return editando
    ? <select autoFocus defaultValue={pa.id_posicao || ""} onChange={e => muda(e.target.value)} onBlur={() => setEditando(false)}
        style={{ background:C.bg, border:`1px solid ${C.gold}`, borderRadius:4, color:C.cream, fontSize:12, padding:"4px 6px", fontFamily:"inherit" }}>
        <option value="">—</option>
        {opcoes.map(p => <option key={p.id_posicao} value={p.id_posicao}>{p.nome}</option>)}
      </select>
    : <span onClick={() => setEditando(true)} style={{ color:C.dim, fontSize:13, cursor:"pointer", borderBottom:`1px dotted ${C.dim}66` }}>{pa.posicao?.nome || "—"}</span>;
}

function FormEscalacao({ partida, jogadores, posicoes, participacoes, meuTime, onSalvo, show, readOnly = false }) {
  const jaEscalados = new Set((participacoes).map(p => p.id_jogador));
  const disponiveis = jogadores.filter(j => !jaEscalados.has(j.id_jogador));

  const [form, setForm] = useState({ id_jogador: "", camisa: "", id_posicao: "", titular: "S", capitao: "N" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const numeroTitulares = meuTime?.numero_titulares || null;
  const titularesAtuais = (participacoes || []).filter(p => p.titular === "S" && p.id_jogador > 0).length;

  // Traz confirmados "Vou" (jogadores cadastrados) como reservas. Convidados ignorados.
  // Entram como reserva (titular "N") para não estourar o limite de titulares; o admin promove.
  async function trazerConfirmados() {
    setSaving(true);
    try {
      const links = await api.get(`link_confirmacao?tipo=eq.partida&id_ref=eq.${partida.id_partida}&select=id_link&limit=1`);
      if (!links?.[0]) { show("Nenhum link de confirmação foi gerado para esta partida.", "error"); setSaving(false); return; }
      const confs = await api.get(`confirmacao_presenca?id_link=eq.${links[0].id_link}&status=eq.vou&id_jogador=not.is.null&select=id_jogador`);
      const aAdicionar = (confs||[]).filter(c => !jaEscalados.has(c.id_jogador));
      const convidados = await api.get(`confirmacao_presenca?id_link=eq.${links[0].id_link}&status=eq.vou&id_jogador=is.null&select=id_confirmacao`);
      if (aAdicionar.length === 0) {
        show((convidados||[]).length > 0 ? `Todos os jogadores confirmados já estão escalados. ${convidados.length} convidado(s) ignorados.` : "Nenhum jogador novo confirmado para trazer.");
        setSaving(false); return;
      }
      for (const c of aAdicionar) {
        const jog = jogadores.find(j => j.id_jogador === c.id_jogador);
        await api.post("participacao", {
          id_partida: partida.id_partida, id_jogador: c.id_jogador,
          camisa: jog?.camisa || "", id_posicao: jog?.id_posicao || null,
          titular: "N", capitao: "N", cartao_amarelo: 0, cartao_vermelho: 0, gols_contra: 0,
        });
      }
      const aviso = (convidados||[]).length > 0 ? ` (${convidados.length} convidado(s) ignorado(s))` : "";
      show(`${aAdicionar.length} confirmado(s) adicionado(s) como reserva — promova a titular conforme necessário.${aviso}`);
      onSalvo();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  useEffect(() => {
    if (form.id_jogador) {
      const j = jogadores.find(j => j.id_jogador === Number(form.id_jogador));
      if (j) setForm(f => ({ ...f, camisa: j.camisa || "", id_posicao: j.id_posicao ? String(j.id_posicao) : "" }));
    }
  }, [form.id_jogador]);

  async function salvar() {
    if (!form.id_jogador) { show("Selecione um jogador.", "error"); return; }

    // REGRA 13: não escalar em partida cancelada
    if (partida.cancelada === "S") { show("Esta partida está cancelada. Não é possível adicionar jogadores.", "error"); return; }

    // REGRA 2b: camisa não pode repetir na mesma partida
    if (form.camisa) {
      const camisaUsada = (participacoes || []).some(p => p.id_jogador > 0 && String(p.camisa) === String(form.camisa));
      if (camisaUsada) {
        show(`A camisa ${form.camisa} já está sendo usada por outro jogador nesta partida.`, "error"); return;
      }
    }

    // REGRA 9: número de titulares parametrizado
    if (form.titular === "S" && numeroTitulares) {
      if (titularesAtuais >= numeroTitulares) {
        show(`Este time joga com ${numeroTitulares} titulares e a escalação já está completa. Adicione como reserva ou ajuste a escalação.`, "error"); return;
      }
    }

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
      {numeroTitulares && (
        <div style={{ fontSize: 12, color: titularesAtuais >= numeroTitulares ? C.gold : C.dim, background: C.surf2, borderRadius: 8, padding: "8px 12px" }}>
          Titulares: {titularesAtuais} de {numeroTitulares}
        </div>
      )}
      <Select label="Jogador *" value={form.id_jogador} onChange={e => set("id_jogador", e.target.value)}>
        <option value="">Selecione...</option>
        {disponiveis.map(j => <option key={j.id_jogador} value={j.id_jogador}>#{j.camisa} — {j.apelido || j.nome}</option>)}
      </Select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Camisa" value={form.camisa} onChange={e => set("camisa", e.target.value)} />
        <Select label="Posição" value={form.id_posicao} onChange={e => set("id_posicao", e.target.value)}>
          <option value="">Selecione...</option>
          {(() => {
            // IDs que são grupos-pai (têm filhas) — esses não são selecionáveis, só organizam.
            const idsComFilhas = new Set(posicoes.filter(p => p.id_posicao_pai).map(p => p.id_posicao_pai));
            // Selecionáveis: posições planas (sem pai e sem filhas) + posições filhas.
            return posicoes
              .filter(p => p.id_posicao_pai || !idsComFilhas.has(p.id_posicao))
              .map(p => <option key={p.id_posicao} value={p.id_posicao}>{p.nome}</option>);
          })()}
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
        <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Adicionar"}</Btn>
        {!readOnly && <Btn variant="secondary" onClick={trazerConfirmados} disabled={saving}>📲 Trazer confirmados</Btn>}
      </div>
    </div>
  );
}

// ── FORM GOL ──────────────────────────────────────────────────
function FormGol({ partida, participacoes, jogadores, meuTime, onSalvo, show, readOnly = false }) {
  const [form, setForm] = useState({ id_participacao: "", periodo: "1", minuto: "", penalti: "N", gol_contra: "N", id_assistente: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Parâmetros do time (com defaults seguros caso não definidos)
  const qtdPeriodos   = meuTime?.quantidade_periodos || 2;
  const minPorPeriodo = meuTime?.minutos_padrao_periodo || 45;
  const permiteAcres  = (meuTime?.permite_acrescimos || "N") === "S";

  // Garante uma participação do "jogador 0 - Adversário" (global) nesta partida e devolve o id_participacao
  async function obterParticipacaoAdversario() {
    const existentes = await api.get(`participacao?id_partida=eq.${partida.id_partida}&id_jogador=eq.0&select=id_participacao&limit=1`);
    if (existentes?.[0]?.id_participacao) return existentes[0].id_participacao;
    const nova = await api.post(`participacao`, { id_partida: partida.id_partida, id_jogador: 0, titular: "N" });
    const id = Array.isArray(nova) ? nova[0]?.id_participacao : nova?.id_participacao;
    if (id) return id;
    const rb = await api.get(`participacao?id_partida=eq.${partida.id_partida}&id_jogador=eq.0&select=id_participacao&limit=1`);
    return rb?.[0]?.id_participacao;
  }

  async function salvar() {
    const ehAdversario = form.id_participacao === "ADVERSARIO";
    if ((!form.id_participacao) || !form.minuto) { show("Selecione quem fez o gol e o minuto.", "error"); return; }

    // REGRA 13: não registrar em partida cancelada
    if (partida.cancelada === "S") { show("Esta partida está cancelada. Não é possível registrar gols.", "error"); return; }

    const periodo = Number(form.periodo);
    const minuto  = Number(form.minuto);

    // REGRA 6: período não pode passar do número de períodos do time
    if (periodo > qtdPeriodos) {
      show(`Este time joga com ${qtdPeriodos} período(s). O período ${periodo} é inválido.`, "error"); return;
    }
    if (periodo < 1) { show("Período inválido.", "error"); return; }

    // REGRA 4: acréscimos — gol após o tempo padrão do período
    if (minuto > minPorPeriodo) {
      if (!permiteAcres) {
        show(`Este time não permite acréscimos. O minuto não pode passar de ${minPorPeriodo} (tempo padrão do período).`, "error"); return;
      } else {
        if (!confirm(`O minuto ${minuto} é maior que o tempo padrão do período (${minPorPeriodo} min). Registrar como acréscimo?`)) return;
      }
    }

    setSaving(true);
    try {
      let idParticipacao;
      if (ehAdversario) {
        idParticipacao = await obterParticipacaoAdversario();
        if (!idParticipacao) throw new Error("Não foi possível registrar o gol do adversário.");
      } else {
        idParticipacao = Number(form.id_participacao);
      }
      await api.post("gol", {
        id_participacao: idParticipacao,
        periodo: periodo,
        minuto: minuto,
        penalti: ehAdversario ? "N" : form.penalti,
        gol_contra: ehAdversario ? "S" : form.gol_contra,
        id_assistente: (!ehAdversario && form.id_assistente) ? Number(form.id_assistente) : null,
      });
      onSalvo();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  const ehAdversario = form.id_participacao === "ADVERSARIO";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Select label="Quem fez o gol *" value={form.id_participacao} onChange={e => set("id_participacao", e.target.value)}>
        <option value="">Selecione...</option>
        {participacoes.map(pa => <option key={pa.id_participacao} value={pa.id_participacao}>#{pa.camisa} — {pa.jogador?.apelido || pa.jogador?.nome}</option>)}
        <option value="ADVERSARIO">⚽ Gol contra do adversário (a nosso favor)</option>
      </Select>
      {ehAdversario && (
        <div style={{ fontSize: 12, color: C.dim, background: C.surf2, borderRadius: 8, padding: "8px 12px" }}>
          Este gol conta no placar a favor do seu time e não é atribuído a nenhum jogador do seu elenco. Informe apenas o período e o minuto.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Select label="Período *" value={form.periodo} onChange={e => set("periodo", e.target.value)}>
          {Array.from({ length: qtdPeriodos }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}º período</option>)}
        </Select>
        <Input label={`Minuto * (padrão até ${minPorPeriodo})`} type="number" min="1" value={form.minuto} onChange={e => set("minuto", e.target.value)} />
      </div>
      {!ehAdversario && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="Pênalti?" value={form.penalti} onChange={e => set("penalti", e.target.value)}>
            <option value="N">Não</option><option value="S">Sim</option>
          </Select>
          <Select label="Gol Contra?" value={form.gol_contra} onChange={e => set("gol_contra", e.target.value)}>
            <option value="N">Não</option><option value="S">Sim</option>
          </Select>
        </div>
      )}
      {!ehAdversario && (
        <Select label="Assistência (opcional)" value={form.id_assistente} onChange={e => set("id_assistente", e.target.value)}>
          <option value="">Sem assistência</option>
          {jogadores.map(j => <option key={j.id_jogador} value={j.id_jogador}>#{j.camisa} — {j.apelido || j.nome}</option>)}
        </Select>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Registrar Gol"}</Btn>
      </div>
    </div>
  );
}

// ── APP ADMIN ─────────────────────────────────────────────────
const MENU_BASE = [
  { id:"inicio",      label:"Início",      icon:"🏠", grupo:"" },
  { id:"time",        label:"Meu Time",    icon:"⚙️", grupo:"Configurar" },
  { id:"temporadas",  label:"Temporadas",  icon:"📆", grupo:"Configurar" },
  { id:"campos",      label:"Campos",      icon:"🏟️", grupo:"Cadastros" },
  { id:"posicoes",    label:"Posições",    icon:"🎯", grupo:"Cadastros" },
  { id:"adversarios", label:"Adversários", icon:"⚔️", grupo:"Cadastros" },
  { id:"jogadores",   label:"Jogadores",   icon:"👕", grupo:"Cadastros" },
  { id:"partidas",    label:"Partidas",    icon:"📅", grupo:"Jogos" },
  { id:"tiposmov",    label:"Tipos de Mov.", icon:"🏷️", grupo:"Financeiro" },
  { id:"mensalidades",label:"Mensalidades", icon:"💰", grupo:"Financeiro" },
  { id:"caixa",       label:"Caixa",        icon:"💵", grupo:"Financeiro" },
  { id:"eventos",     label:"Eventos",      icon:"🎉", grupo:"Financeiro" },
  { id:"app",         label:"Visão App",   icon:"👁️", grupo:"Acompanhar" },
  { id:"dicas",       label:"Dicas",       icon:"💡", grupo:"Acompanhar" },
  { id:"ajuda",       label:"Ajuda",        icon:"❓", grupo:"Acompanhar" },
];


// ══════════════════════════════════════════════════════════════
// PÁGINA DE INÍCIO / ONBOARDING
// ══════════════════════════════════════════════════════════════
function PaginaInicio({ dados, onNavegar }) {
  const { cidades, campos, posicoes, adversarios, jogadores, temporadas, partidas, ehTurmaFechada, timesInternos, encontros } = dados;

  const etapas = ehTurmaFechada ? [
    {
      numero: 1, titulo: "Posições", icone: "🎯", menu: "posicoes",
      descricao: "Confira as posições da modalidade da turma (vêm da modalidade escolhida).",
      exemplo: "Ex: Goleiro, Fixo, Ala, Pivô",
      concluido: (posicoes||[]).length > 0, obrigatorio: true,
      dica: "Definidas pela modalidade (subtipo) do time.",
    },
    {
      numero: 2, titulo: "Times Internos", icone: "🎽", menu: "times_internos",
      descricao: "Cadastre os times internos que se enfrentam na turma.",
      exemplo: "Ex: Laranja, Preto, Branco",
      concluido: (timesInternos||[]).length > 0, obrigatorio: true,
      dica: "Os times fixos que jogam entre si nos encontros.",
    },
    {
      numero: 3, titulo: "Jogadores", icone: "👕", menu: "jogadores",
      descricao: "Cadastre os jogadores da turma com nome, camisa e posição.",
      exemplo: "Ex: Dudu (camisa 9), Leo (camisa 5)",
      concluido: (jogadores||[]).length > 0, obrigatorio: true,
      dica: "Necessário para registrar presença e estatísticas.",
    },
    {
      numero: 4, titulo: "Temporada", icone: "📆", menu: "temporadas",
      descricao: "Configure a temporada atual com datas.",
      exemplo: "Ex: Temporada 2025",
      concluido: (temporadas||[]).length > 0, obrigatorio: true,
      dica: "Necessária antes de registrar encontros.",
    },
    {
      numero: 5, titulo: "Encontros", icone: "📅", menu: "partidas",
      descricao: "Registre os encontros (dias de jogo) com os jogos do rodízio e a presença.",
      exemplo: "Ex: Encontro de 21/06 — Laranja 3x2 Preto",
      concluido: (encontros||[]).length > 0, obrigatorio: true,
      dica: "O coração da turma: jogos e estatísticas de cada dia.",
    },
  ] : [
    {
      numero: 1,
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
      numero: 2,
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
      numero: 3,
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
      numero: 4,
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
      numero: 5,
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
      numero: 6,
      titulo: "Partidas",
      icone: "📅",
      menu: "partidas",
      descricao: "Monte o calendário com todos os jogos da temporada.",
      exemplo: "Ex: Nerd do Campo FC x Trianon — 21/06/2025 14:00",
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

function CrudMensalidades({ idTime, show, readOnly }) {
  const hoje = new Date();
  const [mesSel, setMesSel]   = useState(hoje.getMonth() + 1);
  const [anoSel, setAnoSel]   = useState(hoje.getFullYear());
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [modalJog, setModalJog] = useState(null);
  const [formPag, setFormPag]   = useState({});
  const [saving, setSaving]     = useState(false);
  const [abaRel, setAbaRel]     = useState("mensal"); // mensal | inadimplentes

  const { data: times }     = useQuery(() => idTime ? api.get(`time?id_time=eq.${idTime}&select=id_time,nome,valor_mensalidade&limit=1`) : Promise.resolve([]), [idTime]);
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

  // Sincroniza o movimento de caixa de uma mensalidade (Opção A)
  // pago/parcial → cria ou atualiza movimento de receita; nao_pago/isento → remove
  async function sincronizarMovimentoMensalidade(id_mensalidade, dados, nomeJogador) {
    if (!id_mensalidade) return;
    try {
      const existentes = await api.get(`movimento_caixa?id_mensalidade=eq.${id_mensalidade}&select=id_movimento`);
      const temMov = existentes && existentes.length > 0;
      const geraReceita = (dados.status === "pago" || dados.status === "parcial") && Number(dados.valor_pago) > 0;

      if (geraReceita) {
        // achar o tipo "Mensalidade" (receita) do time
        const tipos = await api.get(`tipo_movimento?id_time=eq.${dados.id_time}&natureza=eq.receita&descricao=eq.Mensalidade&select=id_tipo_movimento&limit=1`);
        const idTipo = tipos?.[0]?.id_tipo_movimento || null;
        const body = {
          id_time: dados.id_time, id_tipo_movimento: idTipo, natureza: "receita",
          valor: Number(dados.valor_pago), data_movimento: dados.data_pagamento || new Date().toISOString().split("T")[0],
          observacao: `Mensalidade ${String(dados.mes).padStart(2,"0")}/${dados.ano}${nomeJogador?` — ${nomeJogador}`:""}`,
          origem: "mensalidade", id_mensalidade,
          registrado_por: emailUsuarioLogado(),
        };
        if (temMov) await api.patch(`movimento_caixa?id_mensalidade=eq.${id_mensalidade}`, body);
        else await api.post(`movimento_caixa`, body);
      } else if (temMov) {
        // status virou nao_pago/isento → remove o movimento
        await api.delete(`movimento_caixa?id_mensalidade=eq.${id_mensalidade}`);
      }
    } catch(e) {
      // Não bloqueia o fluxo principal da mensalidade (que já foi salva),
      // mas avisa que o lançamento no caixa não foi sincronizado.
      console.warn("Falha ao sincronizar movimento da mensalidade:", e?.message);
      show("Mensalidade salva, mas o lançamento no caixa não pôde ser atualizado. Verifique o financeiro.", "error");
    }
  }

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
      let idMens = existe;
      if (existe) {
        await api.patch(`mensalidade?id_mensalidade=eq.${existe}`, body);
      } else {
        const criado = await api.post(`mensalidade`, body);
        idMens = Array.isArray(criado) ? criado?.[0]?.id_mensalidade : criado?.id_mensalidade;
      }
      await sincronizarMovimentoMensalidade(idMens, body, modalJog.apelido || modalJog.nome);
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
      let idMens = jog.pag?.id_mensalidade;
      if (idMens) {
        await api.patch(`mensalidade?id_mensalidade=eq.${idMens}`, body);
      } else {
        const criado = await api.post(`mensalidade`, body);
        idMens = Array.isArray(criado) ? criado?.[0]?.id_mensalidade : criado?.id_mensalidade;
      }
      await sincronizarMovimentoMensalidade(idMens, body, jog.apelido || jog.nome);
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

        {/* Tabela de jogadores — separada em Pendentes e Quitados */}
        {(() => {
          const Linha = ({ j, i }) => {
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
                  <span style={{ background:cfg.cor+"22", color:cfg.cor, border:`1px solid ${cfg.cor}44`, borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-block" }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </td>
                <td style={{ padding:"11px 14px", color:C.dim }}>{j.status==="isento" ? "—" : fmtMoeda(esperado)}</td>
                <td style={{ padding:"11px 14px", color:C.win, fontWeight:700 }}>{pago>0 ? fmtMoeda(pago) : "—"}</td>
                <td style={{ padding:"11px 14px", color: saldo>0 ? C.loss : C.win, fontWeight:700 }}>
                  {j.status==="isento" ? "—" : saldo>0 ? `-${fmtMoeda(saldo)}` : "✓"}
                </td>
                <td style={{ padding:"11px 14px", display:"flex", gap:6 }}>
                  {!readOnly && j.status !== "pago" && j.status !== "isento" && (
                    <Btn style={{ fontSize:11, padding:"4px 10px", background:C.win, color:"white" }}
                      onClick={() => marcarPago(j)}>✅ Pago</Btn>
                  )}
                  <Btn variant="secondary" style={{ fontSize:11, padding:"4px 10px" }}
                    onClick={() => !readOnly && abrirModal(j)}
                    disabled={readOnly}>
                    {readOnly ? "👁️ Ver" : "Detalhes"}
                  </Btn>
                </td>
              </tr>
            );
          };
          const Tabela = ({ titulo, cor, dados }) => (
            <div>
              <div style={{ fontSize:11, color:cor, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${cor}`, paddingLeft:10 }}>{titulo} ({dados.length})</div>
              <Card style={{ padding:0, overflow:"hidden" }}>
                <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead><tr style={{ background:C.surf2 }}>
                    {["#","Jogador","Status","Esperado","Pago","Saldo","Ações"].map(h => (
                      <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {dados.length === 0
                      ? <tr><td colSpan={7} style={{ padding:"18px 14px", textAlign:"center", color:C.dim, fontSize:13 }}>Nenhum jogador nesta situação.</td></tr>
                      : dados.map((j, i) => <Linha key={j.id_jogador} j={j} i={i} />)}
                  </tbody>
                </table></div>
              </Card>
            </div>
          );
          // Pendentes = não pagos + parciais (ainda devem). Quitados = pagos + isentos.
          const pendentes = filtrados.filter(j => j.status === "nao_pago" || j.status === "parcial");
          const quitados  = filtrados.filter(j => j.status === "pago" || j.status === "isento");
          // Se o usuário filtrou por um status específico, mostra uma tabela só (respeita o filtro)
          if (filtroStatus !== "todos") {
            return <Tabela titulo="Jogadores" cor={C.gold} dados={filtrados} />;
          }
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
              <Tabela titulo="🔴 Pendentes (não pagos e parciais)" cor={C.loss} dados={pendentes} />
              <Tabela titulo="🟢 Pagos e isentos" cor={C.win} dados={quitados} />
            </div>
          );
        })()}
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
            <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
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
            </table></div>
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
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
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
          </table></div>
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
              <Btn variant="secondary" onClick={() => setModalJog(null)}>Fechar</Btn>
              {!readOnly && <Btn onClick={salvarPagamento} disabled={saving}>{saving?"Salvando...":"Salvar"}</Btn>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// PÁGINA DE AJUDA
// ══════════════════════════════════════════════════════════════
function PaginaDicas({ ehTurmaFechada }) {
  const DICAS = [
    { ic:"📅", t:"Use só o que precisar", d:"Você não é obrigado a usar tudo. Dá pra controlar só o calendário, só a presença, ou ir até o controle financeiro completo. Comece simples e ative o resto quando quiser." },
    { ic:"📲", t:"Compartilhe imagens prontas no grupo", d:"Em vários momentos o sistema gera uma imagem bonita para você mandar direto no grupo do WhatsApp: o resultado de uma partida (com placar, gols e resumo da temporada), a convocação para o próximo jogo, o convite para um encontro da turma e o convite para um evento. É só tocar em 'Compartilhar' e escolher o grupo — a imagem (e o link de presença, quando faz sentido) vai junto, levando a marca do seu time." },
    { ic:"✅", t:"Confirmação de presença sem login", d:"Gere um link e mande no grupo. Cada jogador abre, toca no próprio nome e responde se vai — sem instalar nada e sem senha. Você vê quem confirmou em tempo real." },
    { ic:"⚽", t:"Escalação inteligente", d:"Na hora de escalar, o sistema não deixa repetir o número da camisa e respeita o limite de titulares da modalidade. Menos chance de errar a escalação." },
    { ic:"🎯", t:"Gols com assistência e minuto", d:"Ao registrar um gol, informe quem deu o passe e o minuto. A artilharia e o ranking de assistências se montam sozinhos, sem você fazer conta." },
    { ic:"💰", t:"Mensalidade sem fofoca", d:"Marque quem pagou mês a mês. Quem está em dia, quem deve e quem é isento aparece numa lista só. Dá até pra marcar todos como pagos de uma vez." },
    { ic:"💵", t:"Controle de caixa completo", d:"Quer ir além da mensalidade? Registre receitas e despesas e tenha o saldo do time sempre atualizado. Use só se fizer sentido pro seu grupo." },
    { ic:"🎉", t:"Eventos com presença", d:"Cadastre um churrasco ou confraternização e registre quem foi — sem precisar lançar nada financeiro. Serve só pra controlar presença, se quiser." },
    { ic:"📊", t:"Seu time numa vitrine pública", d:"As estatísticas do time ficam numa página que qualquer um acessa pelo celular, sem instalar app. Bom pra mostrar a artilharia e o histórico pra galera." },
    { ic:"👥", t:"Um login, vários times", d:"Se você administra mais de um time com o mesmo e-mail, dá pra alternar entre eles no seletor lá em cima — sem precisar sair e entrar de novo." },
    { ic:"🎂", t:"Idade do jogador automática", d:"Cadastre a data de nascimento e o sistema calcula a idade sozinho na lista de jogadores. Dá até pra ordenar do mais novo ao mais velho." },
  ];
  const DICAS_TURMA = [
    { ic:"🎽", t:"Turma fechada: times internos", d:"No modo turma fechada, você monta times que se enfrentam entre si (Laranja x Preto) e registra cada rodada do racha." },
    { ic:"🧺", t:"Ranking da lavagem do colete", d:"Marque quem levou o fardamento pra lavar em cada encontro. O sistema mantém um ranking — ninguém mais 'esquece' que é a vez dele." },
  ];
  const lista = ehTurmaFechada ? [...DICAS, ...DICAS_TURMA] : DICAS;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:720 }}>
      <div style={{ marginBottom:4 }}>
        <div style={{ fontSize:22, fontWeight:800, color:C.cream, textTransform:"uppercase", letterSpacing:"0.06em" }}>
          💡 Você sabia?
        </div>
        <div style={{ fontSize:13, color:C.dim, marginTop:6, lineHeight:1.6 }}>
          Recursos do sistema explicados em poucas palavras. Role e descubra o que dá pra fazer.
        </div>
      </div>
      {lista.map((dica, i) => (
        <Card key={i} style={{ padding:20, display:"flex", gap:16, alignItems:"flex-start" }}>
          <div style={{ fontSize:30, lineHeight:1, flexShrink:0 }}>{dica.ic}</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:C.gold, marginBottom:5 }}>{dica.t}</div>
            <div style={{ fontSize:13, color:C.cream, lineHeight:1.6 }}>{dica.d}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PaginaAjuda() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24, maxWidth:640 }}>
      <Card style={{ padding:32, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📖</div>
        <div style={{ fontSize:22, fontWeight:800, color:C.cream, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>
          Manual do Usuário
        </div>
        <div style={{ fontSize:13, color:C.dim, marginBottom:24, lineHeight:1.7 }}>
          O manual contém o guia completo do sistema — desde o cadastro inicial
          até o controle de mensalidades. Atualizado para a versão atual.
        </div>
        <a href="/manual.pdf?v=1.4.2" target="_blank" rel="noopener noreferrer"
          style={{ display:"inline-flex", alignItems:"center", gap:10,
            background:C.gold, color:"#0B3D2E", borderRadius:10,
            padding:"14px 28px", fontFamily:"inherit", fontWeight:800,
            fontSize:14, textDecoration:"none", textTransform:"uppercase",
            letterSpacing:"0.06em", cursor:"pointer" }}>
          📥 Baixar Manual (PDF)
        </a>
      </Card>

      <Card style={{ padding:24 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.gold, textTransform:"uppercase",
          letterSpacing:"0.08em", marginBottom:16, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>
          Dúvidas frequentes
        </div>
        {[
          ["Como inativar um jogador?", "Vá em Jogadores → clique em Inativar ao lado do jogador. Ele vai para a lista de inativos mas o histórico é mantido. Para reativar, clique em Reativar."],
          ["Como tornar a temporada pública?", "Vá em Temporadas → edite a temporada → ative o toggle 🌐 Temporada Pública."],
          ["Como registrar um gol?", "Vá em Partidas → clique na partida → role até Gols → clique em + Gol."],
          ["Como controlar mensalidades?", "Vá em Financeiro → Mensalidades → selecione o mês → clique em ✅ Pago para cada jogador."],
          ["Esqueci a senha. O que faço?", "Na tela de login, clique em 'Esqueci minha senha', informe seu e-mail e siga o link que enviaremos para criar uma nova senha."],
        ].map(([p, r], i) => (
          <div key={i} style={{ borderBottom:`1px solid ${C.border}`, paddingBottom:12, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.cream, marginBottom:4 }}>❓ {p}</div>
            <div style={{ fontSize:12, color:C.dim, lineHeight:1.6 }}>{r}</div>
          </div>
        ))}
      </Card>

      <Card style={{ padding:20, textAlign:"center" }}>
        <div style={{ fontSize:12, color:C.dim }}>
          Ainda com dúvidas? Entre em contato:
        </div>
        <div style={{ fontSize:13, color:C.gold, fontWeight:700, marginTop:6 }}>
          nerddocampo10@gmail.com
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MÓDULO FINANCEIRO — Tipos de Movimento
// ══════════════════════════════════════════════════════════════
function CrudTiposMov({ idTime, show, readOnly }) {
  // idTime recebido por prop (filtrado pelo usuário logado no componente pai)
  const { data: tipos, loading, reload } = useQuery(
    () => idTime ? api.get(`tipo_movimento?id_time=eq.${idTime}&select=*&order=natureza.asc,descricao.asc`) : Promise.resolve([]),
    [idTime]
  );
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  function abrirNovo() { setForm({ descricao:"", natureza:"despesa", status:"Ativo" }); setModal("novo"); }
  function abrirEditar(t) { setForm({ ...t }); setModal("editar"); }
  function set(k,v){ setForm(f=>({ ...f, [k]:v })); }

  async function salvar() {
    if (!form.descricao?.trim()) { show("Informe a descrição.", "error"); return; }
    setSaving(true);
    try {
      const body = { descricao: form.descricao.trim(), natureza: form.natureza, status: form.status||"Ativo", id_time: idTime };
      if (modal === "editar") await api.patch(`tipo_movimento?id_tipo_movimento=eq.${form.id_tipo_movimento}`, body);
      else await api.post(`tipo_movimento`, body);
      show("Tipo salvo!"); setModal(null); reload();
    } catch(e){ show("Erro: "+e.message, "error"); }
    finally { setSaving(false); }
  }

  async function alternarStatus(t) {
    const novo = t.status === "Ativo" ? "Inativo" : "Ativo";
    try { await api.patch(`tipo_movimento?id_tipo_movimento=eq.${t.id_tipo_movimento}`, { status: novo }); show(`${t.descricao}: ${novo}`); reload(); }
    catch(e){ show("Erro: "+e.message, "error"); }
  }

  if (loading) return <Spinner/>;
  const receitas = (tipos||[]).filter(t => t.natureza === "receita");
  const despesas = (tipos||[]).filter(t => t.natureza === "despesa");

  const Tabela = ({ titulo, lista, cor }) => (
    <Card style={{ padding:0, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, fontSize:14, fontWeight:700, color:cor }}>{titulo} ({lista.length})</div>
      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <tbody>
          {lista.map((t,i) => (
            <tr key={t.id_tipo_movimento} style={{ background:i%2===0?C.surface:C.bg, opacity: t.status==="Inativo"?0.5:1 }}>
              <td style={{ padding:"10px 16px", fontWeight:600, color:C.cream }}>
                {t.descricao} {t.status==="Inativo" && <span style={{ fontSize:10, color:C.dim }}>(inativo)</span>}
              </td>
              <td style={{ padding:"10px 16px", textAlign:"right", display:"flex", gap:6, justifyContent:"flex-end" }}>
                {!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"4px 10px" }} onClick={()=>abrirEditar(t)}>Editar</Btn>}
                {!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"4px 10px", color: t.status==="Ativo"?C.loss:C.win }} onClick={()=>alternarStatus(t)}>{t.status==="Ativo"?"Inativar":"Ativar"}</Btn>}
              </td>
            </tr>
          ))}
          {lista.length===0 && <tr><td style={{ padding:16, color:C.dim, fontSize:12 }}>Nenhum tipo cadastrado.</td></tr>}
        </tbody>
      </table></div>
    </Card>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {!readOnly && <div><Btn onClick={abrirNovo}>+ Novo Tipo</Btn></div>}
      <Tabela titulo="🟢 Receitas" lista={receitas} cor={C.win}/>
      <Tabela titulo="🔴 Despesas" lista={despesas} cor={C.loss}/>
      {modal && (
        <Modal title={modal==="novo"?"Novo Tipo de Movimento":"Editar Tipo"} onClose={()=>setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Descrição" value={form.descricao||""} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Pagamento de juiz"/>
            <Select label="Natureza" value={form.natureza} onChange={e=>set("natureza",e.target.value)}>
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </Select>
            {modal==="editar" && (
              <Select label="Status" value={form.status} onChange={e=>set("status",e.target.value)}>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </Select>
            )}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <Btn variant="secondary" onClick={()=>setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving||readOnly}>{saving?"Salvando...":"Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MÓDULO FINANCEIRO — Caixa (saldo + extrato cronológico)
// ══════════════════════════════════════════════════════════════
function CrudCaixa({ idTime, show, readOnly }) {
  // idTime recebido por prop (filtrado pelo usuário logado no componente pai)
  const { data: timeData } = useQuery(() => idTime ? api.get(`time?id_time=eq.${idTime}&select=saldo_inicial,nome`) : Promise.resolve([]), [idTime]);
  const saldoInicial = Number(timeData?.[0]?.saldo_inicial || 0);

  const { data: movimentos, loading, reload } = useQuery(
    () => idTime ? api.get(`movimento_caixa?id_time=eq.${idTime}&select=*,tipo_movimento(descricao),evento(nome,id_temporada),partida(data,adversario(nome))&order=data_movimento.asc,id_movimento.asc`) : Promise.resolve([]),
    [idTime]
  );
  const { data: temporadas } = useQuery(() => idTime ? api.get(`temporada?id_time=eq.${idTime}&select=*&order=data_inicio.desc`) : Promise.resolve([]), [idTime]);
  const [filtroOrigem, setFiltroOrigem] = useState("todos");
  const [filtroTemporada, setFiltroTemporada] = useState("todas");
  const [filtroNatureza, setFiltroNatureza] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [buscaObs, setBuscaObs] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  if (loading) return <Spinner/>;

  const movs = movimentos || [];
  const totalReceitas = movs.filter(m=>m.natureza==="receita").reduce((s,m)=>s+Number(m.valor||0),0);
  const totalDespesas = movs.filter(m=>m.natureza==="despesa").reduce((s,m)=>s+Number(m.valor||0),0);
  const saldoAtual = saldoInicial + totalReceitas - totalDespesas;

  // Aplicar filtros (origem, temporada via evento, intervalo de datas, natureza, tipo)
  const filtrados = movs.filter(m => {
    if (filtroOrigem !== "todos" && m.origem !== filtroOrigem) return false;
    if (filtroNatureza !== "todas" && m.natureza !== filtroNatureza) return false;
    if (filtroTipo !== "todos" && String(m.id_tipo_movimento) !== String(filtroTipo)) return false;
    if (filtroTemporada !== "todas") {
      // só movimentos de eventos daquela temporada (mensalidade/partida não têm temporada direta)
      if (m.origem !== "evento" || String(m.evento?.id_temporada) !== String(filtroTemporada)) return false;
    }
    if (dataDe && m.data_movimento < dataDe) return false;
    if (dataAte && m.data_movimento > dataAte) return false;
    if (buscaObs.trim()) {
      const termos = buscaObs.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const alvo = ((m.observacao || "") + " " + (m.tipo_movimento?.descricao || "")).toLowerCase();
      // precisa conter TODAS as palavras (em qualquer ordem)
      if (!termos.every(t => alvo.includes(t))) return false;
    }
    return true;
  });

  // Tipos presentes nos movimentos (para o dropdown), respeitando a natureza escolhida
  const tiposDisponiveis = Array.from(
    new Map(
      movs
        .filter(m => filtroNatureza === "todas" || m.natureza === filtroNatureza)
        .filter(m => m.id_tipo_movimento && m.tipo_movimento?.descricao)
        .map(m => [m.id_tipo_movimento, m.tipo_movimento.descricao])
    ).entries()
  ).sort((a,b) => a[1].localeCompare(b[1]));

  // Extrato com saldo acumulado
  const temFiltro = filtroOrigem!=="todos" || filtroNatureza!=="todas" || filtroTipo!=="todos" || filtroTemporada!=="todas" || !!dataDe || !!dataAte || !!buscaObs.trim();
  let acc = saldoInicial;
  const extrato = filtrados.map(m => {
    const delta = m.natureza==="receita" ? Number(m.valor||0) : -Number(m.valor||0);
    acc += delta;
    return { ...m, saldoAcc: acc, delta };
  });

  function origemLabel(m) {
    if (m.origem==="mensalidade") return "💰 Mensalidade";
    if (m.origem==="evento") return `🎉 ${m.evento?.nome || "Evento"}`;
    if (m.origem==="partida") return `📅 vs ${m.partida?.adversario?.nome || "Adversário"}`;
    return m.origem;
  }

  function origemTexto(m) {
    if (m.origem==="mensalidade") return "Mensalidade";
    if (m.origem==="evento") return `Evento: ${m.evento?.nome || ""}`;
    if (m.origem==="partida") return `Partida vs ${m.partida?.adversario?.nome || ""}`;
    return m.origem;
  }

  // Monta as linhas do extrato (recalcula saldo acumulado sobre o filtrado)
  function linhasRelatorio() {
    let a = saldoInicial;
    return filtrados.map(m => {
      a += m.natureza==="receita" ? Number(m.valor||0) : -Number(m.valor||0);
      return {
        Data: new Date(m.data_movimento+"T12:00:00").toLocaleDateString("pt-BR"),
        Descrição: m.tipo_movimento?.descricao || "",
        Origem: origemTexto(m),
        Tipo: m.natureza==="receita" ? "Receita" : "Despesa",
        Valor: Number(m.valor||0),
        Saldo: a,
        Observação: m.observacao || "",
        "Lançado por": m.registrado_por || "",
      };
    });
  }

  const nomeArq = `extrato_caixa_${timeData?.[0]?.nome?.replace(/\s+/g,"_") || "time"}`;

  function exportarExcel() {
    const XLSX = window.XLSX;
    if (!XLSX) { alert("Recarregue a página para usar esta função."); return; }
    const linhas = linhasRelatorio();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(linhas);
    XLSX.utils.book_append_sheet(wb, ws, "Extrato");
    // Resumo
    const resumo = [
      { Campo:"Saldo Inicial", Valor: saldoInicial },
      { Campo:"Total Receitas", Valor: filtrados.filter(m=>m.natureza==="receita").reduce((s,m)=>s+Number(m.valor||0),0) },
      { Campo:"Total Despesas", Valor: filtrados.filter(m=>m.natureza==="despesa").reduce((s,m)=>s+Number(m.valor||0),0) },
      { Campo:"Saldo Final", Valor: linhas.length ? linhas[linhas.length-1].Saldo : saldoInicial },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");
    XLSX.writeFile(wb, `${nomeArq}.xlsx`);
  }

  function exportarCSV() {
    const linhas = linhasRelatorio();
    if (!linhas.length) { alert("Nenhum movimento para exportar."); return; }
    const cab = Object.keys(linhas[0]);
    const csv = [cab.join(";")].concat(
      linhas.map(l => cab.map(k => {
        let v = l[k];
        if (typeof v === "number") v = v.toFixed(2).replace(".",",");
        return `"${String(v).replace(/"/g,'""')}"`;
      }).join(";"))
    ).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${nomeArq}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportarPDF() {
    const linhas = linhasRelatorio();
    const totR = filtrados.filter(m=>m.natureza==="receita").reduce((s,m)=>s+Number(m.valor||0),0);
    const totD = filtrados.filter(m=>m.natureza==="despesa").reduce((s,m)=>s+Number(m.valor||0),0);
    const saldoFim = linhas.length ? linhas[linhas.length-1].Saldo : saldoInicial;
    const brl = v => "R$ " + Number(v).toFixed(2).replace(".",",");
    const linhasHtml = linhas.map(l => `<tr>
      <td>${l.Data}</td><td>${l.Descrição}</td><td>${l.Origem}</td>
      <td style="color:${l.Tipo==="Receita"?"#2e7d32":"#c62828"}">${l.Tipo}</td>
      <td style="text-align:right">${brl(l.Valor)}</td>
      <td style="text-align:right">${brl(l.Saldo)}</td>
      <td>${l.Observação}</td><td>${l["Lançado por"]||""}</td></tr>`).join("");
    const periodo = (dataDe||dataAte) ? `Período: ${dataDe?new Date(dataDe+"T12:00:00").toLocaleDateString("pt-BR"):"início"} a ${dataAte?new Date(dataAte+"T12:00:00").toLocaleDateString("pt-BR"):"hoje"}` : "Período: completo";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Extrato de Caixa</title>
      <style>
        body{font-family:Arial,sans-serif;color:#222;padding:24px;}
        h1{color:#0B3D2E;font-size:20px;margin:0;}
        .sub{color:#777;font-size:12px;margin:4px 0 16px;}
        .resumo{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;}
        .box{border:1px solid #ccc;border-radius:8px;padding:10px 16px;}
        .box b{display:block;font-size:16px;}
        .box span{font-size:11px;color:#777;text-transform:uppercase;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th{background:#0B3D2E;color:#fff;padding:6px 8px;text-align:left;}
        td{padding:5px 8px;border-bottom:1px solid #eee;}
        tr:nth-child(even) td{background:#f7f7f5;}
        .assinatura{margin-top:24px;text-align:center;color:#E8A020;font-size:11px;}
      </style></head><body>
      <h1>⚽ Extrato de Caixa — ${timeData?.[0]?.nome || ""}</h1>
      <div class="sub">${periodo} · Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
      <div class="resumo">
        <div class="box"><span>Saldo Inicial</span><b>${brl(saldoInicial)}</b></div>
        <div class="box"><span>Receitas</span><b style="color:#2e7d32">${brl(totR)}</b></div>
        <div class="box"><span>Despesas</span><b style="color:#c62828">${brl(totD)}</b></div>
        <div class="box"><span>Saldo Final</span><b style="color:#0B3D2E">${brl(saldoFim)}</b></div>
      </div>
      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table><thead><tr>
        <th>Data</th><th>Descrição</th><th>Origem</th><th>Tipo</th>
        <th style="text-align:right">Valor</th><th style="text-align:right">Saldo</th><th>Obs.</th><th>Lançado por</th>
      </tr></thead><tbody>${linhasHtml || '<tr><td colspan="8" style="text-align:center;padding:16px">Nenhum movimento.</td></tr>'}</tbody></table></div>
      <div class="assinatura">⚽ Designed by Caxpa Augsten — Nerd do Campo</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Permita pop-ups para gerar o PDF."); return; }
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Cards de saldo */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {[
          { label:"Saldo Inicial", valor:saldoInicial, cor:C.dim },
          { label:"Receitas", valor:totalReceitas, cor:C.win },
          { label:"Despesas", valor:totalDespesas, cor:C.loss },
          { label:"Saldo Atual", valor:saldoAtual, cor: saldoAtual>=0?C.gold:C.loss, destaque:true },
        ].map(c => (
          <div key={c.label} style={{ flex:1, minWidth:140, background: c.destaque?C.gold+"11":C.surface,
            border:`1px solid ${c.destaque?C.gold:C.border}`, borderRadius:12, padding:"16px 20px" }}>
            <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:20, fontWeight:800, color:c.cor }}>{fmtMoeda(c.valor)}</div>
          </div>
        ))}
      </div>

      {/* Filtro de origem */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {[["todos","Todos"],["partida","📅 Partidas"],["evento","🎉 Eventos"],["mensalidade","💰 Mensalidades"]].map(([k,l]) => (
          <button key={k} onClick={()=>setFiltroOrigem(k)}
            style={{ background: filtroOrigem===k?C.gold:C.surface, color: filtroOrigem===k?"#0B3D2E":C.dim,
              border:`1px solid ${filtroOrigem===k?C.gold:C.border}`, borderRadius:8, padding:"6px 14px",
              fontFamily:"inherit", fontWeight:700, fontSize:11, cursor:"pointer", textTransform:"uppercase" }}>{l}</button>
        ))}
      </div>

      {/* Filtros temporada + datas + exportação */}
      <Card style={{ padding:"14px 16px" }}>
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", marginBottom:4 }}>🔍 Buscar na observação/descrição</div>
          <input type="text" value={buscaObs} onChange={e=>setBuscaObs(e.target.value)}
            placeholder="Ex: nerd campo (traz o que tiver as duas palavras)"
            style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:13, padding:"9px 12px", outline:"none" }}/>
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ minWidth:130 }}>
            <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", marginBottom:4 }}>Receita/Despesa</div>
            <select value={filtroNatureza} onChange={e=>{ setFiltroNatureza(e.target.value); setFiltroTipo("todos"); }}
              style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:13, padding:"8px 10px" }}>
              <option value="todas">Ambos</option>
              <option value="receita">Só Receitas</option>
              <option value="despesa">Só Despesas</option>
            </select>
          </div>
          <div style={{ minWidth:170 }}>
            <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", marginBottom:4 }}>Tipo de movimento</div>
            <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}
              style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:13, padding:"8px 10px" }}>
              <option value="todos">Todos os tipos</option>
              {tiposDisponiveis.map(([id,desc])=><option key={id} value={id}>{desc}</option>)}
            </select>
          </div>
          <div style={{ minWidth:160 }}>
            <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", marginBottom:4 }}>Temporada (eventos)</div>
            <select value={filtroTemporada} onChange={e=>setFiltroTemporada(e.target.value)}
              style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:13, padding:"8px 10px" }}>
              <option value="todas">Todas</option>
              {(temporadas||[]).map(t=><option key={t.id_temporada} value={t.id_temporada}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", marginBottom:4 }}>De</div>
            <input type="date" value={dataDe} onChange={e=>setDataDe(e.target.value)}
              style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:13, padding:"8px 10px" }}/>
          </div>
          <div>
            <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", marginBottom:4 }}>Até</div>
            <input type="date" value={dataAte} onChange={e=>setDataAte(e.target.value)}
              style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:13, padding:"8px 10px" }}/>
          </div>
          {(filtroTemporada!=="todas"||dataDe||dataAte||filtroNatureza!=="todas"||filtroTipo!=="todos"||buscaObs) && (
            <Btn variant="secondary" style={{ fontSize:11, padding:"8px 12px" }}
              onClick={()=>{ setFiltroTemporada("todas"); setDataDe(""); setDataAte(""); setFiltroNatureza("todas"); setFiltroTipo("todos"); setBuscaObs(""); }}>Limpar</Btn>
          )}
          <div style={{ flex:1 }}/>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <Btn variant="secondary" style={{ fontSize:11, padding:"8px 12px" }} onClick={exportarExcel}>📊 Excel</Btn>
            <Btn variant="secondary" style={{ fontSize:11, padding:"8px 12px" }} onClick={exportarCSV}>📄 CSV</Btn>
            <Btn variant="secondary" style={{ fontSize:11, padding:"8px 12px" }} onClick={exportarPDF}>📕 PDF</Btn>
          </div>
        </div>
      </Card>

      {/* Extrato cronológico */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <span style={{ fontSize:14, fontWeight:700, color:C.cream }}>📋 Extrato de Movimentos</span>
          <span style={{ fontSize:12, color:C.dim }}>
            {filtrados.length} mov. ·
            <span style={{ color:C.win }}> +{fmtMoeda(filtrados.filter(m=>m.natureza==="receita").reduce((s,m)=>s+Number(m.valor||0),0))}</span> ·
            <span style={{ color:C.loss }}> −{fmtMoeda(filtrados.filter(m=>m.natureza==="despesa").reduce((s,m)=>s+Number(m.valor||0),0))}</span>
          </span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr style={{ background:C.surf2 }}>
              {["Data","Descrição","Origem","Valor", temFiltro?"Acum. (seleção)":"Saldo","Obs.","Lançado por"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {extrato.map((m,i) => (
                <tr key={m.id_movimento} style={{ background:i%2===0?C.surface:C.bg }}>
                  <td style={{ padding:"10px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{new Date(m.data_movimento+"T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td style={{ padding:"10px 14px", color:C.cream }}>{m.tipo_movimento?.descricao || "—"}</td>
                  <td style={{ padding:"10px 14px", color:C.dim, fontSize:12 }}>{origemLabel(m)}</td>
                  <td style={{ padding:"10px 14px", fontWeight:700, whiteSpace:"nowrap", color: m.natureza==="receita"?C.win:C.loss }}>
                    {m.natureza==="receita"?"+":"−"} {fmtMoeda(m.valor)}
                  </td>
                  <td style={{ padding:"10px 14px", fontWeight:700, whiteSpace:"nowrap", color: m.saldoAcc>=0?C.cream:C.loss }}>{fmtMoeda(m.saldoAcc)}</td>
                  <td style={{ padding:"10px 14px", color:C.dim, fontSize:11, maxWidth:160 }}>{m.observacao || "—"}</td>
                  <td style={{ padding:"10px 14px", color:C.dim, fontSize:11, whiteSpace:"nowrap" }}>{m.registrado_por || "—"}</td>
                </tr>
              ))}
              {extrato.length===0 && <tr><td colSpan={7} style={{ padding:24, textAlign:"center", color:C.dim }}>Nenhum movimento registrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {temFiltro && (
        <div style={{ fontSize:11, color:C.gold, fontStyle:"italic" }}>
          ℹ️ Com filtros ativos, a coluna "Acum. (seleção)" soma apenas os movimentos exibidos — não representa o saldo real do caixa.
        </div>
      )}
      <div style={{ fontSize:11, color:C.dim, fontStyle:"italic" }}>
        💡 Movimentos são lançados nas Partidas (custos do jogo), nos Eventos (arrecadações) e automaticamente nas Mensalidades pagas.
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// MÓDULO FINANCEIRO — Eventos (arrecadações)
// ══════════════════════════════════════════════════════════════
function CrudEventos({ idTime, show, readOnly }) {
  // idTime recebido por prop (filtrado pelo usuário logado no componente pai)
  const { data: _timeEvento } = useQuery(() => idTime ? api.get(`time?id_time=eq.${idTime}&select=id_time,nome,cidade:id_cidade_sede(nome,estado)&limit=1`) : Promise.resolve([]), [idTime]);
  const { data: eventos, loading, reload } = useQuery(
    () => idTime ? api.get(`evento?id_time=eq.${idTime}&select=*,temporada(nome)&order=data_evento.desc,id_evento.desc`) : Promise.resolve([]),
    [idTime]
  );
  const { data: temporadas } = useQuery(() => idTime ? api.get(`temporada?id_time=eq.${idTime}&select=*&order=data_inicio.desc`) : Promise.resolve([]), [idTime]);
  const { data: tiposMov } = useQuery(() => idTime ? api.get(`tipo_movimento?id_time=eq.${idTime}&status=eq.Ativo&select=*&order=descricao.asc`) : Promise.resolve([]), [idTime]);
  const { data: movsEvento, reload: reloadMovs } = useQuery(
    () => idTime ? api.get(`movimento_caixa?id_time=eq.${idTime}&origem=eq.evento&select=*,tipo_movimento(descricao)`) : Promise.resolve([]),
    [idTime]
  );

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [detalhe, setDetalhe] = useState(null); // evento aberto para ver/lançar movimentos
  const [linkEvento, setLinkEvento] = useState(null); // evento cujo link de confirmação está aberto
  const [formMov, setFormMov] = useState({});

  function abrirNovo() {
    setForm({ nome:"", data_evento:new Date().toISOString().split("T")[0], link_local:"", meta:"", modo:"detalhado", resultado_direto:"", id_temporada: temporadas?.[0]?.id_temporada || "", observacoes:"" });
    setModal("novo");
  }
  function set(k,v){ setForm(f=>({ ...f, [k]:v })); }

  function resultadoCalculado(idEvento) {
    const ms = (movsEvento||[]).filter(m=>m.id_evento===idEvento);
    const r = ms.filter(m=>m.natureza==="receita").reduce((s,m)=>s+Number(m.valor||0),0);
    const d = ms.filter(m=>m.natureza==="despesa").reduce((s,m)=>s+Number(m.valor||0),0);
    return r - d;
  }

  async function salvar() {
    if (!form.nome?.trim()) { show("Informe o nome do evento.", "error"); return; }
    if (!linkLocalValido(form.link_local)) { show(`Link inválido. Recebido: "${String(form.link_local).slice(0,60)}". Cole um link do mapa.`, "error"); return; }
    setSaving(true);
    try {
      const body = {
        nome: form.nome.trim(), data_evento: form.data_evento||null,
        link_local: normalizarLink(form.link_local),
        meta: Number(form.meta)||0, modo: form.modo,
        resultado_direto: form.modo==="direto" ? (Number(form.resultado_direto)||0) : null,
        id_temporada: form.id_temporada?Number(form.id_temporada):null,
        observacoes: form.observacoes||null, id_time: idTime,
      };
      if (modal==="editar") await api.patch(`evento?id_evento=eq.${form.id_evento}`, body);
      else await api.post(`evento`, body);
      show("Evento salvo!"); setModal(null); reload();
    } catch(e){ show("Erro: "+e.message, "error"); }
    finally { setSaving(false); }
  }

  function abrirEditar(ev) {
    if (ev.status==="encerrado") { show("Evento encerrado não pode ser editado.", "error"); return; }
    setForm({ ...ev, meta:ev.meta||"", resultado_direto:ev.resultado_direto||"" }); setModal("editar");
  }

  async function encerrar(ev) {
    const resultado = ev.modo==="direto" ? Number(ev.resultado_direto||0) : resultadoCalculado(ev.id_evento);
    const atingiu = resultado >= Number(ev.meta||0);
    if (!confirm(`Encerrar "${ev.nome}"?\nResultado: ${fmtMoeda(resultado)}\nMeta: ${fmtMoeda(ev.meta)}\n${atingiu?"✅ Meta atingida":"❌ Abaixo da meta"}`)) return;
    try {
      await api.patch(`evento?id_evento=eq.${ev.id_evento}`, { status:"encerrado", resultado_final:resultado, meta_atingida:atingiu });
      show("Evento encerrado!"); reload();
    } catch(e){ show("Erro: "+e.message, "error"); }
  }

  async function reabrir(ev) {
    if (!confirm(`Reabrir "${ev.nome}"?\nO resultado deixará de ficar congelado e voltará a ser ${ev.modo==="direto"?"o valor digitado":"calculado pelos lançamentos"}.`)) return;
    try {
      await api.patch(`evento?id_evento=eq.${ev.id_evento}`, { status:"aberto", resultado_final:null, meta_atingida:null });
      show("Evento reaberto!"); reload();
    } catch(e){ show("Erro: "+e.message, "error"); }
  }

  async function excluir(ev) {
    const temMov = (movsEvento||[]).some(m=>m.id_evento===ev.id_evento);
    if (temMov) { show("Este evento tem lançamentos vinculados e não pode ser excluído.", "error"); return; }
    if (!confirm(`Excluir o evento "${ev.nome}"?`)) return;
    try { await api.delete(`evento?id_evento=eq.${ev.id_evento}`); show("Evento excluído."); reload(); }
    catch(e){ show("Erro: "+e.message, "error"); }
  }

  // Lançar movimento dentro de um evento detalhado
  function abrirLancar(ev) {
    setFormMov({ id_evento:ev.id_evento, id_tipo_movimento:"", valor:"", data_movimento:ev.data_evento||new Date().toISOString().split("T")[0], observacao:"" });
    setDetalhe(ev);
  }
  function setM(k,v){ setFormMov(f=>({ ...f, [k]:v })); }

  async function salvarMov() {
    const tipo = (tiposMov||[]).find(t=>String(t.id_tipo_movimento)===String(formMov.id_tipo_movimento));
    if (!tipo) { show("Selecione o tipo.", "error"); return; }
    if (!formMov.valor || Number(formMov.valor)<=0) { show("Informe um valor válido.", "error"); return; }
    setSaving(true);
    try {
      await api.post(`movimento_caixa`, {
        id_time: idTime, id_tipo_movimento: tipo.id_tipo_movimento, natureza: tipo.natureza,
        valor: Number(formMov.valor), data_movimento: formMov.data_movimento,
        observacao: formMov.observacao||null, origem:"evento", id_evento: formMov.id_evento,
        registrado_por: emailUsuarioLogado(),
      });
      show("Lançamento adicionado!"); setFormMov(f=>({ ...f, valor:"", observacao:"" })); reloadMovs();
    } catch(e){ show("Erro: "+e.message, "error"); }
    finally { setSaving(false); }
  }

  async function removerMov(m) {
    if (!confirm("Remover este lançamento?")) return;
    try { await api.delete(`movimento_caixa?id_movimento=eq.${m.id_movimento}`); show("Removido."); reloadMovs(); }
    catch(e){ show("Erro: "+e.message, "error"); }
  }

  if (loading) return <Spinner/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {!readOnly && <div><Btn onClick={abrirNovo}>+ Novo Evento</Btn></div>}

      {(eventos||[]).map(ev => {
        const resultado = ev.status==="encerrado" ? Number(ev.resultado_final||0)
          : ev.modo==="direto" ? Number(ev.resultado_direto||0) : resultadoCalculado(ev.id_evento);
        const meta = Number(ev.meta||0);
        const atingiu = resultado >= meta;
        const movs = (movsEvento||[]).filter(m=>m.id_evento===ev.id_evento);
        return (
          <Card key={ev.id_evento} style={{ padding:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.cream }}>
                  🎉 {ev.nome}
                  {ev.status==="encerrado" && <span style={{ fontSize:11, color:C.dim, marginLeft:8 }}>(encerrado)</span>}
                </div>
                <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>
                  {ev.data_evento ? new Date(ev.data_evento+"T12:00:00").toLocaleDateString("pt-BR") : "Sem data"}
                  {ev.temporada?.nome && ` · ${ev.temporada.nome}`}
                  {` · Modo ${ev.modo==="direto"?"resultado direto":"detalhado"}`}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:20, fontWeight:800, color: resultado>=0?C.win:C.loss }}>{fmtMoeda(resultado)}</div>
                <div style={{ fontSize:11, color:C.dim }}>Meta: {fmtMoeda(meta)}</div>
                {meta>0 && <div style={{ fontSize:11, fontWeight:700, color: atingiu?C.win:C.loss }}>{atingiu?"✅ Meta atingida":"❌ Abaixo da meta"}</div>}
              </div>
            </div>

            {/* Movimentos do evento (modo detalhado) */}
            {ev.modo==="detalhado" && movs.length>0 && (
              <div style={{ marginTop:14, background:C.surf2, borderRadius:8, padding:"10px 14px" }}>
                {movs.map(m => (
                  <div key={m.id_movimento} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", fontSize:12 }}>
                    <span style={{ color:C.dim }}>{m.tipo_movimento?.descricao}{m.observacao?` — ${m.observacao}`:""}</span>
                    <span style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ color: m.natureza==="receita"?C.win:C.loss, fontWeight:700 }}>{m.natureza==="receita"?"+":"−"} {fmtMoeda(m.valor)}</span>
                      {!readOnly && ev.status!=="encerrado" && <button onClick={()=>removerMov(m)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:14 }}>✕</button>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ações */}
            {!readOnly && (
              <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
                {ev.status!=="encerrado" && ev.modo==="detalhado" && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>abrirLancar(ev)}>+ Lançar receita/despesa</Btn>}
                {ev.status!=="encerrado" && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>abrirEditar(ev)}>Editar</Btn>}
                {!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>setLinkEvento(ev)}>📲 Confirmação</Btn>}
                {ev.status!=="encerrado" && <Btn style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>encerrar(ev)}>Encerrar</Btn>}
                {ev.status==="encerrado" && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>reabrir(ev)}>🔓 Reabrir</Btn>}
                {!movs.length && <Btn variant="danger" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>excluir(ev)}>Excluir</Btn>}
              </div>
            )}
          </Card>
        );
      })}
      {(eventos||[]).length===0 && <Card style={{ padding:24, textAlign:"center", color:C.dim }}>Nenhum evento cadastrado.</Card>}

      {/* Modal criar/editar evento */}
      {modal && (
        <Modal title={modal==="novo"?"Novo Evento":"Editar Evento"} onClose={()=>setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome do Evento" value={form.nome||""} onChange={e=>set("nome",e.target.value)} placeholder="Ex: Buffet de cachorro-quente"/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Data" type="date" value={form.data_evento||""} onChange={e=>set("data_evento",e.target.value)}/>
              <Input label="Meta (R$)" type="number" min="0" step="0.01" value={form.meta||""} onChange={e=>set("meta",e.target.value)}/>
            </div>
            <Input label="Link de localização (opcional)" placeholder="https://maps.google.com/..." value={form.link_local||""} onChange={e=>set("link_local",e.target.value)}/>
            <Select label="Temporada" value={form.id_temporada} onChange={e=>set("id_temporada",e.target.value)}>
              <option value="">Sem vínculo</option>
              {(temporadas||[]).map(t=><option key={t.id_temporada} value={t.id_temporada}>{t.nome}</option>)}
            </Select>
            <Select label="Modo de apuração" value={form.modo} onChange={e=>set("modo",e.target.value)}>
              <option value="detalhado">Detalhado (vincular receitas/despesas)</option>
              <option value="direto">Resultado direto (digitar valor final)</option>
            </Select>
            {form.modo==="direto" && (
              <Input label="Resultado Final (R$)" type="number" step="0.01" value={form.resultado_direto||""} onChange={e=>set("resultado_direto",e.target.value)}/>
            )}
            <Input label="Observações" value={form.observacoes||""} onChange={e=>set("observacoes",e.target.value)}/>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <Btn variant="secondary" onClick={()=>setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving||readOnly}>{saving?"Salvando...":"Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal lançar movimento no evento */}
      {linkEvento && (
        <Modal title={`Confirmação de presença — ${linkEvento.nome}`} onClose={()=>setLinkEvento(null)}>
          <LinkConfirmacao tipo="evento" idRef={linkEvento.id_evento} idTime={idTime} dataRef={linkEvento.data_evento} show={show} />
          <div style={{ marginTop:14, display:"flex", justifyContent:"flex-end" }}>
            <CompartilharPresenca tipo="evento" idRef={linkEvento.id_evento} idTime={idTime} titulo={linkEvento.nome} data={linkEvento.data_evento} linkLocal={linkEvento.link_local} time={_timeEvento?.[0]} show={show} />
          </div>
        </Modal>
      )}
      {detalhe && (
        <Modal title={`Lançar em — ${detalhe.nome}`} onClose={()=>setDetalhe(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Select label="Tipo (receita/despesa)" value={formMov.id_tipo_movimento} onChange={e=>setM("id_tipo_movimento",e.target.value)}>
              <option value="">Selecione...</option>
              <optgroup label="Receitas">
                {(tiposMov||[]).filter(t=>t.natureza==="receita").map(t=><option key={t.id_tipo_movimento} value={t.id_tipo_movimento}>{t.descricao}</option>)}
              </optgroup>
              <optgroup label="Despesas">
                {(tiposMov||[]).filter(t=>t.natureza==="despesa").map(t=><option key={t.id_tipo_movimento} value={t.id_tipo_movimento}>{t.descricao}</option>)}
              </optgroup>
            </Select>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Valor (R$)" type="number" min="0" step="0.01" value={formMov.valor||""} onChange={e=>setM("valor",e.target.value)}/>
              <Input label="Data" type="date" value={formMov.data_movimento||""} onChange={e=>setM("data_movimento",e.target.value)}/>
            </div>
            <Input label="Observação" value={formMov.observacao||""} onChange={e=>setM("observacao",e.target.value)}/>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <Btn variant="secondary" onClick={()=>setDetalhe(null)}>Fechar</Btn>
              <Btn onClick={salvarMov} disabled={saving}>{saving?"Salvando...":"Adicionar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


export default function AdminAppCompleto() {
  const [session, setSession]       = useState(SESSION_TOKEN ? {access_token: SESSION_TOKEN} : null);
  const [sessaoExpirou, setSessaoExpirou] = useState(false);
  const [idTime, setIdTime]         = useState(null);
  const [meusTimes, setMeusTimes]   = useState([]); // vínculos do admin (pode ter vários times)
  const [timeInativo, setTimeInativo] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [menu, setMenu] = useState("inicio");

  useEffect(() => {
    const handler = () => { setSessaoExpirou(true); setSession(null); };
    window.addEventListener("ndc-sessao-expirada", handler);
    return () => window.removeEventListener("ndc-sessao-expirada", handler);
  }, []);

  const [partida, setPartida]   = useState(null);
  const [novaPartida, setNovaPartida] = useState(false);
  const { toast, show }         = useToast();

  // Verificar manutenção do sistema
  const { data: todosTimesSuper } = useQuery(() =>
    isSuperadmin ? api.get(`time?select=id_time,nome,observacao_super&order=nome.asc`) : Promise.resolve([]),
    [isSuperadmin]
  );
  const { data: manutCfg, loading: loadManut } = useQuery(() =>
    api.get(`config_sistema?chave=eq.sistema_manutencao&select=valor&limit=1`)
  );
  const emManutencao = ["true","1"].includes(String(manutCfg?.[0]?.valor ?? "").trim().toLowerCase());

  // Buscar time do usuário logado
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return; // espera o id do usuário estar disponível (evita query com user_id vazio = erro 400)
    api.get(`usuario_time?user_id=eq.${uid}&select=*,time(*)`)
      .then(data => {
        if (data?.length) {
          // Superadmin: vê tudo (tem vínculo com role superadmin)
          const sa = data.find(ut => ut.role === 'superadmin');
          if (sa) {
            setIsSuperadmin(true);
            setIdTime(null); // superadmin vê tudo
            return;
          }
          // Admin comum: pode ter vínculo com VÁRIOS times.
          // Considera só os times ativos.
          const ativos = data.filter(ut => ut.time?.status !== 'Inativo');
          if (ativos.length === 0) {
            // todos os times do usuário estão inativos
            setTimeInativo(true);
            return;
          }
          setMeusTimes(ativos);
          if (ativos.length === 1) {
            // só um time: entra direto nele
            setIdTime(ativos[0].id_time);
          }
          // se tiver mais de um, idTime fica null e o seletor aparece (abaixo)
        }
      }).catch(() => {});
  }, [session]);

  const { data: times }      = useQuery(() => 
    idTime ? api.get(`time?id_time=eq.${idTime}&select=*&limit=1`) : Promise.resolve([]),
    [session, idTime]
  );

  // Flag de turma fechada — query simples na tipo_time (sem embedding, evita
  // ambiguidade de FK). Fica aqui junto dos demais hooks, ANTES de returns condicionais.
  const _idTipoTime = times?.[0]?.id_tipo_time;
  const { data: _tipoDoTime } = useQuery(() =>
    _idTipoTime ? api.get(`tipo_time?id_tipo_time=eq.${_idTipoTime}&select=eh_turma_fechada&limit=1`) : Promise.resolve([]),
    [_idTipoTime]
  );

  const { data: permissoesRaw } = useQuery(() =>
    session?.user?.id && idTime
      ? api.get(`usuario_permissao?user_id=eq.${session.user.id}&id_time=eq.${idTime}&select=*`)
      : Promise.resolve([]),
    [session, idTime]
  );

  const perms = React.useMemo(() => {
    const mapa = {};
    ["inicio","app","partidas","jogadores","adversarios","campos","posicoes","temporadas","time","mensalidades","caixa","eventos","tiposmov"]
      .forEach(m => {
        const p = (permissoesRaw||[]).find(x => x.modulo === m);
        mapa[m] = { ver: p ? p.pode_ver : true, editar: p ? p.pode_editar : true };
      });
    return mapa;
  }, [permissoesRaw]);

  function canVer(modulo)  { return perms[modulo]?.ver    !== false; }
  function canEdit(modulo) { return perms[modulo]?.editar !== false; }

  // Redirecionar para o primeiro menu permitido após carregar permissões
  useEffect(() => {
    if (!permissoesRaw) return;
    if (!canVer(menu)) {
      const primeiro = MENU_BASE.find(m => canVer(m.id));
      if (primeiro) setMenu(primeiro.id);
    }
  }, [permissoesRaw]);

  const { data: temporadas } = useQuery(() => 
    idTime ? api.get(`temporada?id_time=eq.${idTime}&select=*&order=data_inicio.desc`) : Promise.resolve([]),
    [session, idTime]
  );
  // Dados para onboarding
  const { data: _cidades }    = useQuery(() => api.get(`cidade?select=id_cidade&limit=1`), [session]);
  const { data: _campos }     = useQuery(() => idTime ? api.get(`campo?id_time=eq.${idTime}&select=id_campo&limit=1`) : Promise.resolve([]), [session, idTime]);
  const { data: _posicoes }   = useQuery(() => api.get(`posicao?select=id_posicao&limit=1`), [session]);
  const { data: _adversarios } = useQuery(() => idTime ? api.get(`adversario?id_time=eq.${idTime}&select=id_adversario&limit=1`) : Promise.resolve([]), [session, idTime]);
  const { data: _jogadores }  = useQuery(() => idTime ? api.get(`jogador?id_time=eq.${idTime}&id_jogador=gt.0&select=id_jogador&limit=1`) : Promise.resolve([]), [session, idTime]);
  const _idsTemp = (temporadas||[]).map(t=>t.id_temporada).join(",");
  const { data: _partidas }   = useQuery(() => _idsTemp ? api.get(`partida?id_temporada=in.(${_idsTemp})&select=id_partida&limit=1`) : Promise.resolve([]), [_idsTemp]);
  const { data: _timesInternos } = useQuery(() => idTime ? api.get(`time_interno?id_time=eq.${idTime}&select=id_time_interno&limit=1`) : Promise.resolve([]), [session, idTime]);
  const { data: _encontros }  = useQuery(() => _idsTemp ? api.get(`encontro?id_temporada=in.(${_idsTemp})&select=id_encontro&limit=1`) : Promise.resolve([]), [_idsTemp]);
  const [temporadaSel, setTemporadaSel] = useState(null);
  useEffect(() => {
    const lista = temporadas || [];
    if (lista.length === 0) { if (temporadaSel) setTemporadaSel(null); return; }
    const aindaValida = temporadaSel && lista.some(t => t.id_temporada === temporadaSel.id_temporada);
    if (!aindaValida) setTemporadaSel(lista[0]);
  }, [temporadas]);

  if (loadManut) return null;

  // Sistema em manutenção — bloqueia tudo, exceto superadmin já logado
  if (emManutencao && !isSuperadmin) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif" }}>
        <div style={{ textAlign:"center", maxWidth:420 }}>
          <div style={{ fontSize:64, marginBottom:20 }}>🔧</div>
          <div style={{ fontSize:26, fontWeight:800, color:C.cream, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.06em" }}>
            Sistema em Manutenção
          </div>
          <div style={{ fontSize:15, color:C.dim, lineHeight:1.7 }}>
            Estamos realizando melhorias no Nerd do Campo.
            Volte em alguns instantes — já já estaremos de volta! ⚽
          </div>
          <div style={{ fontSize:13, color:C.gold, fontWeight:700, marginTop:24 }}>
            nerddocampo.com.br
          </div>
        </div>
      </div>
    );
  }

  if (!session) return <Login onLogin={(r) => { setSessaoExpirou(false); setSession(r); }} aviso={sessaoExpirou ? "Sua sessão expirou. Faça login novamente." : ""} />;

  // Bloqueio de time inativo
  if (timeInativo) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif" }}>
        <div style={{ background:C.surface, borderRadius:16, padding:40, maxWidth:420, textAlign:"center", border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🔒</div>
          <div style={{ fontSize:22, fontWeight:800, color:C.cream, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>Acesso Suspenso</div>
          <div style={{ fontSize:14, color:C.dim, lineHeight:1.7, marginBottom:24 }}>
            O acesso do seu time está temporariamente <b style={{ color:C.loss }}>inativo</b>.
            Entre em contato com o administrador do sistema para regularizar a situação.
          </div>
          <div style={{ fontSize:13, color:C.gold, fontWeight:700, marginBottom:24 }}>
            nerddocampo10@gmail.com
          </div>
          <button onClick={() => { SESSION_TOKEN=null; REFRESH_TOKEN=null; sessionStorage.removeItem("ndc_token"); sessionStorage.removeItem("ndc_refresh"); setSession(null); setTimeInativo(false); }}
            style={{ background:C.gold, color:"#0B3D2E", border:"none", borderRadius:10, padding:"12px 32px", fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:"pointer", textTransform:"uppercase" }}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  const time = times?.[0];
  const ehTurmaFechada = !!_tipoDoTime?.[0]?.eh_turma_fechada;

  function navMenu(id) { setMenu(id); setPartida(null); setNovaPartida(false); }
  // Menu base + item de Times Internos (só para turma fechada). Aditivo: times tradicionais não veem.
  const MENU_COM_TURMA = ehTurmaFechada
    ? (() => {
        // Turma fechada: remove Adversários (não há adversário externo),
        // renomeia Partidas→Encontros e adiciona Times Internos.
        const base = MENU_BASE
          .filter(m => m.id !== "adversarios")
          .map(m => m.id === "partidas" ? { ...m, label:"Encontros", icon:"📋" } : m);
        const idx = base.findIndex(m => m.id === "jogadores");
        const item = { id:"times_internos", label:"Times Internos", icon:"🧡", grupo:"Cadastros" };
        if (idx >= 0) base.splice(idx + 1, 0, item); else base.push(item);
        return base;
      })()
    : MENU_BASE;
  const MENU = MENU_COM_TURMA.filter(m => canVer(m.id));

  const secTitle = (label) => (
    <div style={{ fontSize:18, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:4, height:24, background:C.gold, borderRadius:2 }}/>
      {label}
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif", color:C.cream, display:"flex", flexDirection:"column" }}>
      <style>{`
        /* ── Navegação mobile: retrato (largura) OU paisagem de celular (altura baixa) ── */
        @media (max-width:768px), (max-height:600px) and (orientation:landscape){
          .admin-header{padding:0 12px !important; gap:8px !important;}
          .header-time-nome{display:none;}
          .admin-layout{flex-direction:column !important;}
          /* Sidebar vira barra horizontal rolável no topo do conteúdo */
          .admin-sidebar{
            width:100% !important; height:auto !important; max-height:none !important; position:sticky; top:64px;
            display:flex !important; flex-direction:row !important; overflow-x:auto; overflow-y:hidden;
            border-right:none !important; border-bottom:1px solid #1F5C3E;
            padding:6px 8px !important; gap:4px; -webkit-overflow-scrolling:touch; z-index:90;
          }
          .admin-sidebar .menu-grupo{display:flex; flex-direction:row; align-items:center; flex-shrink:0;}
          .admin-sidebar .menu-grupo-titulo{display:none !important;}
          .admin-sidebar button{
            white-space:nowrap; flex-shrink:0; border-left:none !important;
            border-bottom:3px solid transparent; padding:8px 12px !important; font-size:11px !important;
          }
          .admin-main{padding:16px 12px !important;}
          /* Inputs nativos não excedem o container */
          input, select, textarea{max-width:100% !important; box-sizing:border-box !important;}
        }
        /* ── Empilhamento de campos: só telas realmente estreitas (retrato/celular pequeno) ── */
        @media(max-width:560px){
          .form-grid-2, .form-grid-3, .form-grid-auto{grid-template-columns:1fr !important;}
          .campo-flex{min-width:100% !important; flex:1 1 100% !important;}
          .presenca-acoes{flex-direction:column !important; align-items:stretch !important;}
          .presenca-acoes > *{width:100% !important; min-width:0 !important;}
        }
        /* Grids reutilizáveis (desktop) */
        .form-grid-2{display:grid; grid-template-columns:1fr 1fr; gap:12px;}
        /* Campos do encontro: grid que se adapta — nunca estoura nem sobrepõe.
           auto-fit + minmax garante colunas que encolhem até caber. */
        .campos-encontro{display:flex; flex-direction:column; gap:14px; max-width:420px;}
        .campos-encontro > *{width:100%;}
        .form-grid-3{display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;}
        .form-grid-auto{display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px;}
      `}</style>
      <Toast {...(toast||{msg:null})} />

      {/* Header */}
      <header className="admin-header" style={{ background:"#091F15", borderBottom:`3px solid ${C.gold}`, padding:"0 24px", display:"flex", alignItems:"center", gap:16, height:64, position:"sticky", top:0, zIndex:100, boxShadow:"0 4px 20px #00000066" }}>
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
          {isSuperadmin && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11, color:C.gold, fontWeight:700, textTransform:"uppercase" }}>👑 Super</span>
              <select value={idTime||""} onChange={e => { const v=e.target.value; setIdTime(v?Number(v):null); setTemporadaSel(null); setMenu("inicio"); setPartida(null); setNovaPartida(false); }}
                style={{ background:C.surf2, color: idTime?C.cream:C.gold, border:`1px solid ${idTime?C.border:C.gold}`, borderRadius:8, padding:"6px 10px", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
                <option value="">— Selecione um time —</option>
                {(todosTimesSuper||[]).map(t=>{
                  const obs = (t.observacao_super||"").trim();
                  const obsCurta = obs.length > 45 ? obs.slice(0,45)+"…" : obs;
                  return <option key={t.id_time} value={t.id_time}>{t.nome}{obsCurta ? ` — ${obsCurta}` : ""}</option>;
                })}
              </select>
            </div>
          )}
          {!isSuperadmin && meusTimes.length > 1 && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11, color:C.gold, fontWeight:700, textTransform:"uppercase" }}>Meus times</span>
              <select value={idTime||""} onChange={e => { const v=e.target.value; setIdTime(v?Number(v):null); setTemporadaSel(null); setMenu("inicio"); setPartida(null); setNovaPartida(false); }}
                style={{ background:C.surf2, color: idTime?C.cream:C.gold, border:`1px solid ${idTime?C.border:C.gold}`, borderRadius:8, padding:"6px 10px", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
                <option value="">— Selecione um time —</option>
                {meusTimes.map(ut=><option key={ut.id_time} value={ut.id_time}>{ut.time?.nome || `Time ${ut.id_time}`}</option>)}
              </select>
            </div>
          )}
          {time?.escudo_url
            ? <img src={time.escudo_url} alt={time.nome} style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}` }}/>
            : null
          }
          <span className="header-time-nome" style={{ fontSize:12, color:C.dim }}>{time?.nome || ""}</span>
          {isSuperadmin && time?.observacao_super && (
            <span title={time.observacao_super}
              style={{ fontSize:11, color:C.gold, background:C.gold+"22", border:`1px solid ${C.gold}66`, borderRadius:6, padding:"2px 8px", maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"help" }}>
              📝 {time.observacao_super}
            </span>
          )}
          {(temporadas||[]).length > 1 && (
            <select value={temporadaSel?.id_temporada||""} onChange={e => setTemporadaSel(temporadas.find(t=>t.id_temporada===Number(e.target.value)))}
              style={{ background:C.surf2, color:C.cream, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", fontFamily:"inherit", fontSize:12 }}>
              {(temporadas||[]).map(t=><option key={t.id_temporada} value={t.id_temporada}>{t.nome}</option>)}
            </select>
          )}
          <Btn variant="danger" style={{ fontSize:11, padding:"6px 12px" }} onClick={() => { SESSION_TOKEN=null; REFRESH_TOKEN=null; sessionStorage.removeItem("ndc_token"); sessionStorage.removeItem("ndc_refresh"); setSession(null); }}>Sair</Btn>
        </div>
      </header>

      <div className="admin-layout" style={{ display:"flex", flex:1 }}>
        {/* Sidebar */}
        <aside className="admin-sidebar" style={{ width:210, background:"#091F15", borderRight:`1px solid ${C.border}`, padding:"16px 0", flexShrink:0, position:"sticky", top:64, height:"calc(100vh - 64px)", overflowY:"auto" }}>
          {/* Item sem grupo: Início */}
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
          {["Configurar","Cadastros","Jogos","Financeiro","Acompanhar"].map(grupo => {
            const itens = MENU.filter(m => m.grupo === grupo);
            if (!itens.length) return null;
            return (
              <div key={grupo} className="menu-grupo">
                <div className="menu-grupo-titulo" style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:700, padding:"12px 20px 6px" }}>{grupo}</div>
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
        <main className="admin-main" style={{ flex:1, padding:"28px 28px", minWidth:0 }}>
          {isSuperadmin && !idTime ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:C.dim }}>
              <div style={{ fontSize:48, marginBottom:16 }}>👑</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.cream, marginBottom:8 }}>Modo Super Admin</div>
              <div style={{ fontSize:14, maxWidth:420, margin:"0 auto", lineHeight:1.6 }}>
                Selecione um time no menu <b style={{ color:C.gold }}>👑 Super</b> no topo da tela
                para visualizar e gerenciar os dados dele. Para a gestão geral do sistema, use o painel <b>/super</b>.
              </div>
            </div>
          ) : !isSuperadmin && meusTimes.length > 1 && !idTime ? (
            <div style={{ textAlign:"center", padding:"60px 20px", color:C.dim }}>
              <div style={{ fontSize:48, marginBottom:16 }}>⚽</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.cream, marginBottom:8 }}>Você gerencia {meusTimes.length} times</div>
              <div style={{ fontSize:14, maxWidth:420, margin:"0 auto", lineHeight:1.6 }}>
                Selecione um time no menu <b style={{ color:C.gold }}>Meus times</b> no topo da tela
                para começar a gerenciá-lo.
              </div>
            </div>
          ) : (<>
          {/* Badge somente leitura */}
          {menu !== "inicio" && menu !== "app" && menu !== "dicas" && menu !== "ajuda" && !canEdit(menu) && (
            <div style={{ background:C.gold+"22", border:`1px solid ${C.gold}44`, borderRadius:8,
              padding:"8px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
              <span style={{ fontSize:16 }}>👁️</span>
              <span style={{ color:C.gold, fontWeight:700 }}>Modo somente leitura</span>
              <span style={{ color:C.dim }}>— Você pode visualizar mas não pode editar este módulo.</span>
            </div>
          )}
          {menu === "inicio" && (
            <PaginaInicio
              dados={{ cidades:_cidades, campos:_campos, posicoes:_posicoes, adversarios:_adversarios, jogadores:_jogadores, temporadas, partidas:_partidas, ehTurmaFechada, timesInternos:_timesInternos, encontros:_encontros }}
              onNavegar={setMenu}
            />
          )}
          {menu === "app" && (
            <VisaoAppPublico time={(times||[])[0]} temporadas={temporadas}/>
          )}
          {/* Turma fechada: "Partidas" vira "Encontros" */}
          {menu === "partidas" && ehTurmaFechada && (<>{secTitle("Encontros")}
            <ListaEncontros idTime={idTime} temporada={temporadaSel} show={show} readOnly={!canEdit("partidas")} />
          </>)}
          {menu === "partidas" && !ehTurmaFechada && !temporadaSel && (
            <Card style={{ padding:32, textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📆</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.cream, marginBottom:8 }}>Nenhuma temporada cadastrada</div>
              <div style={{ fontSize:14, color:C.dim, marginBottom:20, maxWidth:420, margin:"0 auto 20px" }}>
                As partidas pertencem a uma temporada. Crie a sua primeira temporada para começar a cadastrar jogos.
              </div>
              {canEdit("temporadas")
                ? <Btn onClick={() => navMenu("temporadas")}>+ Criar primeira temporada</Btn>
                : <div style={{ fontSize:12, color:C.dim }}>Peça a um administrador para cadastrar a temporada.</div>}
            </Card>
          )}
          {menu === "partidas" && !ehTurmaFechada && !partida && !novaPartida && temporadaSel && (<>
            {secTitle(`Partidas — ${temporadaSel.nome}`)}
            <ListaPartidasWrapper temporada={temporadaSel} onSelect={p=>{setPartida(p);}} onNova={()=>setNovaPartida(true)} show={show} />
          </>)}

          {menu === "partidas" && !ehTurmaFechada && novaPartida && temporadaSel && (<>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              {secTitle("Nova Partida")}
              <Btn variant="secondary" style={{ fontSize:11, padding:"6px 12px", marginTop:-20 }} onClick={()=>setNovaPartida(false)}>← Voltar</Btn>
            </div>
            <Card style={{ padding:24 }}>
              <FormNovaPartida temporada={temporadaSel} onSalvo={()=>setNovaPartida(false)} onCancelar={()=>setNovaPartida(false)} readOnly={!canEdit("partidas")} />
            </Card>
          </>)}

          {menu === "partidas" && !ehTurmaFechada && partida && !novaPartida && (<>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              {secTitle("Ficha da Partida")}
              <Btn variant="secondary" style={{ fontSize:11, padding:"6px 12px", marginTop:-20 }} onClick={()=>setPartida(null)}>← Voltar</Btn>
            </div>
            <FichaPartida partida={partida} onVoltar={()=>setPartida(null)} readOnly={!canEdit("partidas")} idTime={idTime} temporada={temporadaSel}/>
          </>)}

          {menu === "jogadores"   && (<>{secTitle("Jogadores")}<CrudJogadores idTime={idTime} show={show} readOnly={!canEdit("jogadores")} /></>)}
          {menu === "adversarios" && (<>{secTitle("Adversários")}<CrudAdversarios idTime={idTime} show={show} readOnly={!canEdit("adversarios")} /></>)}
          {menu === "campos"      && (<>{secTitle("Campos")}<CrudCampos idTime={idTime} show={show} readOnly={!canEdit("campos")} /></>)}
          {menu === "posicoes"    && (<>{secTitle("Posições")}<CrudPosicoes idTime={idTime} show={show} readOnly={!canEdit("posicoes")} /></>)}
          {menu === "times_internos" && (<>{secTitle("Times Internos")}<CrudTimesInternos idTime={idTime} show={show} readOnly={!canEdit("times_internos")} /></>)}
          {menu === "temporadas"  && (<>{secTitle("Temporadas")}<CrudTemporadas idTime={idTime} show={show} readOnly={!canEdit("temporadas")} /></>)}
          {menu === "mensalidades" && (<CrudMensalidades idTime={idTime} show={show} readOnly={!canEdit("mensalidades")}/>)}
          {menu === "caixa"         && (<CrudCaixa idTime={idTime} show={show} readOnly={!canEdit("caixa")}/>)}
          {menu === "eventos"       && (<CrudEventos idTime={idTime} show={show} readOnly={!canEdit("eventos")}/>)}
          {menu === "tiposmov"      && (<CrudTiposMov idTime={idTime} show={show} readOnly={!canEdit("tiposmov")}/>)}
          {menu === "dicas"         && (<PaginaDicas ehTurmaFechada={ehTurmaFechada}/>)}
          {menu === "ajuda"         && (<PaginaAjuda/>)}
          {menu === "time"        && (<>{secTitle("Configurações do Time")}<ConfigTime idTime={idTime} show={show} readOnly={!canEdit("time")} /></>)}
          </>)}
        </main>
      </div>
      <footer style={{ position:"sticky", bottom:0, zIndex:90, background:"#091F15", borderTop:`1px solid ${C.border}`,
        padding:"8px 20px", textAlign:"center", fontSize:12, color:C.dim, lineHeight:1.4 }}>
        👥 Seu time pode ter <b style={{color:C.cream}}>vários administradores</b>, cada um com acesso aos módulos que você definir — e, em cada módulo, é possível liberar <b style={{color:C.cream}}>só visualização</b> ou também <b style={{color:C.cream}}>edição</b>.
        <span style={{color:C.gold}}> A quantidade de usuários não altera o valor da mensalidade do time.</span>
        {canEdit("time") && <> Fale com o suporte para adicionar novos acessos.</>}
      </footer>
    </div>
  );
}


// ── CRUD JOGADORES ────────────────────────────────────────────

function TabelaJogadores({ grupo, lista, sk, asc, onSort, onEditar, onInativar, onReativar, readOnly, mapaPosJog }) {
  if (!lista.length) return null;
  const S = k => <ThSortable colKey={k} sortKey={sk} asc={asc} onSort={onSort}/>;
  return (
    <div>
      <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>{grupo} ({lista.length})</div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:C.surf2 }}>
            <ThSortable colKey="camisa"      sortKey={sk} asc={asc} onSort={onSort}>#</ThSortable>
            <ThSortable colKey="nome"        sortKey={sk} asc={asc} onSort={onSort}>Nome</ThSortable>
            <ThSortable colKey="apelido"     sortKey={sk} asc={asc} onSort={onSort}>Apelido</ThSortable>
            <ThSortable colKey="data_nascimento" sortKey={sk} asc={asc} onSort={onSort}>Nascimento</ThSortable>
            <ThSortable colKey="idade_sort" sortKey={sk} asc={asc} onSort={onSort}>Idade</ThSortable>
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
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{j.data_nascimento ? new Date(j.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" }) : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{calcularIdade(j.data_nascimento) != null ? `${calcularIdade(j.data_nascimento)} anos` : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{j.posicao?.nome ? (j.posicao.id_posicao_pai && mapaPosJog[j.posicao.id_posicao_pai] ? `${mapaPosJog[j.posicao.id_posicao_pai]} › ${j.posicao.nome}` : j.posicao.nome) : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{j.telefone || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{j.email || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{j.data_inicio ? new Date(j.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{j.data_fim ? new Date(j.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={j.observacoes||""}>{j.observacoes || "—"}</td>
                <td style={{ padding:"11px 14px", whiteSpace:"nowrap" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => onEditar(j)}>Editar</Btn>
                    {!j.data_fim && !readOnly && <Btn variant="danger" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => onInativar(j)}>Inativar</Btn>}
                    {j.data_fim && !readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px", color:C.win, borderColor:C.win }} onClick={() => onReativar(j)}>Reativar</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}


function CrudJogadores({ idTime, show, readOnly }) {
  const _idTimeJ = idTime; // recebido por prop (filtrado pelo usuário logado)
  // Tipo de time, para filtrar as posições disponíveis
  const { data: _timeInfo } = useQuery(() => _idTimeJ ? api.get(`time?id_time=eq.${_idTimeJ}&select=id_tipo_time,id_subtipo&limit=1`) : Promise.resolve([]), [_idTimeJ]);
  const _tipoTimeJ = _timeInfo?.[0]?.id_subtipo || _timeInfo?.[0]?.id_tipo_time;
  const { data: jogadores, loading, reload } = useQuery(() => 
    _idTimeJ ? api.get(`jogador?id_jogador=gt.0&id_time=eq.${_idTimeJ}&select=*,posicao(nome,ordem,id_posicao_pai)&order=camisa.asc`) : Promise.resolve([]),
    [_idTimeJ]
  );
  // Todas as posições (para resolver nome do grupo pai no front) e só as do tipo (para o select)
  const { data: todasPosicoes } = useQuery(() => api.get(`posicao?select=id_posicao,nome&order=nome.asc`));
  const mapaPosJog = React.useMemo(() => {
    const m = {}; (todasPosicoes||[]).forEach(p => { m[p.id_posicao] = p.nome; }); return m;
  }, [todasPosicoes]);
  // Posições do tipo de time (inclui planas e filhas; exclui apenas grupos-pai que tenham filhos)
  const { data: posicoes } = useQuery(() => _tipoTimeJ ? api.get(`posicao?id_tipo_time=eq.${_tipoTimeJ}&select=*&order=ordem.asc,nome.asc`) : Promise.resolve([]), [_tipoTimeJ]);
  const posicoesLista = posicoes || [];
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() { setForm({ nome:"", apelido:"", camisa:"", id_posicao:"", telefone:"", email:"", data_nascimento:"", data_inicio:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(j) { setForm({ ...j, id_posicao: j.id_posicao ? String(j.id_posicao) : "" }); setModal(j); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, apelido: form.apelido||null, camisa: form.camisa||null, id_posicao: form.id_posicao ? Number(form.id_posicao) : null, telefone: form.telefone||null, email: form.email||null, data_nascimento: form.data_nascimento||null, data_inicio: form.data_inicio||null, observacoes: form.observacoes||null, foto_url: form.foto_url||null, id_time: idTime||null };
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
      const id_time_val = idTime || null;
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
  const _comIdade = (jogadores||[]).map(j => ({ ...j, idade_sort: calcularIdade(j.data_nascimento) ?? -1 }));
  const ativos   = _comIdade.filter(j => !j.data_fim);
  const inativos = _comIdade.filter(j =>  j.data_fim);

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
        {!readOnly && <Btn onClick={abrirNovo}>+ Novo Jogador</Btn>}
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      {ativos.length > 0 && (
        <TabelaJogadores grupo="Ativos" lista={sortData(ativos, _sk, _asc)} sk={_sk} asc={_asc}
          onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}
          onEditar={abrirEditar} onInativar={inativar} onReativar={reativar} readOnly={readOnly} mapaPosJog={mapaPosJog}/>
      )}
      {inativos.length > 0 && (
        <TabelaJogadores grupo="Inativos" lista={sortData(inativos, _sk, _asc)} sk={_sk} asc={_asc}
          onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}
          onEditar={abrirEditar} onInativar={inativar} onReativar={reativar} readOnly={readOnly} mapaPosJog={mapaPosJog}/>
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
                {(() => {
                  const idsComFilhas = new Set((posicoes||[]).filter(p => p.id_posicao_pai).map(p => p.id_posicao_pai));
                  return (posicoes||[])
                    .filter(p => p.id_posicao_pai || !idsComFilhas.has(p.id_posicao))
                    .map(p => <option key={p.id_posicao} value={p.id_posicao}>{p.nome}</option>);
                })()}
              </Select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Data de nascimento" type="date" value={form.data_nascimento ? String(form.data_nascimento).split("T")[0] : ""} onChange={e => set("data_nascimento", e.target.value)} />
            </div>
            {(posicoes||[]).length === 0 && (
              <div style={{ fontSize:12, color:C.gold, marginTop:-4 }}>
                ⚠️ Nenhuma posição cadastrada para o tipo deste time. Fale com o suporte para configurar as posições.
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Input label="Telefone" value={form.telefone||""} onChange={e => set("telefone", e.target.value)} />
              <Input label="E-mail" type="email" value={form.email||""} onChange={e => set("email", e.target.value)} />
            </div>
            <Input label="Data de Início" type="date" value={form.data_inicio||""} onChange={e => set("data_inicio", e.target.value)} />
            <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD ADVERSÁRIOS ──────────────────────────────────────────
function CrudAdversarios({ idTime, show, readOnly }) {
  const _idTimeA = idTime; // recebido por prop (filtrado pelo usuário logado)
  const { data: adversarios, loading, reload } = useQuery(() => 
    _idTimeA ? api.get(`adversario?id_time=eq.${_idTimeA}&select=*,campo:id_campo(nome),cidade(nome,estado)&order=nome.asc`) : Promise.resolve([]),
    [_idTimeA]
  );
  const [_sk, _setSk] = useState("nome"); const [_asc, _setAsc] = useState(true);
  const { data: campos }  = useQuery(() => _idTimeA ? api.get(`campo?id_time=eq.${_idTimeA}&select=*&order=nome.asc`) : Promise.resolve([]), [_idTimeA]);
  const [ufAdv, setUfAdv] = useState("RS");
  const { data: cidades } = useQuery(() => ufAdv ? api.get(`cidade?estado=eq.${ufAdv}&select=id_cidade,nome,estado&order=nome.asc`) : Promise.resolve([]), [ufAdv]);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function confirmarImport() {
    setSaving(true);
    try {
      const id_time_val = idTime || null;
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
  function abrirEditar(a) { setForm({ ...a, id_campo: a.id_campo?String(a.id_campo):"", id_cidade: a.id_cidade?String(a.id_cidade):"" }); setModal(a); if (a.id_cidade) { api.get(`cidade?id_cidade=eq.${a.id_cidade}&select=estado&limit=1`).then(d => { if (d?.[0]?.estado) setUfAdv(d[0].estado); }).catch(()=>{}); } }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, id_campo: form.id_campo?Number(form.id_campo):null, id_cidade: form.id_cidade?Number(form.id_cidade):null, contato: form.contato||null, observacoes: form.observacoes||null, id_time: idTime||null };
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
        {!readOnly && <Btn onClick={abrirNovo}>+ Novo Adversário</Btn>}
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
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
                <td style={{ padding:"11px 14px" }}>{!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(a)}>Editar</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      {modal && (
        <Modal title={modal === "novo" ? "Novo Adversário" : "Editar Adversário"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
            <Select label="Campo" value={form.id_campo||""} onChange={e => set("id_campo", e.target.value)}>
              <option value="">Selecione...</option>
              {(campos||[]).map(c => <option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
            </Select>
            <Select label="Estado (UF)" value={ufAdv} onChange={e => { setUfAdv(e.target.value); set("id_cidade", ""); }}>
              {UFS_BR.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Select label="Cidade" value={form.id_cidade||""} onChange={e => set("id_cidade", e.target.value)}>
              <option value="">{cidades === null ? "Carregando..." : "Selecione..."}</option>
              {(cidades||[]).map(c => <option key={c.id_cidade} value={c.id_cidade}>{c.nome}</option>)}
            </Select>
            <Input label="Contato" value={form.contato||""} onChange={e => set("contato", e.target.value)} />
            <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD CAMPOS ───────────────────────────────────────────────
function CrudCampos({ idTime, show, readOnly }) {
  const { data: campos, loading, reload } = useQuery(() => idTime ? api.get(`campo?id_time=eq.${idTime}&select=*,cidade(nome,estado)&order=nome.asc`) : Promise.resolve([]), [idTime]);
  const [ufCampo, setUfCampo] = useState("RS");
  const { data: cidades } = useQuery(() => ufCampo ? api.get(`cidade?estado=eq.${ufCampo}&select=id_cidade,nome,estado&order=nome.asc`) : Promise.resolve([]), [ufCampo]);
  // Base nacional completa (para a planilha de referência e validação da importação por nome+UF)
  const [cidadesBR, setCidadesBR] = useState([]);
  useEffect(() => { carregarTodasCidades().then(setCidadesBR).catch(()=>{}); }, []);
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
        const cidadeNome = String(row.cidade||"").trim().toUpperCase();
        const ufRow = String(row.uf||"").trim().toUpperCase();
        let cidade = null;
        if (cidadeNome) {
          let cand = (cidadesBR||[]).filter(c => c.nome.toUpperCase() === cidadeNome);
          if (ufRow) cand = cand.filter(c => (c.estado||"").toUpperCase() === ufRow);
          cidade = cand[0] || null;
        }
        const body = { nome: String(row.nome||"").trim(), endereco: row.endereco||null, id_cidade: cidade?.id_cidade||null, id_time: idTime||null };
        if (row.id_campo) await api.patch(`campo?id_campo=eq.${row.id_campo}`, body);
        else await api.post("campo", body);
      }
      show(`${resultadoImport._dados.length} registro(s) importado(s)!`); setResultadoImport(null); reload();
    } catch(e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  function abrirNovo() { setForm({ nome:"", endereco:"", id_cidade:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(c) { setForm({ ...c, id_cidade: c.id_cidade?String(c.id_cidade):"" }); setModal(c); if (c.id_cidade) { api.get(`cidade?id_cidade=eq.${c.id_cidade}&select=estado&limit=1`).then(d => { if (d?.[0]?.estado) setUfCampo(d[0].estado); }).catch(()=>{}); } }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, endereco: form.endereco||null, id_cidade: form.id_cidade?Number(form.id_cidade):null, observacoes: form.observacoes||null, id_time: idTime||null };
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
            (campos||[]).map(c => ({...c, cidade: c.cidade ? `${c.cidade.nome}` : "", uf: c.cidade ? c.cidade.estado : ""})),
            [
              { key:"id_campo",  label:"id",       width:8,  descricao:"NÃO altere. Vazio = novo registro." },
              { key:"nome",      label:"nome",     width:30, descricao:"Nome do campo. OBRIGATÓRIO." },
              { key:"endereco",  label:"endereco", width:40, descricao:"Endereço do campo." },
              { key:"uf",        label:"uf",       width:8,  descricao:"Sigla do estado (ex: RS). Ajuda a localizar a cidade certa." },
              { key:"cidade",    label:"cidade",   width:25, descricao:"Nome da cidade. Consulte a aba 'Cidades' para os nomes válidos." },
            ],
            "campos",
            ["- id preenchido = atualiza", "- id vazio = cria novo", "- Consulte a aba 'Cidades' para ver os nomes válidos", "- Preencha UF + cidade para evitar ambiguidade (ex: duas cidades com o mesmo nome em estados diferentes)"],
            { nome:"Cidades", colunas:["uf","cidade"], larguras:[8,30],
              dados:(cidadesBR||[]).map(c => [c.estado, c.nome]) }
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
                const ufRow = String(row["uf"]||"").trim().toUpperCase();
                if (cidadeNome) {
                  // Valida contra a base NACIONAL (não só o UF do dropdown da tela).
                  let candidatos = (cidadesBR||[]).filter(c => c.nome.toUpperCase() === cidadeNome.toUpperCase());
                  if (ufRow) candidatos = candidatos.filter(c => (c.estado||"").toUpperCase() === ufRow);
                  if (candidatos.length === 0) {
                    erros.push({ linha, mensagem: `Cidade '${cidadeNome}'${ufRow?` (${ufRow})`:""} não encontrada na base. Confira a aba 'Cidades'.` });
                  } else if (candidatos.length > 1) {
                    erros.push({ linha, mensagem: `Cidade '${cidadeNome}' existe em mais de um estado. Preencha a coluna 'uf' para indicar qual.` });
                  }
                }
                if (!erros.find(e => e.linha === linha)) validos.push(row);
              });
              setResultadoImport({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r.id_campo).length} atualizações + ${validos.filter(r=>!r.id_campo).length} novos.`, _dados: validos });
            } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
          }}
          loadingImport={loadingImport==="campos"}
        />
        {!readOnly && <Btn onClick={abrirNovo}>+ Novo Campo</Btn>}
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
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
                <td style={{ padding:"11px 14px" }}>{!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(c)}>Editar</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      {modal && (
        <Modal title={modal === "novo" ? "Novo Campo" : "Editar Campo"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
            <Input label="Endereço" value={form.endereco||""} onChange={e => set("endereco", e.target.value)} />
            <Select label="Estado (UF)" value={ufCampo} onChange={e => { setUfCampo(e.target.value); set("id_cidade", ""); }}>
              {UFS_BR.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Select label="Cidade" value={form.id_cidade||""} onChange={e => set("id_cidade", e.target.value)}>
              <option value="">{cidades === null ? "Carregando..." : "Selecione..."}</option>
              {(cidades||[]).map(c => <option key={c.id_cidade} value={c.id_cidade}>{c.nome}</option>)}
            </Select>
            <Input label="Observações" value={form.observacoes||""} onChange={e => set("observacoes", e.target.value)} />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD TIMES INTERNOS (turma fechada) ──────────────────────
// Times internos pertencem ao TIME (histórico plurianual). Só os
// sem data_fim aparecem ao montar um jogo do encontro. Tela isolada,
// usada apenas quando o time é do tipo turma fechada.
function CrudTimesInternos({ idTime, show, readOnly }) {
  const { data: times, loading, reload } = useQuery(() => idTime ? api.get(`time_interno?id_time=eq.${idTime}&select=*&order=data_fim.asc.nullsfirst,nome.asc`) : Promise.resolve([]), [idTime]);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function confirmarImport() {
    const dados = resultadoImport?._dados || [];
    setSaving(true);
    try {
      for (const row of dados) {
        const body = {
          nome: String(row["nome"]||"").trim(),
          cor: String(row["cor"]||"").trim() || null,
          data_inicio: row["data_inicio"] || null,
          data_fim: row["data_fim"] || null,
          observacao: String(row["observacao"]||"").trim() || null,
          id_time: idTime,
        };
        if (row["id"]) await api.patch(`time_interno?id_time_interno=eq.${row["id"]}`, body);
        else await api.post("time_interno", body);
      }
      show("Importação concluída!"); setResultadoImport(null); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }


  function abrirNovo() { setForm({ nome:"", cor:"#E8A020", data_inicio:"", data_fim:"", observacao:"" }); setModal("novo"); }
  function abrirEditar(t) {
    setForm({
      ...t,
      data_inicio: t.data_inicio ? String(t.data_inicio).split("T")[0] : "",
      data_fim:    t.data_fim ? String(t.data_fim).split("T")[0] : "",
      cor: t.cor || "#E8A020",
      observacao: t.observacao || "",
    });
    setModal(t);
  }

  async function salvar() {
    if (!form.nome || !form.nome.trim()) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = {
        nome: form.nome.trim(),
        cor: form.cor || null,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        observacao: form.observacao || null,
        id_time: idTime || null,
      };
      if (modal === "novo") await api.post("time_interno", body);
      else await api.patch(`time_interno?id_time_interno=eq.${form.id_time_interno}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:12, color:C.dim }}>Times internos da turma. Só os ativos (sem data de encerramento) aparecem ao montar um jogo.</div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <BotoesImportExport
            onExportar={() => exportarExcel(
              (times||[]),
              [
                { key:"id_time_interno", label:"id",          width:8,  descricao:"NÃO altere. Vazio = novo." },
                { key:"nome",            label:"nome",        width:25, descricao:"Nome do time interno. OBRIGATÓRIO." },
                { key:"cor",             label:"cor",         width:12, descricao:"Cor em hex, ex: #E8A020." },
                { key:"data_inicio",     label:"data_inicio", width:14, descricao:"Data de início (AAAA-MM-DD)." },
                { key:"data_fim",        label:"data_fim",    width:14, descricao:"Data de encerramento (vazio = ativo)." },
                { key:"observacao",      label:"observacao",  width:30, descricao:"Observações." },
              ],
              "times_internos",
              ["- id preenchido = atualiza", "- id vazio = cria novo", "- nome é obrigatório"]
            )}
            onImportar={async (file) => {
              setLoadingImport("ti");
              try {
                const rows = await lerExcel(file);
                const erros = []; const validos = [];
                rows.forEach((row, i) => {
                  const linha = i + 2;
                  if (!String(row["nome"]||"").trim()) { erros.push({ linha, mensagem: "Campo 'nome' é obrigatório." }); return; }
                  validos.push(row);
                });
                setResultadoImport({ erros, validos: validos.length, mensagem: `${validos.filter(r=>r["id"]).length} atualizações + ${validos.filter(r=>!r["id"]).length} novos.`, _dados: validos });
              } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
            }}
            loadingImport={loadingImport==="ti"}
          />
          {!readOnly && <Btn onClick={abrirNovo}>+ Novo Time Interno</Btn>}
        </div>
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Time","Início","Encerrado em","Situação",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(times||[]).map((t,i) => (
              <tr key={t.id_time_interno} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700 }}>
                  <span style={{ display:"inline-block", width:13, height:13, borderRadius:"50%", background:t.cor||C.dim, marginRight:8, verticalAlign:"middle", border:`1px solid ${C.border}` }} />
                  {t.nome}
                </td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{t.data_inicio ? new Date(t.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{t.data_fim ? new Date(t.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", fontSize:12 }}>{t.data_fim ? <span style={{ color:C.dim }}>Encerrado</span> : <span style={{ color:C.win, fontWeight:700 }}>Ativo</span>}</td>
                <td style={{ padding:"11px 14px" }}>{!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(t)}>Editar</Btn>}</td>
              </tr>
            ))}
            {(times||[]).length === 0 && (
              <tr><td colSpan={5} style={{ padding:"20px 14px", textAlign:"center", color:C.dim, fontSize:13 }}>Nenhum time interno cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table></div>
      </Card>
      {modal && (
        <Modal title={modal === "novo" ? "Novo Time Interno" : "Editar Time Interno"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} placeholder="Ex: Laranja" />
            <div>
              <label style={{ display:"block", fontSize:12, color:C.dim, marginBottom:6 }}>Cor</label>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <input type="color" value={form.cor||"#E8A020"} onChange={e => set("cor", e.target.value)} style={{ width:48, height:38, border:`1px solid ${C.border}`, borderRadius:8, background:C.surf2, cursor:"pointer" }} />
                <Input value={form.cor||""} onChange={e => set("cor", e.target.value)} placeholder="#E8A020" style={{ flex:1 }} />
              </div>
            </div>
            <Input label="Data de início" type="date" value={form.data_inicio||""} onChange={e => set("data_inicio", e.target.value)} />
            <Input label="Encerrado em (deixe vazio se ativo)" type="date" value={form.data_fim||""} onChange={e => set("data_fim", e.target.value)} />
            <Input label="Observação" value={form.observacao||""} onChange={e => set("observacao", e.target.value)} />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── ENCONTROS (turma fechada) ────────────────────────────────
// Lista de encontros (como a lista de partidas) → abre a ficha do dia.
// A ficha tem: jogos do rodízio (placar entre times internos) +
// estatísticas agregadas por jogador no dia + validações.
function ListaEncontros({ idTime, temporada, show, readOnly }) {
  const [encontroSel, setEncontroSel] = useState(null);
  const [novo, setNovo] = useState(false);
  const { data: encontros, loading, reload } = useQuery(
    () => temporada?.id_temporada
      ? api.get(`encontro?id_temporada=eq.${temporada.id_temporada}&select=*,campo:id_campo(nome)&order=data.desc`)
      : Promise.resolve([]),
    [temporada]
  );
  const { data: lavagens } = useQuery(    () => temporada?.id_temporada
      ? api.get(`vw_turma_lavagens?id_temporada=eq.${temporada.id_temporada}&select=*&order=lavagens.desc`)
      : Promise.resolve([]),
    [temporada]
  );
  const { data: jogadoresLista } = useQuery(
    () => idTime ? api.get(`jogador?id_time=eq.${idTime}&id_jogador=gt.0&select=id_jogador,nome,apelido`) : Promise.resolve([]),
    [idTime]
  );
  const nomeResponsavel = (id) => {
    if (!id) return null;
    const j = (jogadoresLista||[]).find(x => x.id_jogador === id);
    return j ? (j.apelido || j.nome) : null;
  };

  if (!temporada) return <Card><div style={{ padding:20, color:C.dim }}>Crie uma temporada primeiro para registrar encontros.</div></Card>;
  if (encontroSel || novo) {
    return <FichaEncontro idTime={idTime} temporada={temporada} encontro={encontroSel} show={show} readOnly={readOnly}
             onVoltar={() => { setEncontroSel(null); setNovo(false); reload(); }} />;
  }
  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:12, color:C.dim }}>Encontros da temporada {temporada.nome || ""}. Clique para abrir o dia.</div>
        {!readOnly && <Btn onClick={() => setNovo(true)}>+ Novo Encontro</Btn>}
      </div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Data","Local","Jogos","🧺 Lavagem","Situação",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(encontros||[]).map((e,i) => (
              <tr key={e.id_encontro} style={{ background: i%2===0?C.surface:C.bg, cursor:"pointer" }} onClick={() => setEncontroSel(e)}>
                <td style={{ padding:"11px 14px", fontWeight:700, whiteSpace:"nowrap" }}>{fmtData(e.data)} {fmtHora(e.data)}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{e.campo?.nome || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{e._njogos != null ? e._njogos : ""}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{nomeResponsavel(e.id_responsavel_lavagem) || "—"}</td>
                <td style={{ padding:"11px 14px", fontSize:12 }}>
                  {e.status === "pendente_conferencia"
                    ? <span style={{ background:C.gold+"22", color:C.gold, fontWeight:700, padding:"2px 8px", borderRadius:5, fontSize:11 }}>Pendente conferência</span>
                    : <span style={{ color:C.win }}>OK</span>}
                </td>
                <td style={{ padding:"11px 14px" }}><Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={(ev) => { ev.stopPropagation(); setEncontroSel(e); }}>Abrir</Btn></td>
              </tr>
            ))}
            {(encontros||[]).length === 0 && (
              <tr><td colSpan={5} style={{ padding:"20px 14px", textAlign:"center", color:C.dim, fontSize:13 }}>Nenhum encontro registrado nesta temporada.</td></tr>
            )}
          </tbody>
        </table></div>
      </Card>

      {(lavagens||[]).length > 0 && (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, fontSize:13, fontWeight:800, color:C.gold, textTransform:"uppercase", letterSpacing:"0.06em" }}>🧺 Ranking de lavagens do fardamento</div>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr style={{ background:C.surf2 }}>
              {["#","Jogador","Lavagens"].map((h,i) => <th key={i} style={{ padding:"8px 12px", textAlign:i===0?"center":"left", fontSize:10, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(lavagens||[]).map((j,i) => (
                <tr key={j.id_jogador} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"8px 12px", textAlign:"center", fontWeight:800, color:C.gold }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1)}</td>
                  <td style={{ padding:"8px 12px", fontWeight:700 }}>{j.apelido || j.nome}</td>
                  <td style={{ padding:"8px 12px" }}>{j.lavagens}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}
    </div>
  );
}

// Gera/exibe o link público de confirmação de presença (encontro/evento/partida).
// Reutilizável: recebe tipo, idRef, idTime e a data (para definir expiração).
function LinkConfirmacao({ tipo, idRef, idTime, dataRef, show }) {
  const { data: links, reload } = useQuery(
    () => (tipo && idRef) ? api.get(`link_confirmacao?tipo=eq.${tipo}&id_ref=eq.${idRef}&select=*&limit=1`) : Promise.resolve([]),
    [tipo, idRef]
  );
  const [gerando, setGerando] = useState(false);
  const link = links?.[0];
  const urlBase = (typeof window !== "undefined") ? `${window.location.origin}/confirmar?t=` : "/confirmar?t=";

  async function gerar() {
    setGerando(true);
    try {
      const token = (crypto?.randomUUID ? crypto.randomUUID().replace(/-/g,"") : (Math.random().toString(36).slice(2)+Date.now().toString(36)+Math.random().toString(36).slice(2)));
      const expira = dataRef ? new Date(new Date(dataRef).getTime() + 24*60*60*1000).toISOString() : null; // expira 1 dia após a data
      await api.post("link_confirmacao", { token, tipo, id_ref: idRef, id_time: idTime, expira_em: expira });
      show("Link de confirmação gerado!"); reload();
    } catch (e) { show(e.message, "error"); } finally { setGerando(false); }
  }
  function copiar() {
    const url = urlBase + link.token;
    if (navigator?.clipboard) navigator.clipboard.writeText(url).then(() => show("Link copiado!")).catch(() => {});
  }

  return (
    <Card style={{ background:C.surf2 }}>
      <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>📲 Link de confirmação de presença</div>
      {!link ? (
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <div style={{ fontSize:13, color:C.dim, flex:1, minWidth:180 }}>Gere um link para os jogadores confirmarem presença sem precisar de login. Compartilhe no WhatsApp.</div>
          <Btn onClick={gerar} disabled={gerando}>{gerando ? "Gerando..." : "Gerar link"}</Btn>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <input readOnly value={urlBase + link.token} onFocus={e => e.target.select()}
              style={{ flex:1, minWidth:200, background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, color:C.cream, fontSize:12, padding:"8px 10px", fontFamily:"monospace" }} />
            <Btn onClick={copiar}>Copiar</Btn>
          </div>
          <div style={{ fontSize:11, color:C.dim }}>
            {link.expira_em ? `Expira em ${new Date(link.expira_em).toLocaleDateString("pt-BR")} ${new Date(link.expira_em).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}.` : "Sem data de expiração."} Qualquer pessoa com o link pode responder pelos nomes da lista.
          </div>
        </div>
      )}
    </Card>
  );
}

function FichaEncontro({ idTime, temporada, encontro, show, readOnly, onVoltar }) {
  const ehNovo = !encontro;
  const [idEncontro, setIdEncontro] = useState(encontro?.id_encontro || null);
  const [cabecalho, setCabecalho] = useState({
    data: dataDeTS(encontro?.data),
    hora: horaDeTS(encontro?.data),
    id_campo: encontro?.id_campo ? String(encontro.id_campo) : "",
    observacao: encontro?.observacao || "",
    id_responsavel_lavagem: encontro?.id_responsavel_lavagem ? String(encontro.id_responsavel_lavagem) : "",
    link_local: encontro?.link_local || "",
  });
  const [savingCab, setSavingCab] = useState(false);

  // Times internos ativos (sem data_fim) + campos + jogadores ativos
  const { data: timesInternos } = useQuery(() => idTime ? api.get(`time_interno?id_time=eq.${idTime}&data_fim=is.null&select=id_time_interno,nome,cor&order=nome.asc`) : Promise.resolve([]), [idTime]);
  const { data: _timeEnc } = useQuery(() => idTime ? api.get(`time?id_time=eq.${idTime}&select=id_time,nome,cidade:id_cidade_sede(nome,estado)&limit=1`) : Promise.resolve([]), [idTime]);
  const { data: campos } = useQuery(() => idTime ? api.get(`campo?id_time=eq.${idTime}&select=id_campo,nome&order=nome.asc`) : Promise.resolve([]), [idTime]);
  const { data: jogadores } = useQuery(() => idTime ? api.get(`jogador?id_jogador=gt.0&id_time=eq.${idTime}&select=id_jogador,nome,apelido,camisa&order=camisa.asc`) : Promise.resolve([]), [idTime]);

  // Jogos e participações do encontro (quando já existe)
  const { data: jogos, reload: reloadJogos } = useQuery(() => idEncontro ? api.get(`encontro_jogo?id_encontro=eq.${idEncontro}&select=*&order=ordem.asc.nullslast,id_encontro_jogo.asc`) : Promise.resolve([]), [idEncontro]);
  const { data: parts, reload: reloadParts } = useQuery(() => idEncontro ? api.get(`encontro_participacao?id_encontro=eq.${idEncontro}&select=*,jogador(nome,apelido,camisa)&order=id_encontro_part.asc`) : Promise.resolve([]), [idEncontro]);

  const mapaTI = {}; (timesInternos||[]).forEach(t => { mapaTI[t.id_time_interno] = t; });

  // ── Salvar cabeçalho (cria o encontro) ──
  async function salvarCabecalho() {
    if (!cabecalho.data) { show("Informe a data do encontro.", "error"); return; }
    if (!linkLocalValido(cabecalho.link_local)) { show(`Link inválido. Recebido: "${String(cabecalho.link_local).slice(0,60)}". Cole um link do mapa.`, "error"); return; }
    setSavingCab(true);
    try {
      const _dataHora = montarDataHoraUTC(cabecalho.data, cabecalho.hora || "12:00");
      const body = { id_temporada: temporada.id_temporada, data: _dataHora, id_campo: cabecalho.id_campo ? Number(cabecalho.id_campo) : null, observacao: cabecalho.observacao || null, id_responsavel_lavagem: cabecalho.id_responsavel_lavagem ? Number(cabecalho.id_responsavel_lavagem) : null, link_local: normalizarLink(cabecalho.link_local) };
      if (idEncontro) { await api.patch(`encontro?id_encontro=eq.${idEncontro}`, body); show("Encontro atualizado."); }
      else {
        const r = await api.post("encontro", body);
        const novoId = Array.isArray(r) ? r[0]?.id_encontro : r?.id_encontro;
        setIdEncontro(novoId); show("Encontro criado. Agora adicione os jogos e a presença.");
      }
    } catch (e) { show(e.message, "error"); } finally { setSavingCab(false); }
  }

  // ── Totais e validações ──
  const totalPlacares = (jogos||[]).reduce((s,j) => s + (j.placar_a||0) + (j.placar_b||0), 0);
  const totalGolsJog  = (parts||[]).reduce((s,p) => s + (p.gols||0), 0);
  const totalAssist   = (parts||[]).reduce((s,p) => s + (p.assistencias||0), 0);
  const totalGolsContra = (parts||[]).reduce((s,p) => s + (p.gols_contra||0), 0);
  const somaConfere = totalPlacares === (totalGolsJog + totalGolsContra);
  const assistExcede = totalAssist > totalGolsJog;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <Btn variant="secondary" onClick={onVoltar} style={{ alignSelf:"flex-start" }}>← Voltar</Btn>

      {/* Cabeçalho do encontro */}
      <Card>
        <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:14 }}>Dados do encontro</div>
        <div className="campos-encontro">
          <Input label="Data *" type="date" value={cabecalho.data} onChange={e => setCabecalho(c => ({ ...c, data: e.target.value }))} />
          <Input label="Hora" type="time" value={cabecalho.hora} onChange={e => setCabecalho(c => ({ ...c, hora: e.target.value }))} />
          <Select label="Local" value={cabecalho.id_campo} onChange={e => setCabecalho(c => ({ ...c, id_campo: e.target.value }))}>
            <option value="">—</option>
            {(campos||[]).map(c => <option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
          </Select>
          <Input label="Observação" value={cabecalho.observacao} onChange={e => setCabecalho(c => ({ ...c, observacao: e.target.value }))} />
          <Input label="Link de localização (opcional)" placeholder="https://maps.google.com/..." value={cabecalho.link_local} onChange={e => setCabecalho(c => ({ ...c, link_local: e.target.value }))} />
          <Select label="🧺 Responsável pela lavagem" value={cabecalho.id_responsavel_lavagem} onChange={e => setCabecalho(c => ({ ...c, id_responsavel_lavagem: e.target.value }))}>
            <option value="">—</option>
            {(jogadores||[]).map(j => <option key={j.id_jogador} value={j.id_jogador}>{j.apelido || j.nome}</option>)}
          </Select>
        </div>
        {!readOnly && <div style={{ marginTop:12 }}><Btn onClick={salvarCabecalho} disabled={savingCab}>{savingCab ? "Salvando..." : idEncontro ? "Atualizar dados" : "Criar encontro"}</Btn></div>}
      </Card>

      {!idEncontro && <Card><div style={{ padding:16, color:C.dim, fontSize:13 }}>Salve os dados do encontro para liberar o cadastro de jogos e presença.</div></Card>}

      {idEncontro && (
        <>
          {!readOnly && <LinkConfirmacao tipo="encontro" idRef={idEncontro} idTime={idTime} dataRef={cabecalho.data ? `${cabecalho.data}T${cabecalho.hora || "12:00"}` : null} show={show} />}
          {!readOnly && idEncontro && (
            <div style={{ marginTop:14, display:"flex", justifyContent:"flex-end" }}>
              <CompartilharPresenca tipo="encontro" idRef={idEncontro} idTime={idTime} titulo="" data={cabecalho.data ? `${cabecalho.data}T${cabecalho.hora || "12:00"}` : null} linkLocal={cabecalho.link_local} time={_timeEnc?.[0]} show={show} />
            </div>
          )}
          <JogosEncontro idEncontro={idEncontro} jogos={jogos||[]} timesInternos={timesInternos||[]} mapaTI={mapaTI} reload={reloadJogos} show={show} readOnly={readOnly} totalPlacares={totalPlacares} />
          <PresencaEncontro idEncontro={idEncontro} parts={parts||[]} jogadores={jogadores||[]} timesInternos={timesInternos||[]} mapaTI={mapaTI} reload={reloadParts} show={show} readOnly={readOnly}
            totais={{ totalPlacares, totalGolsJog, totalAssist, totalGolsContra, somaConfere, assistExcede }} statusAtual={encontro?.status} />
        </>
      )}
    </div>
  );
}

// Jogos do rodízio (placar entre times internos)
function JogosEncontro({ idEncontro, jogos, timesInternos, mapaTI, reload, show, readOnly, totalPlacares }) {
  const [form, setForm] = useState({ a:"", b:"", pa:"0", pb:"0" });
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);

  function exportarJogosFn() {
    const dados = (jogos||[]).map(j => ({
      id_encontro_jogo: j.id_encontro_jogo,
      time_a: mapaTI[j.id_time_interno_a]?.nome || "", placar_a: j.placar_a||0,
      placar_b: j.placar_b||0, time_b: mapaTI[j.id_time_interno_b]?.nome || "",
      ordem: j.ordem||"", observacao: j.observacao||"",
    }));
    exportarExcel(dados, [
      { key:"id_encontro_jogo", label:"id",       width:8,  descricao:"NÃO altere. Vazio = novo jogo." },
      { key:"time_a",   label:"time_a",   width:16, descricao:"Nome exato do time interno A." },
      { key:"placar_a", label:"placar_a", width:10, descricao:"Gols do time A." },
      { key:"placar_b", label:"placar_b", width:10, descricao:"Gols do time B." },
      { key:"time_b",   label:"time_b",   width:16, descricao:"Nome exato do time interno B." },
      { key:"ordem",    label:"ordem",    width:8,  descricao:"Ordem do jogo no dia (opcional)." },
      { key:"observacao", label:"observacao", width:30, descricao:"Observações." },
    ], "jogos_encontro",
    ["- time_a e time_b devem ser nomes exatos de times internos ativos.",
     "- id preenchido atualiza; vazio cria novo jogo.", "- placares são números."]);
  }

  async function confirmarImport() {
    const dados = resultadoImport?._dados || [];
    setSaving(true);
    try {
      for (const row of dados) {
        const na = String(row["time_a"]||"").trim().toUpperCase();
        const nb = String(row["time_b"]||"").trim().toUpperCase();
        const ta = (timesInternos||[]).find(t => t.nome.toUpperCase() === na);
        const tb = (timesInternos||[]).find(t => t.nome.toUpperCase() === nb);
        if (!ta || !tb) continue;
        const body = {
          id_encontro: idEncontro, id_time_interno_a: ta.id_time_interno, id_time_interno_b: tb.id_time_interno,
          placar_a: Number(row["placar_a"])||0, placar_b: Number(row["placar_b"])||0,
          ordem: row["ordem"] ? Number(row["ordem"]) : null, observacao: String(row["observacao"]||"").trim()||null,
        };
        if (row["id"]) await api.patch(`encontro_jogo?id_encontro_jogo=eq.${row["id"]}`, body);
        else await api.post("encontro_jogo", body);
      }
      show("Jogos importados!"); setResultadoImport(null); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }

  async function addJogo() {
    if (!form.a || !form.b) { show("Selecione os dois times internos.", "error"); return; }
    if (form.a === form.b) { show("Os dois times devem ser diferentes.", "error"); return; }
    setSaving(true);
    try {
      await api.post("encontro_jogo", { id_encontro: idEncontro, id_time_interno_a: Number(form.a), id_time_interno_b: Number(form.b), placar_a: Number(form.pa)||0, placar_b: Number(form.pb)||0, ordem: (jogos.length+1) });
      setForm({ a:"", b:"", pa:"0", pb:"0" }); show("Jogo adicionado."); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }
  async function removerJogo(id) {
    if (!confirm("Remover este jogo?")) return;
    try { await api.delete(`encontro_jogo?id_encontro_jogo=eq.${id}`); show("Jogo removido."); reload(); }
    catch (e) { show(e.message, "error"); }
  }

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:14 }}>
        <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Jogos do dia (rodízio)</div>
        {!readOnly && (
          <BotoesImportExport
            onExportar={exportarJogosFn}
            onImportar={async (file) => {
              setLoadingImport("jogos");
              try {
                const rows = await lerExcel(file);
                const erros = []; let validos = 0;
                const tiNomes = new Set((timesInternos||[]).map(t => t.nome.toUpperCase()));
                rows.forEach((row, i) => {
                  const linha = i + 2;
                  const na = String(row["time_a"]||"").trim().toUpperCase();
                  const nb = String(row["time_b"]||"").trim().toUpperCase();
                  if (!na || !nb) { erros.push({ linha, mensagem: "time_a e time_b são obrigatórios." }); return; }
                  if (!tiNomes.has(na)) { erros.push({ linha, mensagem: `Time '${row["time_a"]}' não encontrado.` }); return; }
                  if (!tiNomes.has(nb)) { erros.push({ linha, mensagem: `Time '${row["time_b"]}' não encontrado.` }); return; }
                  if (na === nb) { erros.push({ linha, mensagem: "Os dois times devem ser diferentes." }); return; }
                  validos++;
                });
                setResultadoImport({ erros, validos, mensagem: `${validos} jogo(s) a importar.`, _dados: rows });
              } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
            }}
            loadingImport={loadingImport==="jogos"}
          />
        )}
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      {jogos.map(j => (
        <div key={j.id_encontro_jogo} style={{ display:"flex", alignItems:"center", gap:8, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", marginBottom:6 }}>
          <span style={{ display:"inline-block", width:12, height:12, borderRadius:"50%", background:mapaTI[j.id_time_interno_a]?.cor||C.dim }} />
          <span style={{ fontSize:13 }}>{mapaTI[j.id_time_interno_a]?.nome || "?"}</span>
          <span style={{ fontWeight:800, color:C.gold, fontSize:15 }}>{j.placar_a}</span>
          <span style={{ color:C.dim, fontSize:11 }}>x</span>
          <span style={{ fontWeight:800, color:C.gold, fontSize:15 }}>{j.placar_b}</span>
          <span style={{ fontSize:13 }}>{mapaTI[j.id_time_interno_b]?.nome || "?"}</span>
          <span style={{ display:"inline-block", width:12, height:12, borderRadius:"50%", background:mapaTI[j.id_time_interno_b]?.cor||C.dim }} />
          {!readOnly && <Btn variant="secondary" style={{ marginLeft:"auto", fontSize:11, padding:"4px 8px" }} onClick={() => removerJogo(j.id_encontro_jogo)}>✕</Btn>}
        </div>
      ))}
      {jogos.length === 0 && <div style={{ color:C.dim, fontSize:13, marginBottom:8 }}>Nenhum jogo ainda.</div>}
      {!readOnly && (
        <div style={{ display:"flex", gap:8, alignItems:"flex-end", marginTop:8, flexWrap:"wrap" }}>
          <Select label="Time A" value={form.a} onChange={e => setForm(f => ({ ...f, a:e.target.value }))} style={{ minWidth:120 }}>
            <option value="">—</option>{timesInternos.map(t => <option key={t.id_time_interno} value={t.id_time_interno}>{t.nome}</option>)}
          </Select>
          <Input label="Placar" type="number" min="0" value={form.pa} onChange={e => setForm(f => ({ ...f, pa:e.target.value }))} style={{ width:70 }} />
          <Input label="Placar" type="number" min="0" value={form.pb} onChange={e => setForm(f => ({ ...f, pb:e.target.value }))} style={{ width:70 }} />
          <Select label="Time B" value={form.b} onChange={e => setForm(f => ({ ...f, b:e.target.value }))} style={{ minWidth:120 }}>
            <option value="">—</option>{timesInternos.map(t => <option key={t.id_time_interno} value={t.id_time_interno}>{t.nome}</option>)}
          </Select>
          <Btn onClick={addJogo} disabled={saving}>+ Jogo</Btn>
        </div>
      )}
      <div style={{ fontSize:12, color:C.dim, marginTop:10 }}>Total de gols nos placares do dia: <b style={{ color:C.gold }}>{totalPlacares}</b></div>
    </Card>
  );
}

// Presença + estatísticas agregadas do jogador no dia
function PresencaEncontro({ idEncontro, parts, jogadores, timesInternos, mapaTI, reload, show, readOnly, totais, statusAtual }) {
  const [addJog, setAddJog] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);
  const jaPresentes = new Set((parts||[]).map(p => p.id_jogador));
  const disponiveis = (jogadores||[]).filter(j => !jaPresentes.has(j.id_jogador));

  // Exporta as estatísticas do dia (com nome do jogador e do time interno resolvidos)
  function exportarStats() {
    const dados = (parts||[]).map(p => ({
      id_jogador: p.id_jogador,
      jogador: p.jogador?.apelido || p.jogador?.nome || "",
      camisa: p.jogador?.camisa || "",
      time_interno: mapaTI[p.id_time_interno]?.nome || "",
      gols: p.gols||0, assistencias: p.assistencias||0, gols_contra: p.gols_contra||0,
      amarelos: p.cartao_amarelo||0, vermelhos: p.cartao_vermelho||0, observacao: p.observacao||"",
    }));
    exportarExcel(dados, [
      { key:"id_jogador",   label:"id_jogador",   width:10, descricao:"NÃO altere. Identifica o jogador." },
      { key:"jogador",      label:"jogador",      width:22, descricao:"Nome (referência; não altere)." },
      { key:"camisa",       label:"camisa",       width:8,  descricao:"Camisa (referência)." },
      { key:"time_interno", label:"time_interno", width:16, descricao:"Nome EXATO do time interno do jogador no dia." },
      { key:"gols",         label:"gols",         width:8,  descricao:"Gols no dia." },
      { key:"assistencias", label:"assistencias", width:12, descricao:"Assistências no dia." },
      { key:"gols_contra",  label:"gols_contra",  width:12, descricao:"Gols contra no dia." },
      { key:"amarelos",     label:"amarelos",     width:10, descricao:"Cartões amarelos." },
      { key:"vermelhos",    label:"vermelhos",    width:10, descricao:"Cartões vermelhos." },
      { key:"observacao",   label:"observacao",   width:30, descricao:"Observações." },
    ], "estatisticas_encontro",
    ["- Exporte com os presentes já adicionados, preencha os números e reimporte.",
     "- 'time_interno' deve ser o nome exato de um time interno ativo.",
     "- Linhas com id_jogador em branco são ignoradas."]);
  }

  async function confirmarImport() {
    const dados = resultadoImport?._dados || [];
    setSaving(true);
    try {
      for (const row of dados) {
        const idJog = Number(row["id_jogador"]); if (!idJog) continue;
        const tiNome = String(row["time_interno"]||"").trim().toUpperCase();
        const ti = (timesInternos||[]).find(t => t.nome.toUpperCase() === tiNome);
        const existente = (parts||[]).find(p => p.id_jogador === idJog);
        const body = {
          id_encontro: idEncontro, id_jogador: idJog,
          id_time_interno: ti ? ti.id_time_interno : (existente?.id_time_interno || null),
          gols: Number(row["gols"])||0, assistencias: Number(row["assistencias"])||0,
          gols_contra: Number(row["gols_contra"])||0, cartao_amarelo: Number(row["amarelos"])||0,
          cartao_vermelho: Number(row["vermelhos"])||0, observacao: String(row["observacao"]||"").trim()||null,
        };
        if (existente) await api.patch(`encontro_participacao?id_encontro_part=eq.${existente.id_encontro_part}`, body);
        else await api.post("encontro_participacao", body);
      }
      show("Estatísticas importadas!"); setResultadoImport(null); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }


  async function adicionarPresenca() {
    if (!addJog) return;
    setSaving(true);
    try {
      await api.post("encontro_participacao", { id_encontro: idEncontro, id_jogador: Number(addJog), id_time_interno: null, gols:0, assistencias:0, gols_contra:0, cartao_amarelo:0, cartao_vermelho:0 });
      setAddJog(""); show("Presença registrada."); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }
  // Traz os confirmados "Vou" (jogadores cadastrados) como presença. Convidados são ignorados.
  async function trazerConfirmados() {
    setSaving(true);
    try {
      const links = await api.get(`link_confirmacao?tipo=eq.encontro&id_ref=eq.${idEncontro}&select=id_link&limit=1`);
      if (!links?.[0]) { show("Nenhum link de confirmação foi gerado para este encontro.", "error"); setSaving(false); return; }
      const confs = await api.get(`confirmacao_presenca?id_link=eq.${links[0].id_link}&status=eq.vou&id_jogador=not.is.null&select=id_jogador`);
      const jaPresentesSet = new Set((parts||[]).map(p => p.id_jogador));
      const aAdicionar = (confs||[]).filter(c => !jaPresentesSet.has(c.id_jogador));
      const convidados = await api.get(`confirmacao_presenca?id_link=eq.${links[0].id_link}&status=eq.vou&id_jogador=is.null&select=id_confirmacao`);
      if (aAdicionar.length === 0) {
        show((convidados||[]).length > 0 ? `Todos os jogadores confirmados já estão na lista. ${convidados.length} convidado(s) foram ignorados.` : "Nenhum jogador novo confirmado para trazer.");
        setSaving(false); return;
      }
      for (const c of aAdicionar) {
        await api.post("encontro_participacao", { id_encontro: idEncontro, id_jogador: c.id_jogador, id_time_interno: null, gols:0, assistencias:0, gols_contra:0, cartao_amarelo:0, cartao_vermelho:0 });
      }
      const aviso = (convidados||[]).length > 0 ? ` (${convidados.length} convidado(s) ignorado(s) — cadastre-os como jogador se quiser incluí-los)` : "";
      show(`${aAdicionar.length} jogador(es) confirmado(s) adicionado(s)!${aviso}`); reload();
    } catch (e) { show(e.message, "error"); } finally { setSaving(false); }
  }
  async function atualizarCampo(p, campo, valor) {
    try { await api.patch(`encontro_participacao?id_encontro_part=eq.${p.id_encontro_part}`, { [campo]: campo==="id_time_interno" ? (valor?Number(valor):null) : (Number(valor)||0) }); reload(); }
    catch (e) { show(e.message, "error"); }
  }
  async function removerPresenca(id) {
    if (!confirm("Remover este jogador do encontro?")) return;
    try { await api.delete(`encontro_participacao?id_encontro_part=eq.${id}`); show("Removido."); reload(); }
    catch (e) { show(e.message, "error"); }
  }

  // Salvar status (conferência): aplica regra de bloqueio e marca pendência
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  async function salvarConferencia() {
    if (totais.assistExcede) { show("Assistências do dia não podem passar os gols do dia. Ajuste antes de salvar.", "error"); return; }
    setSalvandoStatus(true);
    try {
      const novoStatus = totais.somaConfere ? "ok" : "pendente_conferencia";
      await api.patch(`encontro?id_encontro=eq.${idEncontro}`, { status: novoStatus });
      show(totais.somaConfere ? "Encontro conferido e salvo (OK)." : "Salvo como pendente de conferência (a soma não fechou).");
    } catch (e) { show(e.message, "error"); } finally { setSalvandoStatus(false); }
  }

  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:14 }}>
        <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Presença e estatísticas do dia</div>
        {!readOnly && (
          <BotoesImportExport
            onExportar={exportarStats}
            onImportar={async (file) => {
              setLoadingImport("stats");
              try {
                const rows = await lerExcel(file);
                const erros = []; let validos = 0;
                const tiNomes = new Set((timesInternos||[]).map(t => t.nome.toUpperCase()));
                rows.forEach((row, i) => {
                  const linha = i + 2;
                  if (!Number(row["id_jogador"])) return; // ignora linha sem jogador
                  const ti = String(row["time_interno"]||"").trim().toUpperCase();
                  if (ti && !tiNomes.has(ti)) { erros.push({ linha, mensagem: `Time interno '${row["time_interno"]}' não encontrado.` }); return; }
                  validos++;
                });
                setResultadoImport({ erros, validos, mensagem: `${validos} jogador(es) com estatísticas a importar.`, _dados: rows.filter(r => Number(r["id_jogador"])) });
              } catch(e) { show(e.message, "error"); } finally { setLoadingImport(null); }
            }}
            loadingImport={loadingImport==="stats"}
          />
        )}
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImport} salvando={saving}/>
      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead><tr style={{ background:C.surf2 }}>
          {["Jogador","Time interno","Gols","Assist.","G.Contra","🟨","🟥",""].map(h => <th key={h} style={{ padding:"7px 8px", textAlign:"left", fontSize:10, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {(parts||[]).map(p => (
            <tr key={p.id_encontro_part} style={{ borderBottom:`1px solid ${C.border}` }}>
              <td style={{ padding:"6px 8px", fontWeight:700, whiteSpace:"nowrap" }}>{p.jogador?.apelido || p.jogador?.nome || "?"}</td>
              <td style={{ padding:"6px 8px" }}>
                <select disabled={readOnly} value={p.id_time_interno||""} onChange={e => atualizarCampo(p, "id_time_interno", e.target.value)} style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:5, color:C.cream, padding:"4px", fontSize:12 }}>
                  <option value="">—</option>{timesInternos.map(t => <option key={t.id_time_interno} value={t.id_time_interno}>{t.nome}</option>)}
                </select>
              </td>
              {["gols","assistencias","gols_contra","cartao_amarelo","cartao_vermelho"].map(campo => (
                <td key={campo} style={{ padding:"6px 8px" }}>
                  <input disabled={readOnly} type="number" min="0" defaultValue={p[campo]||0} onBlur={e => atualizarCampo(p, campo, e.target.value)} style={{ width:46, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:5, color:C.cream, padding:"4px", fontSize:12 }} />
                </td>
              ))}
              <td style={{ padding:"6px 8px" }}>{!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"3px 7px" }} onClick={() => removerPresenca(p.id_encontro_part)}>✕</Btn>}</td>
            </tr>
          ))}
          {(parts||[]).length === 0 && <tr><td colSpan={8} style={{ padding:"14px 8px", textAlign:"center", color:C.dim, fontSize:13 }}>Ninguém registrado ainda. Adicione os presentes abaixo.</td></tr>}
        </tbody>
      </table></div>

      {!readOnly && (
        <div className="presenca-acoes" style={{ display:"flex", gap:8, alignItems:"flex-end", marginTop:10, flexWrap:"wrap" }}>
          <Select label="Adicionar presente" value={addJog} onChange={e => setAddJog(e.target.value)} style={{ minWidth:200, flex:1 }}>
            <option value="">Selecione um jogador...</option>
            {disponiveis.map(j => <option key={j.id_jogador} value={j.id_jogador}>#{j.camisa} — {j.apelido || j.nome}</option>)}
          </Select>
          <Btn onClick={adicionarPresenca} disabled={saving || !addJog}>+ Presença</Btn>
          <Btn variant="secondary" onClick={trazerConfirmados} disabled={saving}>📲 Trazer confirmados</Btn>
        </div>
      )}
      <div style={{ fontSize:12, color:C.dim, marginTop:6 }}>Para marcar presença, basta adicionar o jogador (mesmo com tudo zero).</div>

      {/* Validações */}
      <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ fontSize:12, color:C.dim }}>
          Placares: <b style={{ color:C.gold }}>{totais.totalPlacares}</b> · Jogadores: <b style={{ color:C.gold }}>{totais.totalGolsJog}</b> gols + <b style={{ color:C.gold }}>{totais.totalGolsContra}</b> gol(s) contra = <b style={{ color:C.gold }}>{totais.totalGolsJog + totais.totalGolsContra}</b> · Assistências: <b style={{ color:C.gold }}>{totais.totalAssist}</b>
        </div>
        {totais.assistExcede && (
          <div style={{ background:C.loss+"18", border:`1px solid ${C.loss}`, borderRadius:7, padding:"10px 12px", fontSize:12, color:"#ff8a87" }}>
            🚫 Assistências ({totais.totalAssist}) não podem passar os gols dos jogadores ({totais.totalGolsJog}). Ajuste antes de salvar.
          </div>
        )}
        {!totais.somaConfere && !totais.assistExcede && (
          <div style={{ background:C.gold+"18", border:`1px solid ${C.gold}`, borderRadius:7, padding:"10px 12px", fontSize:12, color:C.gold }}>
            ⚠️ A soma dos placares ({totais.totalPlacares}) não fecha com gols + gols contra ({totais.totalGolsJog + totais.totalGolsContra}). Você pode salvar mesmo assim — o encontro ficará pendente de conferência.
          </div>
        )}
        {totais.somaConfere && !totais.assistExcede && (
          <div style={{ background:C.win+"18", border:`1px solid ${C.win}`, borderRadius:7, padding:"10px 12px", fontSize:12, color:C.win }}>✅ A conta fecha: placares = gols + gols contra.</div>
        )}
        {!readOnly && (
          <div><Btn onClick={salvarConferencia} disabled={salvandoStatus || totais.assistExcede}>{salvandoStatus ? "Salvando..." : "Salvar conferência"}</Btn></div>
        )}
      </div>
    </Card>
  );
}

// ── CRUD POSIÇÕES ─────────────────────────────────────────────
function CrudPosicoes({ idTime, show, readOnly }) {
  // Tela de CONSULTA: o admin apenas visualiza as posições do tipo do seu time.
  // A gestão de posições é feita pelo super admin (no cadastro do Tipo de Time).
  const { data: _timeInfoP } = useQuery(() => idTime ? api.get(`time?id_time=eq.${idTime}&select=id_tipo_time,id_subtipo&limit=1`) : Promise.resolve([]), [idTime]);
  const _tipoTimeP = _timeInfoP?.[0]?.id_subtipo || _timeInfoP?.[0]?.id_tipo_time;
  const { data: _tiposP } = useQuery(() => api.get(`tipo_time?select=id_tipo_time,descricao`));
  const _tipoNomeP = (_tiposP||[]).find(t => String(t.id_tipo_time) === String(_tipoTimeP))?.descricao;
  const { data: posicoes, loading, reload } = useQuery(() =>
    _tipoTimeP ? api.get(`posicao?id_tipo_time=eq.${_tipoTimeP}&select=*&order=ordem.asc,nome.asc`) : Promise.resolve([]), [_tipoTimeP]
  );
  // Mapa id_posicao → nome, para resolver o grupo pai no front (evita self-join frágil do PostgREST)
  const mapaPosicoes = React.useMemo(() => {
    const m = {};
    (posicoes||[]).forEach(p => { m[p.id_posicao] = p.nome; });
    return m;
  }, [posicoes]);
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
      <div style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.dim }}>
        ℹ️ As posições são definidas pelo tipo de time{_tipoNomeP ? <> (<b style={{color:C.cream}}>{_tipoNomeP}</b>)</> : ""} e são iguais para todos os times desse tipo. Esta tela é apenas para consulta. Para alterações, fale com o suporte.
      </div>
      {["Grupos (pai)","Posições detalhadas"].map((titulo, gi) => {
        const lista = gi === 0 ? grupos : filhas;
        if (!lista.length) return null;
        return (
          <div key={titulo}>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>{titulo}</div>
            <Card style={{ padding:0, overflow:"hidden" }}>
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
                <thead><tr style={{ background:C.surf2 }}>
                  <ThSortable colKey="nome" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Nome</ThSortable>
                  <ThSortable colKey="descricao" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Descrição</ThSortable>
                  <ThSortable colKey="ordem" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Ordem</ThSortable>
                  <th style={{ padding:"12px 14px", textAlign:"left", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:C.dim, fontWeight:700, whiteSpace:"nowrap" }}>Grupo pai</th>
                  <ThSortable colKey="data_fim" sortKey={_sk} asc={_asc} onSort={k=>{if(_sk===k)_setAsc(a=>!a);else{_setSk(k);_setAsc(true);}}}>Inativo em</ThSortable>
                  <ThSortable sortKey={_sk} asc={_asc} onSort={()=>{}}></ThSortable>
                </tr></thead>
                <tbody>
                  {lista.map((p, i) => (
                    <tr key={p.id_posicao} style={{ background: i%2===0?C.surface:C.bg }}>
                      <td style={{ padding:"11px 14px", fontWeight:700 }}>{p.nome}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{p.descricao || "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, textAlign:"center" }}>{p.ordem ?? "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{mapaPosicoes[p.id_posicao_pai] || "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:12, whiteSpace:"nowrap" }}>{p.data_fim ? new Date(p.data_fim).toLocaleDateString("pt-BR") : "—"}</td>
                      <td style={{ padding:"11px 14px", display:"flex", gap:8 }}>
                        {/* Tela de consulta: edição é feita pelo super admin no tipo de time */}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
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
              <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CRUD TEMPORADAS ───────────────────────────────────────────
function CrudTemporadas({ idTime, show, readOnly }) {
  const { data: temporadas, loading, reload } = useQuery(() =>
    idTime ? api.get(`temporada?id_time=eq.${idTime}&select=*,time(nome)&order=data_inicio.desc`) : Promise.resolve([]),
    [idTime]
  );
  const { data: times } = useQuery(() => idTime ? api.get(`time?id_time=eq.${idTime}&select=*&order=nome.asc`) : Promise.resolve([]), [idTime]);
  const [_sk, _setSk] = useState("data_inicio"); const [_asc, _setAsc] = useState(false);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingImport, setLoadingImport] = useState(null);
  const [resultadoImport, setResultadoImport] = useState(null);

  async function confirmarImportTemporadas() {
    setSaving(true);
    try {
      const id_time_val = idTime || null;
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
    const ultima = temporadas?.[0]; // mais recente (ordenado por data_inicio desc)
    setForm({ nome:"", id_time: t ? String(t.id_time) : "", data_inicio:"", data_fim:"", publico: true,
      escudo_url: ultima?.escudo_url || t?.escudo_url || null,
      uniforme_1_url: ultima?.uniforme_1_url || null,
      uniforme_2_url: ultima?.uniforme_2_url || null,
      uniforme_3_url: ultima?.uniforme_3_url || null,
      tecnico: t?.tecnico||"", presidente: t?.presidente||"", vice_presidente: t?.vice_presidente||"", financeiro: t?.financeiro||"", vice_financeiro: t?.vice_financeiro||"", marca_jogos: t?.marca_jogos||"", resp_redes_sociais: t?.resp_redes_sociais||"", resp_eventos: t?.resp_eventos||"", observacoes:"" });
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
        {!readOnly && <Btn onClick={abrirNovo}>+ Nova Temporada</Btn>}
      </div>
      <ModalImportacao resultado={resultadoImport} onClose={() => setResultadoImport(null)} onConfirmar={confirmarImportTemporadas} salvando={saving}/>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
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
                <td style={{ padding:"11px 14px" }}>{!readOnly && <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(t)}>Editar</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
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
                {form.escudo_url && <button onClick={() => !readOnly && set("escudo_url", null)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:11 }}>✕ Remover</button>}
                <div style={{ fontSize:10, color:C.dim }}>Opcional — se diferente do escudo do time</div>
              </div>
            </div>

            {/* Uniformes */}
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginTop:4 }}>Uniformes</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(90px, 1fr))", gap:12 }}>
              {/* Uniforme 1 */}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ fontSize:11, color:C.dim, fontWeight:700 }}>👕 Uniforme 1</div>
                {form.uniforme_1_url && (
                  <img src={form.uniforme_1_url} alt="Uniforme 1"
                    style={{ width:"100%", height:80, objectFit:"contain", borderRadius:8, background:C.surf2, border:`1px solid ${C.border}` }}/>
                )}
                <ImageUpload bucket="uniformes" value={form.uniforme_1_url} onUpload={url => set("uniforme_1_url", url)} nomeArquivo={`uniforme_1_${form.id_temporada||'novo'}`}/>
                {form.uniforme_1_url && (
                  <button onClick={() => !readOnly && set("uniforme_1_url", null)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:11 }}>✕ Remover</button>
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
                  <button onClick={() => !readOnly && set("uniforme_2_url", null)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:11 }}>✕ Remover</button>
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
                  <button onClick={() => !readOnly && set("uniforme_3_url", null)} style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:11 }}>✕ Remover</button>
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
              <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── CONFIGURAÇÕES DO TIME ─────────────────────────────────────
function ConfigTime({ idTime, show, readOnly }) {
  const { data: times, loading, reload } = useQuery(() => idTime ? api.get(`time?id_time=eq.${idTime}&select=*&limit=1`) : Promise.resolve([]), [idTime]);
  const { data: campos  } = useQuery(() => idTime ? api.get(`campo?id_time=eq.${idTime}&select=*&order=nome.asc`) : Promise.resolve([]), [idTime]);
  const [ufSede, setUfSede] = useState("RS");
  const { data: cidades } = useQuery(() => ufSede ? api.get(`cidade?estado=eq.${ufSede}&select=id_cidade,nome,estado&order=nome.asc`) : Promise.resolve([]), [ufSede]);
  const { data: tipos   } = useQuery(() => api.get(`tipo_time?select=*&status=eq.Ativo&order=descricao.asc`));
  const [form, setForm]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [tipoOriginal, setTipoOriginal] = useState("");
  const [subtipoOriginal, setSubtipoOriginal] = useState("");
  const [confirmaTroca, setConfirmaTroca] = useState(null); // {qtd, motivo:'tipo'|'subtipo'} quando precisa confirmar
  const [textoConfirma, setTextoConfirma] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  // É turma fechada? (pelo tipo selecionado no form)
  const tipoSelecionado = (tipos||[]).find(t => String(t.id_tipo_time) === String(form?.id_tipo_time));
  const ehTurmaFechada = !!tipoSelecionado?.eh_turma_fechada;
  const subtiposDisponiveis = (tipos||[]).filter(t => !t.eh_turma_fechada);

  useEffect(() => {
    if (times?.[0] && !form) {
      const t = times[0];
      setForm({ ...t, id_campo: t.id_campo ? String(t.id_campo) : "", id_cidade_sede: t.id_cidade_sede ? String(t.id_cidade_sede) : "", id_tipo_time: t.id_tipo_time ? String(t.id_tipo_time) : "", id_subtipo: t.id_subtipo ? String(t.id_subtipo) : "", data_fundacao: t.data_fundacao ? t.data_fundacao.split("T")[0] : "" });
      setTipoOriginal(t.id_tipo_time ? String(t.id_tipo_time) : "");
      setSubtipoOriginal(t.id_subtipo ? String(t.id_subtipo) : "");
      // Descobre a UF da cidade-sede atual para pré-selecionar o dropdown de estado
      if (t.id_cidade_sede) {
        api.get(`cidade?id_cidade=eq.${t.id_cidade_sede}&select=estado&limit=1`)
          .then(d => { if (d?.[0]?.estado) setUfSede(d[0].estado); })
          .catch(() => {});
      }
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
    // Detecta troca de tipo OU de subtipo — ambas zeram posições dos jogadores
    const tipoMudou = tipoOriginal && form.id_tipo_time && String(form.id_tipo_time) !== String(tipoOriginal);
    const subtipoMudou = ehTurmaFechada && form.id_subtipo && String(form.id_subtipo) !== String(subtipoOriginal);
    if ((tipoMudou || subtipoMudou) && !confirmaTroca) {
      try {
        const jogs = await api.get(`jogador?id_jogador=gt.0&id_time=eq.${form.id_time}&id_posicao=not.is.null&select=id_jogador`);
        setTextoConfirma("");
        setConfirmaTroca({ qtd: (jogs||[]).length, motivo: tipoMudou ? "tipo" : "subtipo" });
      } catch {
        setConfirmaTroca({ qtd: 0, motivo: tipoMudou ? "tipo" : "subtipo" });
      }
      return;
    }
    await salvarDefinitivo(false);
  }

  function aplicarSubtipo(id_sub) {
    const sub = (tipos||[]).find(t => String(t.id_tipo_time) === String(id_sub));
    setForm(f => ({ ...f,
      id_subtipo: String(id_sub),
      ...(sub ? {
        numero_titulares: sub.numero_titulares,
        quantidade_periodos: sub.quantidade_periodos,
        minutos_padrao_periodo: sub.minutos_padrao_periodo,
        permite_acrescimos: sub.permite_acrescimos,
      } : {}),
    }));
  }

  async function salvarDefinitivo(zerarPosicoes) {
    setSaving(true);
    try {
      const body = {
        nome: form.nome, telefone: form.telefone||null,
        escudo_url: form.escudo_url||null,
        id_campo: form.id_campo ? Number(form.id_campo) : null,
        id_cidade_sede: form.id_cidade_sede ? Number(form.id_cidade_sede) : null,
        id_tipo_time: form.id_tipo_time ? Number(form.id_tipo_time) : null,
        id_subtipo: (ehTurmaFechada && form.id_subtipo) ? Number(form.id_subtipo) : null,
        valor_mensalidade: form.valor_mensalidade ? Number(form.valor_mensalidade) : null,
        saldo_inicial: form.saldo_inicial ? Number(form.saldo_inicial) : 0,
        data_fundacao: form.data_fundacao||null,
        numero_titulares: form.numero_titulares ? Number(form.numero_titulares) : null,
        quantidade_periodos: form.quantidade_periodos ? Number(form.quantidade_periodos) : null,
        minutos_padrao_periodo: form.minutos_padrao_periodo ? Number(form.minutos_padrao_periodo) : null,
        permite_acrescimos: form.permite_acrescimos||"N",
        tecnico: form.tecnico||null, presidente: form.presidente||null,
        vice_presidente: form.vice_presidente||null, financeiro: form.financeiro||null,
        vice_financeiro: form.vice_financeiro||null, marca_jogos: form.marca_jogos||null,
        resp_redes_sociais: form.resp_redes_sociais||null, resp_eventos: form.resp_eventos||null,
        raio_busca_km: form.raio_busca_km ? Number(form.raio_busca_km) : 50,
        observacoes: form.observacoes||null, publico: form.publico !== false
      };
      await api.patch(`time?id_time=eq.${form.id_time}`, body);
      // Se trocou o tipo de time: zera a posição dos jogadores (cadastro atual),
      // preservando o histórico das partidas (participacao não é tocada).
      if (zerarPosicoes) {
        try {
          await api.patch(`jogador?id_time=eq.${form.id_time}&id_jogador=gt.0`, { id_posicao: null });
          show("Tipo alterado. As posições dos jogadores foram removidas — recadastre-as.");
        } catch(e) {
          show("Time salvo, mas houve erro ao limpar posições: " + e.message, "error");
        }
      } else {
        show("Configurações salvas!");
      }
      setTipoOriginal(form.id_tipo_time ? String(form.id_tipo_time) : "");
      setSubtipoOriginal(form.id_subtipo ? String(form.id_subtipo) : "");
      setConfirmaTroca(null); setTextoConfirma("");
      reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  if (!form) return (
    <Card style={{ padding:24, textAlign:"center" }}>
      <div style={{ fontSize:14, color:C.dim }}>Não foi possível carregar os dados do time. Tente recarregar a página.</div>
    </Card>
  );

  return (
    <Card style={{ padding:24 }}>
      <style>{`
        .identidade-row{display:flex;align-items:flex-start;gap:20px}
        .cfg-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .cfg-grid-auto{display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px}
        .identidade-row .cfg-grid-2{flex:1}
        @media(max-width:480px){
          .identidade-row{flex-direction:column;align-items:center}
          .identidade-row .cfg-grid-2{width:100%}
          .cfg-grid-2{grid-template-columns:1fr}
          .cfg-grid-auto{grid-template-columns:1fr}
        }
      `}</style>
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

        {/* Identidade do Time */}
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Identidade</div>
        <div className="identidade-row">
          <ImageUpload label="Escudo" value={form.escudo_url||""} onUpload={url => set("escudo_url", url)} bucket="escudos" nomeArquivo={`time_${form.id_time}`}/>
          <div className="cfg-grid-2">
            <Input label="Nome do Time *" value={form.nome||""} onChange={e => set("nome", e.target.value)}/>
            <Input label="Telefone" value={form.telefone||""} onChange={e => set("telefone", e.target.value)}/>
            <Input label="Data de Fundação" type="date" value={form.data_fundacao||""} onChange={e => set("data_fundacao", e.target.value)}/>
            <Select label="Estado (UF)" value={ufSede} onChange={e => { setUfSede(e.target.value); set("id_cidade_sede", ""); }}>
              {UFS_BR.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Select label="Cidade Sede" value={form.id_cidade_sede||""} onChange={e => set("id_cidade_sede", e.target.value)}>
              <option value="">{cidades === null ? "Carregando..." : "Selecione..."}</option>
              {(cidades||[]).map(c => <option key={c.id_cidade} value={c.id_cidade}>{c.nome}</option>)}
            </Select>
            <Select label="Campo Principal" value={form.id_campo||""} onChange={e => set("id_campo", e.target.value)}>
              <option value="">Selecione...</option>
              {(campos||[]).map(c => <option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
            </Select>
            <Input label="Valor Mensalidade (R$)" type="number" min="0" step="0.01" value={form.valor_mensalidade||""} onChange={e => set("valor_mensalidade", e.target.value)}/>
            <Input label="Raio de busca de adversários (km)" type="number" min="1" step="1" value={form.raio_busca_km ?? 50} onChange={e => set("raio_busca_km", e.target.value)}/>
            <Input label="Saldo Inicial do Caixa (R$)" type="number" step="0.01" value={form.saldo_inicial||""} onChange={e => set("saldo_inicial", e.target.value)}/>
          </div>
        </div>

        {/* Tipo de Time */}
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Tipo de Time</div>
        <div className="cfg-grid-2" style={{ alignItems:"end" }}>
          <Select label="Tipo de Time" value={form.id_tipo_time||""} onChange={e => aplicarTipo(e.target.value)}>
            <option value="">Selecione...</option>
            {(tipos||[]).map(t => <option key={t.id_tipo_time} value={t.id_tipo_time}>{t.descricao}</option>)}
          </Select>
          <div style={{ fontSize:11, color:C.dim, fontStyle:"italic", paddingBottom:4 }}>
            Ao mudar o tipo, as regras abaixo são atualizadas automaticamente
          </div>
        </div>

        {ehTurmaFechada && (
          <div className="cfg-grid-2" style={{ alignItems:"end" }}>
            <Select label="Modalidade (subtipo)" value={form.id_subtipo||""} onChange={e => aplicarSubtipo(e.target.value)}>
              <option value="">Selecione a modalidade...</option>
              {subtiposDisponiveis.map(t => <option key={t.id_tipo_time} value={t.id_tipo_time}>{t.descricao}</option>)}
            </Select>
            <div style={{ fontSize:11, color:C.dim, fontStyle:"italic", paddingBottom:4 }}>
              A turma usa as posições e regras da modalidade. Trocar a modalidade remove as posições dos jogadores.
            </div>
          </div>
        )}

        {/* Regras do Jogo */}
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Regras do Jogo</div>
        <div className="cfg-grid-auto">
          <Input label="Nº Titulares"    type="number" min="1" value={form.numero_titulares||""} onChange={e => set("numero_titulares", e.target.value)} />
          <Input label="Qtd. Períodos"   type="number" min="1" value={form.quantidade_periodos||""} onChange={e => set("quantidade_periodos", e.target.value)} />
          <Input label="Min. por Período" type="number" min="1" value={form.minutos_padrao_periodo||""} onChange={e => set("minutos_padrao_periodo", e.target.value)} />
          <Select label="Permite Acrés." value={form.permite_acrescimos||"N"} onChange={e => set("permite_acrescimos", e.target.value)}>
            <option value="N">Não</option>
            <option value="S">Sim</option>
          </Select>
        </div>

        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginTop:4, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Comissão Atual</div>
        <div className="cfg-grid-2">
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
          <Btn onClick={salvar} disabled={saving || readOnly}>{saving ? "Salvando..." : readOnly ? "Somente Leitura" : "Salvar Configurações"}</Btn>
        </div>
      </div>

      {confirmaTroca && (
        <Modal title={confirmaTroca.motivo === "subtipo" ? "⚠️ Trocar a modalidade da turma" : "⚠️ Trocar o tipo de time"} onClose={() => { setConfirmaTroca(null); setTextoConfirma(""); }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:`${C.loss}1A`, border:`1px solid ${C.loss}55`, borderRadius:8, padding:"12px 14px", fontSize:14, color:C.cream, lineHeight:1.5 }}>
              {confirmaTroca.motivo === "subtipo"
                ? <>Cada modalidade tem suas próprias posições. Ao trocar a modalidade, <b>a posição de todos os jogadores será removida</b></>
                : <>Cada tipo de time tem suas próprias posições. Ao trocar o tipo, <b>a posição de todos os jogadores será removida</b></>}
              {confirmaTroca.qtd > 0 ? <> — isso afeta <b>{confirmaTroca.qtd} jogador(es)</b> que têm posição definida.</> : "."}
              <br/><br/>
              Você precisará <b>recadastrar a posição de cada jogador</b> com as posições da {confirmaTroca.motivo === "subtipo" ? "nova modalidade" : "novo tipo"}. O histórico das partidas já jogadas é preservado.
              <br/><br/>
              <b>Esta ação não pode ser desfeita.</b>
            </div>
            <div>
              <div style={{ fontSize:13, color:C.dim, marginBottom:6 }}>Para confirmar, digite <b style={{color:C.gold}}>TROCAR</b> abaixo:</div>
              <Input value={textoConfirma} onChange={e => setTextoConfirma(e.target.value)} placeholder="Digite TROCAR"/>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <Btn variant="secondary" onClick={() => { setConfirmaTroca(null); setTextoConfirma(""); }}>Cancelar</Btn>
              <Btn variant="danger" disabled={textoConfirma.trim().toUpperCase() !== "TROCAR" || saving}
                onClick={() => salvarDefinitivo(true)}>
                {saving ? "Salvando..." : "Confirmar troca e remover posições"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
