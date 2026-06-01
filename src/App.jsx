import { useState, useEffect, useCallback, useMemo } from "react";

// ── Supabase ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://nxztffulmvohduvudbhg.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Paleta ────────────────────────────────────────────────────
const C = {
  bg: "#0B3D2E", surface: "#103D2A", surf2: "#174D36",
  border: "#1F5C3E", gold: "#E8A020", cream: "#F0E8D0",
  dim: "#8FAF9A", win: "#4CAF50", loss: "#E53935", draw: "#E8A020",
};

function Logo({ size = 44 }) {
  return (
    <img src="/logo.png" alt="Nerd do Campo"
      style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}/>
  );
}

function Card({ children, style: s = {} }) {
  return <div style={{ background: C.surface, borderRadius: 12, padding: "20px 24px", border: `1px solid ${C.border}`, ...s }}>{children}</div>;
}
function SecTitle({ children, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      {accent && <div style={{ width: 4, height: 24, background: C.gold, borderRadius: 2 }} />}
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.cream }}>{children}</h2>
    </div>
  );
}
function Badge({ label, cor }) {
  return <span style={{ background: cor+"22", color: cor, border:`1px solid ${cor}55`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>{label}</span>;
}
function Spinner() {
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:80, flexDirection:"column", gap:16 }}>
      <div style={{ width:44, height:44, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.gold}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <div style={{ color:C.dim, fontSize:13, textTransform:"uppercase", letterSpacing:"0.1em" }}>Carregando...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function useQuery(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetcher()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error };
}

function resultado(p) {
  if (p.cancelada === "S") return { label:"Cancelado", cor:C.dim };
  if (p.gols_marcados === null) return { label:"Pendente", cor:C.dim };
  if (p.gols_marcados > p.gols_sofridos) return { label:"Vitória", cor:C.win };
  if (p.gols_marcados < p.gols_sofridos) return { label:"Derrota", cor:C.loss };
  return { label:"Empate", cor:C.draw };
}
function fmtData(ts) { return ts ? new Date(ts).toLocaleDateString("pt-BR") : "—"; }
function fmtHora(ts) { return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" }) : "—"; }

// ── SELETOR DE TIMES ──────────────────────────────────────────
function SeletorTimes({ onSelect }) {
  const [dataRef, setDataRef] = useState(""); // vazio = sem filtro de data

  const { data: allTimes, loading } = useQuery(() => sb(`time?select=*,temporada(id_temporada,nome,data_inicio,data_fim,publico),tipo_time(id_tipo_time,descricao),cidade:id_cidade_sede(nome,estado),campo:id_campo(nome)&publico=eq.true&order=nome.asc`));
  const { data: tiposAtivos } = useQuery(() => sb(`tipo_time?select=*&status=eq.Ativo&order=descricao.asc`));
  const tipoFutebolCampo = (tiposAtivos||[]).find(t => t.descricao.toLowerCase().includes("campo"))?.id_tipo_time || null;
  const [tipoFiltro, setTipoFiltro] = useState(null);
  // Inicializar com Futebol de Campo quando tipos carregarem
  useEffect(() => { if (tiposAtivos?.length && tipoFiltro === null) { const fc = (tiposAtivos||[]).find(t => t.descricao.toLowerCase().includes("campo")); setTipoFiltro(fc?.id_tipo_time || "todos"); } }, [tiposAtivos]);

  // Filtrar times
  const times = useMemo(() => {
    if (!allTimes) return [];
    return allTimes.filter(t => {
      const tempsPublicas = (t.temporada||[]).filter(temp => temp.publico === true);
      if (!tempsPublicas.length) return false;
      if (tipoFiltro && tipoFiltro !== "todos" && t.id_tipo_time !== tipoFiltro) return false;
      if (!dataRef) return true;
      return tempsPublicas.some(temp => {
        const inicio = temp.data_inicio ? new Date(temp.data_inicio) : null;
        const fim    = temp.data_fim    ? new Date(temp.data_fim)    : null;
        const ref    = new Date(dataRef);
        return (!inicio || ref >= inicio) && (!fim || ref <= fim);
      });
    });
  }, [allTimes, dataRef, tipoFiltro]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif" }}>
      <Spinner />
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif", color:C.cream }}>
      <header style={{ background:"#091F15", borderBottom:`3px solid ${C.gold}`, padding:"0 24px", display:"flex", alignItems:"center", gap:16, height:68, boxShadow:"0 4px 20px #00000066" }}>
        <Logo size={42}/>
        <div>
          <div style={{ fontSize:20, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:C.cream, lineHeight:1 }}>Nerd do Campo</div>
          <div style={{ fontSize:11, color:C.gold, letterSpacing:"0.1em", textTransform:"uppercase" }}>Estatísticas de Futebol Amador</div>
        </div>
      </header>

      <main style={{ maxWidth:900, margin:"0 auto", padding:"60px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <div style={{ fontSize:32, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>
            Escolha um Time
          </div>
          <div style={{ fontSize:15, color:C.dim }}>Selecione o time para ver as estatísticas da temporada</div>
        </div>

        {/* Filtro de tipo de time */}
        {(tiposAtivos||[]).length > 0 && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginBottom:8 }}>
            <button onClick={() => setTipoFiltro("todos")}
              style={{ background: tipoFiltro==="todos" ? C.gold : C.surface, color: tipoFiltro==="todos" ? "#0B3D2E" : C.dim, border:`1px solid ${tipoFiltro==="todos" ? C.gold : C.border}`, borderRadius:8, padding:"7px 16px", fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
              Todos
            </button>
            {(tiposAtivos||[]).map(t => (
              <button key={t.id_tipo_time} onClick={() => setTipoFiltro(t.id_tipo_time)}
                style={{ background: tipoFiltro===t.id_tipo_time ? C.gold : C.surface, color: tipoFiltro===t.id_tipo_time ? "#0B3D2E" : C.dim, border:`1px solid ${tipoFiltro===t.id_tipo_time ? C.gold : C.border}`, borderRadius:8, padding:"7px 16px", fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
                {t.descricao}
              </button>
            ))}
          </div>
        )}

        {/* Filtro de data de referência — opcional */}
        <div style={{ marginBottom:24 }}>
          <div style={{ background:C.surface, borderRadius:12, border:`1px solid ${dataRef ? C.gold : C.border}`, overflow:"hidden", transition:"border 0.2s" }}>
            {/* Header do filtro */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16 }}>📅</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.cream, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                    Filtrar por data
                  </div>
                  <div style={{ fontSize:10, color:C.dim, marginTop:1 }}>
                    {dataRef
                      ? `Times com temporada ativa em ${new Date(dataRef+'T12:00:00').toLocaleDateString('pt-BR')}`
                      : "Opcional — sem filtro mostra todos os times"}
                  </div>
                </div>
              </div>
              {dataRef && (
                <button onClick={() => setDataRef("")}
                  style={{ background:C.loss+"22", border:`1px solid ${C.loss}44`, borderRadius:6, color:C.loss, cursor:"pointer", fontSize:11, padding:"4px 10px", fontFamily:"inherit", fontWeight:700, flexShrink:0 }}>
                  ✕ Limpar
                </button>
              )}
            </div>
            {/* Input de data */}
            <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
              <input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)}
                style={{ flex:1, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.gold, fontFamily:"inherit", fontSize:16, fontWeight:700, padding:"10px 14px", outline:"none", cursor:"pointer", WebkitAppearance:"none" }}/>
              {!dataRef && (
                <span style={{ fontSize:11, color:C.dim, fontStyle:"italic", flexShrink:0 }}>ou deixe em branco</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:16 }}>
          {(times||[]).map(t => {
            return (
              <div key={t.id_time}
                onClick={() => onSelect(t)}
                style={{ background:C.surface, borderRadius:16, padding:"28px 24px", border:`1px solid ${C.border}`, cursor:"pointer", transition:"all 0.2s", textAlign:"center" }}
                onMouseEnter={e => { e.currentTarget.style.background = C.surf2; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}>
                {t.escudo_url
                  ? <img src={t.escudo_url} alt={t.nome} style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}`, margin:"0 auto 16px", display:"block" }}/>
                  : <div style={{ width:72, height:72, borderRadius:"50%", background:C.surf2, border:`2px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:28 }}>⚽</div>
                }
                <div style={{ fontSize:18, fontWeight:800, textTransform:"uppercase", marginBottom:8 }}>{t.nome}</div>
                {t.data_fundacao && (
                  <div style={{ fontSize:11, color:C.dim, marginBottom:6 }}>
                    Fundado em {new Date(t.data_fundacao).getFullYear()}
                  </div>
                )}
                {t.marca_jogos && (
                  <div style={{ fontSize:12, color:C.dim, marginBottom:4 }}>
                    📋 <span style={{ color:C.cream }}>Marca jogos:</span> {t.marca_jogos}
                  </div>
                )}
                {t.telefone && (
                  <div style={{ fontSize:12, color:C.dim }}>
                    📞 <span style={{ color:C.cream }}>{t.telefone}</span>
                  </div>
                )}
                {t.resp_redes_sociais && (
                  <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>
                    📱 <span style={{ color:C.cream }}>{t.resp_redes_sociais}</span>
                  </div>
                )}
                {t.cidade && (
                  <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>
                    📍 <span style={{ color:C.cream }}>{t.cidade.nome}{t.cidade.estado ? ` — ${t.cidade.estado}` : ""}</span>
                  </div>
                )}
                {t.campo && (
                  <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>
                    🏟️ <span style={{ color:C.cream }}>{t.campo.nome}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer style={{ textAlign:"center", padding:"20px", color:C.dim, fontSize:12, borderTop:`1px solid ${C.border}`, marginTop:40 }}>
        ⚽ Nerd do Campo — Estatísticas de Futebol Amador
      </footer>
    </div>
  );
}

// ── VISÃO GERAL ───────────────────────────────────────────────
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
      {/* Identidade visual da temporada */}
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
          <SecTitle accent>Último Jogo</SecTitle>
          {ultima ? (<>
            <div style={{ fontSize:13, color:C.dim, marginBottom:4 }}>{fmtData(ultima.data)} · {ultima.em_casa==="S"?"Em Casa":"Fora"}</div>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{ultima.adversario?.nome}</div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:32, fontWeight:800, color:C.gold }}>{ultima.gols_marcados} × {ultima.gols_sofridos}</span>
              <Badge {...resultado(ultima)}/>
            </div>
            <div style={{ fontSize:12, color:C.dim, marginTop:6 }}>🏟️ {ultima.campo?.nome}</div>
          </>) : <div style={{color:C.dim}}>Nenhum jogo realizado ainda</div>}
        </Card>
        <Card>
          <SecTitle accent>Próximo Jogo</SecTitle>
          {proxima ? (<>
            <div style={{ fontSize:13, color:C.dim, marginBottom:4 }}>{fmtData(proxima.data)} · {fmtHora(proxima.data)} · {proxima.em_casa==="S"?"Em Casa":"Fora"}</div>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{proxima.adversario?.nome||"A definir"}</div>
            <div style={{ fontSize:12, color:C.dim }}>🏟️ {proxima.campo?.nome}</div>
            <div style={{ marginTop:12, padding:"8px 14px", background:C.gold+"22", border:`1px solid ${C.gold}55`, borderRadius:8, display:"inline-block" }}>
              <span style={{ color:C.gold, fontWeight:700, fontSize:13 }}>⏰ Aguardando</span>
            </div>
          </>) : <div style={{color:C.dim}}>Sem jogos agendados</div>}
        </Card>
      </div>

      <div className="duo-grid">
        <Card><SecTitle accent>⚽ Artilheiros</SecTitle><RankList items={topGols} valKey="gols_marcados" cor={C.gold}/></Card>
        <Card><SecTitle accent>🅰️ Assistências</SecTitle><RankList items={topAssist} valKey="assistencias" cor={C.win}/></Card>
      </div>
    </div>
  );
}


// ── FICHA DA PARTIDA (PÚBLICA) ────────────────────────────────
function FichaPartidaPublica({ partida, onVoltar }) {
  const { data: participacoes, loading: loadPart } = useQuery(
    () => sb(`participacao?id_partida=eq.${partida.id_partida}&id_jogador=gt.0&select=*,jogador(nome,apelido,camisa,foto_url),posicao(nome)&order=titular.desc,camisa.asc`),
    [partida.id_partida]
  );
  const { data: gols, loading: loadGols } = useQuery(
    () => sb(`gol?select=*,participacao!inner(id_jogador,jogador(nome,apelido,camisa))&participacao.id_partida=eq.${partida.id_partida}&order=periodo.asc,minuto.asc`),
    [partida.id_partida]
  );

  const res = resultado(partida);
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
          {fmtData(partida.data)} · {fmtHora(partida.data)} · {partida.em_casa==="S"?"🏠 Em Casa":"✈️ Fora"}
        </div>
        <div style={{ fontSize:24, fontWeight:800, textTransform:"uppercase", marginBottom:12 }}>{partida.adversario?.nome}</div>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:8 }}>
          <span style={{ fontSize:42, fontWeight:800, color:C.gold }}>{partida.gols_marcados} × {partida.gols_sofridos}</span>
          <Badge {...res}/>
        </div>
        <div style={{ fontSize:12, color:C.dim }}>🏟️ {partida.campo?.nome}</div>
        {partida.observacoes && <div style={{ fontSize:12, color:C.dim, marginTop:6 }}>📝 {partida.observacoes}</div>}
      </Card>

      {/* Gols */}
      {(gols||[]).length > 0 && (
        <Card>
          <SecTitle accent>⚽ Gols</SecTitle>
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
          <SecTitle accent>👕 Escalação</SecTitle>
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

// ── CALENDÁRIO ────────────────────────────────────────────────
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
                const res = resultado(p);
                return (
                  <tr key={p.id_partida}
                    onClick={() => { if (p.gols_marcados !== null && p.cancelada !== "S") setPartidaSel(p); }}
                    style={{ background:i%2===0?C.surface:C.bg, cursor: p.gols_marcados !== null && p.cancelada !== "S" ? "pointer" : "default" }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=C.surf2; }}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.surface:C.bg}>
                    <td style={{ padding:"12px 14px", fontWeight:600, whiteSpace:"nowrap" }}>{fmtData(p.data)}</td>
                    <td style={{ padding:"12px 14px", color:C.dim }}>{fmtHora(p.data)}</td>
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
                    <td style={{ padding:"12px 14px" }}><Badge {...res}/></td>
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

// ── ELENCO ────────────────────────────────────────────────────
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
          <SecTitle>👕 Uniformes</SecTitle>
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

// ── ESTATÍSTICAS ──────────────────────────────────────────────
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
        <SecTitle accent>Estatísticas dos Jogadores</SecTitle>
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

// ── GOLS ──────────────────────────────────────────────────────
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
            return <option key={p.id_partida} value={p.id_partida}>{fmtData(p.data)} — {p.adversario?.nome} ({qtd} gol{qtd!==1?"s":""})</option>;
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
                  <td style={{ padding:"12px 14px", color:C.dim, fontSize:13, whiteSpace:"nowrap" }}>{fmtData(g.data_partida)}</td>
                  <td style={{ padding:"12px 14px", fontWeight:700 }}>{g.adversario}</td>
                  <td style={{ padding:"12px 14px" }}>
                    <span style={{ color:C.gold, fontWeight:700 }}>⚽ {g.jogador}</span>
                    {g.gol_contra==="Sim" && <span style={{ marginLeft:6 }}><Badge label="GC" cor={C.loss}/></span>}
                    {g.penalti==="Sim" && <span style={{ marginLeft:6 }}><Badge label="P" cor={C.draw}/></span>}
                  </td>
                  <td style={{ padding:"12px 14px", textAlign:"center" }}>{g.periodo}°</td>
                  <td style={{ padding:"12px 14px", textAlign:"center", fontWeight:700 }}>{g.minuto}'</td>
                  <td style={{ padding:"12px 14px", textAlign:"center" }}>{g.penalti==="Sim"?<Badge label="Sim" cor={C.draw}/>:<span style={{color:C.dim,fontSize:13}}>Não</span>}</td>
                  <td style={{ padding:"12px 14px", textAlign:"center" }}>{g.gol_contra==="Sim"?<Badge label="Sim" cor={C.loss}/>:<span style={{color:C.dim,fontSize:13}}>Não</span>}</td>
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

// ── APP PRINCIPAL ─────────────────────────────────────────────
const TABS = [
  { label:"Visão Geral", icon:"📊" },
  { label:"Calendário",  icon:"📅" },
  { label:"Elenco",      icon:"👕" },
  { label:"Estatísticas",icon:"📈" },
  { label:"Gols",        icon:"⚽" },
];

function TimeApp({ time, onVoltar }) {
  const [tab, setTab] = useState(0);
  const { data: temporadas } = useQuery(
    () => sb(`temporada?id_time=eq.${time.id_time}&select=*&publico=eq.true&order=data_inicio.desc`),
    [time.id_time]
  );
  const [temporadaSel, setTemporadaSel] = useState(null);
  useEffect(() => { if (temporadas?.length && !temporadaSel) setTemporadaSel(temporadas[0]); }, [temporadas]);

  const screens = temporadaSel ? [
    <VisaoGeral   key="vg"    temporada={temporadaSel}/>,
    <Calendario   key="cal"   temporada={temporadaSel}/>,
    <Elenco       key="el"    time={time}/>,
    <Estatisticas key="st"    time={time} temporada={temporadaSel}/>,
    <Gols         key="gols"  temporada={temporadaSel}/>,
  ] : [<Spinner key="s"/>];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif", color:C.cream, paddingBottom:70 }}>

      {/* Header compacto */}
      <header style={{ background:"#091F15", borderBottom:`3px solid ${C.gold}`, padding:"0 12px", display:"flex", alignItems:"center", gap:10, height:56, position:"sticky", top:0, zIndex:100, boxShadow:"0 4px 24px #00000066" }}>
        <button onClick={onVoltar} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 8px 4px 0", color:C.dim, fontSize:24, lineHeight:1, flexShrink:0 }}>‹</button>
        <img src="/logo.png" alt="Nerd do Campo" style={{ width:30, height:30, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}/>
        {(temporadaSel?.escudo_url || time.escudo_url) && <img src={temporadaSel?.escudo_url || time.escudo_url} alt={time.nome} style={{ width:30, height:30, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}`, flexShrink:0 }}/>}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:800, textTransform:"uppercase", color:C.cream, lineHeight:1.1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{time.nome}</div>
        </div>
        {(temporadas||[]).length > 0 && (
          <div style={{ display:"flex", gap:4, flexShrink:0, flexWrap:"nowrap", overflowX:"auto", maxWidth:200 }}>
            {(temporadas||[]).map(t => (
              <button key={t.id_temporada} onClick={() => setTemporadaSel(t)}
                style={{ background: temporadaSel?.id_temporada === t.id_temporada ? C.gold : "transparent",
                  color: temporadaSel?.id_temporada === t.id_temporada ? "#0B3D2E" : C.dim,
                  border:`1px solid ${temporadaSel?.id_temporada === t.id_temporada ? C.gold : C.border}`,
                  borderRadius:6, padding:"3px 8px", fontFamily:"inherit", fontWeight:700,
                  fontSize:10, cursor:"pointer", textTransform:"uppercase", whiteSpace:"nowrap", flexShrink:0 }}>
                {t.nome}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Conteúdo */}
      <main style={{ maxWidth:1200, margin:"0 auto", padding:"12px 10px 20px" }}>
        {screens[tab]}
      </main>

      {/* Menu inferior fixo */}
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, background:"#091F15", borderTop:`2px solid ${C.gold}`, display:"flex", zIndex:100, boxShadow:"0 -4px 20px #00000066" }}>
        {TABS.map((t,i) => (
          <button key={t.label} onClick={()=>setTab(i)} style={{
            flex:1, background:"transparent",
            color: tab===i ? C.gold : C.dim,
            border:"none", padding:"8px 4px 10px",
            fontFamily:"inherit", fontWeight:700, fontSize:9,
            cursor:"pointer", textTransform:"uppercase",
            letterSpacing:"0.04em", display:"flex",
            flexDirection:"column", alignItems:"center", gap:3,
            borderTop: tab===i ? `2px solid ${C.gold}` : "2px solid transparent",
            marginTop:-2,
          }}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const [timeSel, setTimeSel] = useState(null);
  if (timeSel) return <TimeApp time={timeSel} onVoltar={() => setTimeSel(null)} />;
  return <SeletorTimes onSelect={setTimeSel} />;
}
