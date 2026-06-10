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
function CardTime({ t, onSelect, destaque = false }) {
  return (
    <div
      onClick={() => onSelect(t)}
      style={{ background:C.surface, borderRadius:16, padding:"28px 24px", border:`1px solid ${destaque ? C.gold : C.border}`, boxShadow: destaque ? `0 0 0 1px ${C.gold}33` : "none", cursor:"pointer", transition:"all 0.2s", textAlign:"center", position:"relative" }}
      onMouseEnter={e => { e.currentTarget.style.background = C.surf2; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = destaque ? C.gold : C.border; e.currentTarget.style.transform = "none"; }}>
      {destaque && (
        <div style={{ position:"absolute", top:12, right:12, fontSize:11, fontWeight:800, color:C.gold, background:`${C.gold}1A`, border:`1px solid ${C.gold}55`, borderRadius:6, padding:"2px 8px", textTransform:"uppercase", letterSpacing:"0.06em" }}>⭐ Oficial</div>
      )}
      {t.escudo_url
        ? <img src={t.escudo_url} alt={t.nome} style={{ width:96, height:96, borderRadius:"50%", objectFit:"cover", border:`3px solid ${C.gold}`, margin:"0 auto 16px", display:"block" }}/>
        : <div style={{ width:96, height:96, borderRadius:"50%", background:C.surf2, border:`3px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:36 }}>⚽</div>
      }
      <div style={{ fontSize:22, fontWeight:800, textTransform:"uppercase", marginBottom:10 }}>{t.nome}</div>
      {t.data_fundacao && (
        <div style={{ fontSize:13, color:C.dim, marginBottom:8 }}>Fundado em {new Date(t.data_fundacao).getFullYear()}</div>
      )}
      {t.marca_jogos && (
        <div style={{ fontSize:15, color:C.dim, marginBottom:6 }}>📋 <span style={{ color:C.cream }}>Marca jogos:</span> {t.marca_jogos}</div>
      )}
      {t.telefone && (
        <div style={{ fontSize:15, color:C.dim, marginBottom:4 }}>📞 <span style={{ color:C.cream }}>{t.telefone}</span></div>
      )}
      {t.resp_redes_sociais && (
        <div style={{ fontSize:15, color:C.dim, marginTop:4 }}>📱 <span style={{ color:C.cream }}>{t.resp_redes_sociais}</span></div>
      )}
      {t.cidade && (
        <div style={{ fontSize:15, color:C.dim, marginTop:4 }}>📍 <span style={{ color:C.cream }}>{t.cidade.nome}{t.cidade.estado ? ` — ${t.cidade.estado}` : ""}</span></div>
      )}
      {t.campo && (
        <div style={{ fontSize:15, color:C.dim, marginTop:4 }}>🏟️ <span style={{ color:C.cream }}>{t.campo.nome}</span></div>
      )}
    </div>
  );
}

function SeletorTimes({ onSelect }) {
  const [dataRef, setDataRef] = useState(""); // vazio = sem filtro de data
  const [modalCadastro, setModalCadastro] = useState(false);

  const { data: allTimes, loading } = useQuery(() => sb(`time?select=*,temporada(id_temporada,nome,data_inicio,data_fim,publico)&publico=eq.true&order=nome.asc`));
  const { data: _cidades } = useQuery(() => sb(`cidade?select=id_cidade,nome,estado`));
  const { data: _campos } = useQuery(() => sb(`campo?select=id_campo,nome`));
  const { data: tiposAtivos } = useQuery(() => sb(`tipo_time?select=*&status=eq.Ativo&order=descricao.asc`));
  const { data: configSistema } = useQuery(() => sb(`config_sistema?chave=eq.cadastro_time_ativo&select=valor&limit=1`));
  const cadastroAtivo = ["true","1"].includes(String(configSistema?.[0]?.valor ?? "").trim().toLowerCase());
  const tipoFutebolCampo = (tiposAtivos||[]).find(t => t.descricao.toLowerCase().includes("campo"))?.id_tipo_time || null;
  const [tipoFiltro, setTipoFiltro] = useState(null);
  // Mapa id_tipo_time -> descrição, para filtrar por NOME (robusto a tipos duplicados)
  const descricaoDoTipo = useMemo(() => {
    const m = new Map();
    (tiposAtivos||[]).forEach(t => m.set(t.id_tipo_time, t.descricao));
    return m;
  }, [tiposAtivos]);
  // Tipos únicos POR NOME (evita botões duplicados, ex: dois "Futebol de Campo")
  const tiposUnicos = useMemo(() => {
    const vistos = new Set(); const out = [];
    (tiposAtivos||[]).forEach(t => { if (!vistos.has(t.descricao)) { vistos.add(t.descricao); out.push(t); } });
    return out;
  }, [tiposAtivos]);
  // Abre em "Futebol de Campo" se existir; senão, "todos". Compara por NOME (robusto a duplicados).
  useEffect(() => { if (tiposAtivos?.length && tipoFiltro === null) {
    const temCampo = (tiposAtivos||[]).some(t => t.descricao.toLowerCase().includes("campo"));
    const fc = (tiposAtivos||[]).find(t => t.descricao.toLowerCase().includes("campo"));
    setTipoFiltro(temCampo ? fc.descricao : "todos");
  } }, [tiposAtivos]);

  // Filtrar times (e enriquecer com cidade/campo resolvidos das listas separadas)
  const times = useMemo(() => {
    if (!allTimes) return [];
    const mapaCidade = new Map((_cidades||[]).map(c => [c.id_cidade, c]));
    const mapaCampo = new Map((_campos||[]).map(c => [c.id_campo, c]));
    return allTimes.filter(t => {
      const tempsPublicas = (t.temporada||[]).filter(temp => temp.publico === true);
      if (!tempsPublicas.length) return false;
      if (tipoFiltro && tipoFiltro !== "todos" && descricaoDoTipo.get(t.id_tipo_time) !== tipoFiltro) return false;
      if (!dataRef) return true;
      return tempsPublicas.some(temp => {
        const inicio = temp.data_inicio ? new Date(temp.data_inicio) : null;
        const fim    = temp.data_fim    ? new Date(temp.data_fim)    : null;
        const ref    = new Date(dataRef);
        return (!inicio || ref >= inicio) && (!fim || ref <= fim);
      });
    }).map(t => ({
      ...t,
      cidade: t.id_cidade_sede ? mapaCidade.get(t.id_cidade_sede) : null,
      campo: t.id_campo ? mapaCampo.get(t.id_campo) : null,
    }));
  }, [allTimes, dataRef, tipoFiltro, _cidades, _campos, descricaoDoTipo]);

  const timesDestaque = useMemo(() => (times||[]).filter(t => t.destaque === true), [times]);
  const timesNormais  = useMemo(() => (times||[]).filter(t => !t.destaque), [times]);

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

      <main style={{ maxWidth:900, margin:"0 auto", padding:"48px 24px 60px" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          {/* Logo em destaque */}
          <div style={{ display:"inline-block", position:"relative", marginBottom:24 }}>
            <div style={{ position:"absolute", inset:-12, borderRadius:"50%",
              background:`radial-gradient(circle, ${C.gold}33 0%, transparent 70%)`,
              filter:"blur(8px)" }}/>
            <img src="/logo.png" alt="Nerd do Campo"
              style={{ width:120, height:120, borderRadius:"50%", objectFit:"cover",
                border:`3px solid ${C.gold}`, position:"relative",
                boxShadow:`0 8px 32px ${C.gold}44` }}/>
          </div>
          <div style={{ fontSize:34, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, color:C.cream }}>
            Nerd do Campo
          </div>
          <div style={{ fontSize:13, color:C.gold, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700, marginBottom:20 }}>
            Estatísticas de Futebol Amador
          </div>
          <div style={{ fontSize:15, color:C.dim }}>Selecione um time para ver as estatísticas da temporada</div>
        </div>

        {/* Filtro de tipo de time */}
        {(tiposAtivos||[]).length > 0 && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginBottom:8 }}>
            <button onClick={() => setTipoFiltro("todos")}
              style={{ background: tipoFiltro==="todos" ? C.gold : C.surface, color: tipoFiltro==="todos" ? "#0B3D2E" : C.dim, border:`1px solid ${tipoFiltro==="todos" ? C.gold : C.border}`, borderRadius:8, padding:"7px 16px", fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
              Todos
            </button>
            {tiposUnicos.map(t => (
              <button key={t.id_tipo_time} onClick={() => setTipoFiltro(t.descricao)}
                style={{ background: tipoFiltro===t.descricao ? C.gold : C.surface, color: tipoFiltro===t.descricao ? "#0B3D2E" : C.dim, border:`1px solid ${tipoFiltro===t.descricao ? C.gold : C.border}`, borderRadius:8, padding:"7px 16px", fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
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

        {timesDestaque.length > 0 && (
          <div style={{ marginBottom:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{ fontSize:13, fontWeight:800, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em" }}>⭐ Time em destaque</span>
              <div style={{ flex:1, height:1, background:`linear-gradient(to right, ${C.gold}55, transparent)` }} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:16 }}>
              {timesDestaque.map(t => <CardTime key={t.id_time} t={t} onSelect={onSelect} destaque />)}
            </div>
          </div>
        )}

        {timesDestaque.length > 0 && timesNormais.length > 0 && (
          <div style={{ fontSize:13, fontWeight:800, color:C.dim, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:16 }}>Todos os times</div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:16 }}>
          {timesNormais.map(t => <CardTime key={t.id_time} t={t} onSelect={onSelect} />)}
        </div>
      </main>

      {/* CTA cadastro — controlado por config_sistema */}
      {cadastroAtivo && (
        <div style={{ textAlign:"center", padding:"24px 16px 8px", borderTop:`1px solid ${C.border}`, marginTop:32 }}>
          <div style={{ fontSize:13, color:C.dim, marginBottom:12 }}>Quer ter seu time aqui?</div>
          <button onClick={() => setModalCadastro(true)}
            style={{ background:"none", border:`2px solid ${C.gold}`, borderRadius:10,
              color:C.gold, fontFamily:"inherit", fontWeight:800, fontSize:13,
              padding:"11px 28px", cursor:"pointer", textTransform:"uppercase", letterSpacing:"0.06em" }}>
            🏆 Cadastrar meu Time
          </button>
        </div>
      )}

      <footer style={{ textAlign:"center", padding:"24px 20px", color:C.dim, fontSize:12, borderTop:`1px solid ${C.border}`, marginTop:20 }}>
        <div style={{ marginBottom:8 }}>⚽ Nerd do Campo — Estatísticas de Futebol Amador</div>
        <div style={{ fontSize:11, color:C.gold, letterSpacing:"0.08em", opacity:0.85 }}>
          ⚽ Designed by Caxpa Augsten
        </div>
      </footer>

      {modalCadastro && <ModalSolicitacao onClose={() => setModalCadastro(false)}/>}
    </div>
  );
}

// ── VISÃO GERAL ───────────────────────────────────────────────
// Visão pública de uma TURMA FECHADA (aproveitamento dos times internos,
// artilharia, assistências, presença, eficiência, goleadas).
function VisaoGeralTurma({ temporada }) {
  const tid = temporada.id_temporada;
  const { data: aprov, loading: l1 } = useQuery(() => sb(`vw_turma_aproveitamento?id_temporada=eq.${tid}&select=*&order=aproveitamento.desc,gols_pro.desc`), [tid]);
  const { data: jogs, loading: l2 }  = useQuery(() => sb(`vw_turma_jogador?id_temporada=eq.${tid}&select=*`), [tid]);
  const { data: goleadas }           = useQuery(() => sb(`vw_turma_goleadas?id_temporada=eq.${tid}&select=*&order=diferenca.desc,total_gols.desc&limit=5`), [tid]);

  if (l1 || l2) return <Spinner />;

  const lista = (jogs || []);
  const artilheiros = [...lista].filter(j => (j.gols||0) > 0).sort((a,b) => b.gols - a.gols).slice(0, 10);
  const assistentes = [...lista].filter(j => (j.assistencias||0) > 0).sort((a,b) => b.assistencias - a.assistencias).slice(0, 10);
  const presenca    = [...lista].sort((a,b) => b.presencas - a.presencas).slice(0, 10);
  const eficiencia  = [...lista].filter(j => (j.presencas||0) >= 1 && (j.gols||0) > 0).sort((a,b) => (b.media_gols||0) - (a.media_gols||0)).slice(0, 10);
  const nomeJog = j => j.apelido || j.nome || "?";
  const medalha = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}`;

  const SecTitle = ({ children }) => (
    <div style={{ fontSize:13, fontWeight:800, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", margin:"22px 0 12px" }}>{children}</div>
  );
  const RankTable = ({ cols, rows }) => (
    <Card style={{ padding:0, overflow:"hidden" }}>
      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead><tr style={{ background:C.surf2 }}>{cols.map((c,i) => <th key={i} style={{ padding:"8px 10px", textAlign: i===0?"center":"left", fontSize:10, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{c}</th>)}</tr></thead>
        <tbody>{rows}</tbody>
      </table></div>
    </Card>
  );

  if (lista.length === 0 && (aprov||[]).length === 0) {
    return <Card><div style={{ padding:24, textAlign:"center", color:C.dim }}>Ainda não há encontros registrados nesta temporada.</div></Card>;
  }

  return (
    <div>
      {/* Aproveitamento dos times internos */}
      <SecTitle>🏆 Aproveitamento dos times internos</SecTitle>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Time","J","V","E","D","Gols","Aprov."].map((h,i) => <th key={i} style={{ padding:"8px 10px", textAlign:i===0?"left":"center", fontSize:10, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(aprov||[]).map(t => (
              <tr key={t.id_time_interno} style={{ borderBottom:`1px solid ${C.border}` }}>
                <td style={{ padding:"9px 10px", fontWeight:700 }}>
                  <span style={{ display:"inline-block", width:12, height:12, borderRadius:"50%", background:t.cor||C.dim, marginRight:8, verticalAlign:"middle", border:`1px solid ${C.border}` }} />{t.nome}
                </td>
                <td style={{ padding:"9px 10px", textAlign:"center" }}>{t.jogos}</td>
                <td style={{ padding:"9px 10px", textAlign:"center", color:C.win }}>{t.vitorias}</td>
                <td style={{ padding:"9px 10px", textAlign:"center" }}>{t.empates}</td>
                <td style={{ padding:"9px 10px", textAlign:"center", color:C.loss }}>{t.derrotas}</td>
                <td style={{ padding:"9px 10px", textAlign:"center", color:C.dim }}>{t.gols_pro}:{t.gols_contra}</td>
                <td style={{ padding:"9px 10px", textAlign:"center", fontWeight:800, color:C.gold }}>{t.aproveitamento}%</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>

      {/* Artilheiros */}
      {artilheiros.length > 0 && (<>
        <SecTitle>⚽ Artilheiros</SecTitle>
        <RankTable cols={["#","Jogador","Gols","Presenças"]} rows={artilheiros.map((j,i) => (
          <tr key={j.id_jogador} style={{ borderBottom:`1px solid ${C.border}` }}>
            <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:800, color:C.gold }}>{medalha(i)}</td>
            <td style={{ padding:"8px 10px", fontWeight:700 }}>{nomeJog(j)}</td>
            <td style={{ padding:"8px 10px" }}>{j.gols}</td>
            <td style={{ padding:"8px 10px", color:C.dim }}>{j.presencas}</td>
          </tr>
        ))} />
      </>)}

      {/* Assistências */}
      {assistentes.length > 0 && (<>
        <SecTitle>🅰️ Assistências</SecTitle>
        <RankTable cols={["#","Jogador","Assist.","Presenças"]} rows={assistentes.map((j,i) => (
          <tr key={j.id_jogador} style={{ borderBottom:`1px solid ${C.border}` }}>
            <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:800, color:C.gold }}>{medalha(i)}</td>
            <td style={{ padding:"8px 10px", fontWeight:700 }}>{nomeJog(j)}</td>
            <td style={{ padding:"8px 10px" }}>{j.assistencias}</td>
            <td style={{ padding:"8px 10px", color:C.dim }}>{j.presencas}</td>
          </tr>
        ))} />
      </>)}

      {/* Presença */}
      {presenca.length > 0 && (<>
        <SecTitle>📅 Ranking de presença</SecTitle>
        <RankTable cols={["#","Jogador","Presenças"]} rows={presenca.map((j,i) => (
          <tr key={j.id_jogador} style={{ borderBottom:`1px solid ${C.border}` }}>
            <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:800, color:C.gold }}>{medalha(i)}</td>
            <td style={{ padding:"8px 10px", fontWeight:700 }}>{nomeJog(j)}</td>
            <td style={{ padding:"8px 10px" }}>{j.presencas}</td>
          </tr>
        ))} />
      </>)}

      {/* Eficiência */}
      {eficiencia.length > 0 && (<>
        <SecTitle>🎯 Média de gols por presença</SecTitle>
        <RankTable cols={["#","Jogador","Gols","Pres.","Média"]} rows={eficiencia.map((j,i) => (
          <tr key={j.id_jogador} style={{ borderBottom:`1px solid ${C.border}` }}>
            <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:800, color:C.gold }}>{medalha(i)}</td>
            <td style={{ padding:"8px 10px", fontWeight:700 }}>{nomeJog(j)}</td>
            <td style={{ padding:"8px 10px" }}>{j.gols}</td>
            <td style={{ padding:"8px 10px", color:C.dim }}>{j.presencas}</td>
            <td style={{ padding:"8px 10px", fontWeight:800, color:C.gold }}>{j.media_gols}</td>
          </tr>
        ))} />
      </>)}

      {/* Goleadas */}
      {(goleadas||[]).length > 0 && (<>
        <SecTitle>💥 Placares marcantes</SecTitle>
        <Card>
          {(goleadas||[]).map(g => (
            <div key={g.id_encontro_jogo} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
              <span style={{ display:"inline-block", width:11, height:11, borderRadius:"50%", background:g.cor_a||C.dim }} />
              <span>{g.nome_a}</span>
              <span style={{ fontWeight:800, color:C.gold }}>{g.placar_a} × {g.placar_b}</span>
              <span>{g.nome_b}</span>
              <span style={{ display:"inline-block", width:11, height:11, borderRadius:"50%", background:g.cor_b||C.dim }} />
              <span style={{ marginLeft:"auto", fontSize:11, color:C.dim }}>{g.data ? new Date(g.data).toLocaleDateString("pt-BR") : ""}</span>
            </div>
          ))}
        </Card>
      </>)}
    </div>
  );
}

function VisaoGeral({ temporada }) {
  // Detecta se o time desta temporada é turma fechada → delega para a visão própria.
  const { data: _tdt } = useQuery(
    () => temporada?.id_time ? sb(`time?id_time=eq.${temporada.id_time}&select=id_tipo_time&limit=1`) : Promise.resolve([]),
    [temporada?.id_time]
  );
  const _idTipo = _tdt?.[0]?.id_tipo_time;
  const { data: _tt } = useQuery(
    () => _idTipo ? sb(`tipo_time?id_tipo_time=eq.${_idTipo}&select=eh_turma_fechada&limit=1`) : Promise.resolve([]),
    [_idTipo]
  );
  const ehTurma = !!_tt?.[0]?.eh_turma_fechada;

  const { data: partidas, loading } = useQuery(
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo:id_campo(nome)&order=data.asc`),
    [temporada.id_temporada]
  );
  const { data: topGols }   = useQuery(() => sb(`vw_stats_temporada?id_temporada=eq.${temporada.id_temporada}&select=*&order=gols_marcados.desc&limit=5`), [temporada.id_temporada]);
  const { data: topAssist } = useQuery(() => sb(`vw_stats_temporada?id_temporada=eq.${temporada.id_temporada}&select=*&order=assistencias.desc&limit=5`), [temporada.id_temporada]);

  if (ehTurma) return <VisaoGeralTurma temporada={temporada} />;
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
                style={{ width:88, height:88, borderRadius:"50%", objectFit:"cover", border:`3px solid ${C.gold}` }}/>
            )}
            {uniformes.length > 0 && (
              <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                {uniformes.map(u => (
                  <div key={u.label} style={{ textAlign:"center" }}>
                    <img src={u.url} alt={u.label}
                      style={{ width:110, height:110, objectFit:"contain", borderRadius:8, background:C.surf2, border:`1px solid ${C.border}`, display:"block", marginBottom:6 }}/>
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
            <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{ultima.adversario?.nome || "A definir"}</div>
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
    () => sb(`gol?select=*,participacao!inner(id_jogador,jogador(nome,apelido,camisa))&participacao.id_partida=eq.${partida.id_partida}&participacao.id_jogador=gt.0&order=periodo.asc,minuto.asc`),
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
        <div style={{ fontSize:24, fontWeight:800, textTransform:"uppercase", marginBottom:12 }}>{partida.adversario?.nome || "🔍 Procurando adversário"}</div>
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
                const res = resultado(p);
                const procurando = !p.id_adversario && p.cancelada !== "S";
                const bgBase = procurando ? "rgba(232,160,32,0.12)" : (i%2===0?C.surface:C.bg);
                return (
                  <tr key={p.id_partida}
                    onClick={() => { if (p.gols_marcados !== null && p.cancelada !== "S") setPartidaSel(p); }}
                    style={{ background:bgBase, cursor: p.gols_marcados !== null && p.cancelada !== "S" ? "pointer" : "default", borderLeft: procurando ? `3px solid ${C.gold}` : "3px solid transparent" }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=C.surf2; }}
                    onMouseLeave={e=>e.currentTarget.style.background=bgBase}>
                    <td style={{ padding:"12px 14px", fontWeight:600, whiteSpace:"nowrap" }}>{fmtData(p.data)}</td>
                    <td style={{ padding:"12px 14px", color:C.dim }}>{fmtHora(p.data)}</td>
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
    () => sb(`jogador?id_jogador=gt.0&id_time=eq.${time.id_time}&select=*,posicao(nome,ordem)&order=camisa.asc`),
    [time.id_time]
  );
  if (loading) return <Spinner />;
  const ativos = (jogadores||[]).filter(j => !j.data_fim);
  // Agrupa por posição, ordenando os grupos pela coluna 'ordem' da posição
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
            return <option key={p.id_partida} value={p.id_partida}>{fmtData(p.data)} — {p.adversario?.nome || "A definir"} ({qtd} gol{qtd!==1?"s":""})</option>;
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
          <select
            value={temporadaSel?.id_temporada || ""}
            onChange={e => { const t = (temporadas||[]).find(x => String(x.id_temporada) === e.target.value); if (t) setTemporadaSel(t); }}
            style={{ flexShrink:0, maxWidth:170, background:C.gold, color:"#0B3D2E", border:`1px solid ${C.gold}`,
              borderRadius:8, padding:"6px 10px", fontFamily:"inherit", fontWeight:800, fontSize:12,
              cursor:"pointer", textTransform:"uppercase", outline:"none" }}>
            {(temporadas||[]).map(t => (
              <option key={t.id_temporada} value={t.id_temporada}>{t.nome}</option>
            ))}
          </select>
        )}
      </header>

      {/* Conteúdo */}
      <main style={{ maxWidth:1200, margin:"0 auto", padding:"12px 10px 20px" }}>
        {screens[tab]}
        {/* Assinatura */}
        <div style={{ textAlign:"center", padding:"24px 12px 8px", marginTop:16, borderTop:`1px solid ${C.border}` }}>
          <div style={{ fontSize:11, color:C.gold, letterSpacing:"0.08em", opacity:0.85 }}>
            ⚽ Designed by Caxpa Augsten
          </div>
        </div>
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


// ══════════════════════════════════════════════════════════════
// MODAL DE SOLICITAÇÃO DE CADASTRO
// ══════════════════════════════════════════════════════════════
const UFS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function ModalSolicitacao({ onClose }) {
  const [form, setForm] = useState({
    nome_time:"", id_tipo_time:"", id_subtipo:"", data_fundacao:"", cidade:"", id_cidade:"",
    nome_responsavel:"", email_responsavel:"", telefone:"",
  });
  const [uf, setUf] = useState("RS"); // RS é o padrão (público inicial)
  const [modoJogo, setModoJogo] = useState(null); // null | "enfrenta" | "entre_si" — define como o time joga
  const [step, setStep]     = useState(1); // 1=dados, 2=confirmação
  const [saving, setSaving] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro]     = useState("");
  const { data: tipos } = useQuery(() => sb(`tipo_time?select=*&status=eq.Ativo&order=descricao.asc`));
  // Cidades da UF selecionada (dropdown encadeado)
  const { data: cidadesUf } = useQuery(() => uf ? sb(`cidade?estado=eq.${uf}&select=id_cidade,nome,estado&order=nome.asc`) : Promise.resolve([]), [uf]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function validar() {
    if (!form.nome_time.trim())          return "Nome do time é obrigatório.";
    if (!form.nome_responsavel.trim())   return "Nome do responsável é obrigatório.";
    if (!form.email_responsavel.trim())  return "E-mail é obrigatório.";
    if (!/\S+@\S+\.\S+/.test(form.email_responsavel)) return "E-mail inválido.";
    if (!form.telefone.trim())           return "Telefone é obrigatório.";
    {
      if (!modoJogo) return "Escolha como seu time joga.";
      if (!form.id_tipo_time) return "Escolha a modalidade.";
      const tipoSel = (tipos||[]).find(t => String(t.id_tipo_time) === String(form.id_tipo_time));
      if (tipoSel?.eh_turma_fechada && !form.id_subtipo) return "Escolha a modalidade da turma (futsal, society, etc.).";
    }
    return "";
  }

  async function enviar() {
    const err = validar();
    if (err) { setErro(err); return; }
    setSaving(true); setErro("");
    try {
      const cidadeSel = (cidadesUf || []).find(c => String(c.id_cidade) === String(form.id_cidade));
      const cidadeTexto = cidadeSel ? `${cidadeSel.nome} - ${cidadeSel.estado}` : null;
      const body = {
        nome_time:          form.nome_time.trim(),
        id_tipo_time:       form.id_tipo_time ? Number(form.id_tipo_time) : null,
        id_subtipo:         form.id_subtipo ? Number(form.id_subtipo) : null,
        data_fundacao:      form.data_fundacao || null,
        cidade:             cidadeTexto,
        id_cidade:          form.id_cidade ? Number(form.id_cidade) : null,
        nome_responsavel:   form.nome_responsavel.trim(),
        email_responsavel:  form.email_responsavel.trim().toLowerCase(),
        telefone:           form.telefone.trim(),
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitacao_time`, {
        method:"POST",
        headers:{ apikey:SUPABASE_KEY, "Content-Type":"application/json", Prefer:"return=minimal" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao enviar solicitação.");
      setEnviado(true);
    } catch(e) { setErro(e.message); }
    finally { setSaving(false); }
  }

  if (enviado) return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.surface, borderRadius:16, padding:40, maxWidth:400, width:"100%", textAlign:"center", border:`1px solid ${C.border}` }}>
        <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:20, fontWeight:800, color:C.cream, marginBottom:12 }}>Solicitação enviada!</div>
        <div style={{ fontSize:13, color:C.dim, lineHeight:1.7, marginBottom:24 }}>
          Recebemos os dados do <b style={{ color:C.cream }}>{form.nome_time}</b>.
          Nossa equipe irá analisar e entrar em contato pelo e-mail <b style={{ color:C.gold }}>{form.email_responsavel}</b> em breve.
        </div>
        <button onClick={onClose}
          style={{ background:C.gold, color:"#0B3D2E", border:"none", borderRadius:10, padding:"12px 32px", fontFamily:"inherit", fontWeight:800, fontSize:14, cursor:"pointer", textTransform:"uppercase" }}>
          Fechar
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <div style={{ background:C.surface, borderRadius:16, padding:28, maxWidth:520, width:"100%", border:`1px solid ${C.border}`, margin:"auto" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:C.cream, textTransform:"uppercase", letterSpacing:"0.06em" }}>🏆 Cadastrar meu Time</div>
            <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>Passo {step} de 2</div>
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", fontSize:22, lineHeight:1 }}>✕</button>
        </div>

        {/* Progress */}
        <div style={{ display:"flex", gap:6, marginBottom:24 }}>
          {[1,2].map(s => (
            <div key={s} style={{ flex:1, height:4, borderRadius:2,
              background: step >= s ? C.gold : C.surf2, transition:"background 0.3s" }}/>
          ))}
        </div>

        {step === 1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.08em", borderLeft:`3px solid ${C.gold}`, paddingLeft:8 }}>Dados do Time</div>

            <div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Nome do Time *</div>
              <input value={form.nome_time} onChange={e => set("nome_time", e.target.value)}
                placeholder="Ex: Nerd do Campo FC"
                style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px", boxSizing:"border-box", outline:"none" }}/>
            </div>

            {/* Passo 1: como o time joga — traduz tipo vs turma fechada numa pergunta simples */}
            <div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:6 }}>Como seu time joga?</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {(() => {
                  const tipoTurma = (tipos||[]).find(t => t.eh_turma_fechada);
                  const opcoes = [
                    { id:"enfrenta", titulo:"Enfrentamos outros times", desc:"Jogos contra adversários (campeonato, amistosos)", emoji:"🆚" },
                    { id:"entre_si", titulo:"Jogamos entre nós", desc:"Racha / pelada / turma fechada — o grupo joga entre si", emoji:"🤝" },
                  ];
                  return opcoes.map(op => {
                    const ativo = modoJogo === op.id;
                    const desabilitado = op.id === "entre_si" && !tipoTurma;
                    return (
                      <button key={op.id} type="button" disabled={desabilitado}
                        onClick={() => {
                          setModoJogo(op.id);
                          if (op.id === "entre_si") { set("id_tipo_time", String(tipoTurma.id_tipo_time)); set("id_subtipo", ""); }
                          else { set("id_tipo_time", ""); set("id_subtipo", ""); }
                        }}
                        style={{
                          textAlign:"left", background: ativo ? C.gold : C.surf2,
                          color: ativo ? "#0B3D2E" : (desabilitado ? C.border : C.cream),
                          border:`1px solid ${ativo ? C.gold : C.border}`, borderRadius:10, padding:"12px 14px",
                          fontFamily:"inherit", cursor: desabilitado ? "not-allowed" : "pointer", opacity: desabilitado ? 0.5 : 1,
                        }}>
                        <div style={{ fontSize:20, marginBottom:4 }}>{op.emoji}</div>
                        <div style={{ fontSize:13.5, fontWeight:800, marginBottom:2 }}>{op.titulo}</div>
                        <div style={{ fontSize:11, color: ativo ? "#0B3D2E" : C.dim, lineHeight:1.3 }}>{op.desc}</div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Passo 2a: enfrenta outros → escolhe o tipo (sem turma fechada na lista) */}
            {modoJogo === "enfrenta" && (
              <div>
                <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Modalidade</div>
                <select value={form.id_tipo_time} onChange={e => { set("id_tipo_time", e.target.value); set("id_subtipo", ""); }}
                  style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px" }}>
                  <option value="">Selecione...</option>
                  {(tipos||[]).filter(t => !t.eh_turma_fechada).map(t => <option key={t.id_tipo_time} value={t.id_tipo_time}>{t.descricao}</option>)}
                </select>
              </div>
            )}

            {/* Passo 2b: joga entre si → escolhe só a modalidade (subtipo) */}
            {modoJogo === "entre_si" && (
              <div>
                <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Qual a modalidade da turma?</div>
                <select value={form.id_subtipo||""} onChange={e => set("id_subtipo", e.target.value)}
                  style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px" }}>
                  <option value="">Selecione a modalidade...</option>
                  {(tipos||[]).filter(t => !t.eh_turma_fechada).map(t => <option key={t.id_tipo_time} value={t.id_tipo_time}>{t.descricao}</option>)}
                </select>
                <div style={{ fontSize:11, color:C.dim, marginTop:4 }}>Ex: futsal, society — define titulares e posições que sua turma vai usar.</div>
              </div>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"110px 1fr", gap:12 }}>
              <div>
                <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Estado</div>
                <select value={uf} onChange={e => { setUf(e.target.value); set("id_cidade", ""); }}
                  style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px", boxSizing:"border-box", outline:"none" }}>
                  {UFS_BR.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Cidade</div>
                <select value={form.id_cidade} onChange={e => set("id_cidade", e.target.value)}
                  style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px", boxSizing:"border-box", outline:"none" }}>
                  <option value="">{cidadesUf === null ? "Carregando..." : "Selecione a cidade..."}</option>
                  {(cidadesUf || []).map(c => <option key={c.id_cidade} value={c.id_cidade}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Data de Fundação</div>
              <input type="date" value={form.data_fundacao} onChange={e => set("data_fundacao", e.target.value)}
                style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px", boxSizing:"border-box", outline:"none" }}/>
            </div>

            <button onClick={() => setStep(2)}
              disabled={!form.nome_time.trim()}
              style={{ background: form.nome_time.trim() ? C.gold : C.surf2,
                color: form.nome_time.trim() ? "#0B3D2E" : C.dim,
                border:"none", borderRadius:10, padding:"13px", fontFamily:"inherit",
                fontWeight:800, fontSize:14, cursor: form.nome_time.trim() ? "pointer" : "not-allowed",
                textTransform:"uppercase", marginTop:4 }}>
              Próximo →
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.08em", borderLeft:`3px solid ${C.gold}`, paddingLeft:8 }}>Dados do Responsável</div>

            <div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Nome do Responsável *</div>
              <input value={form.nome_responsavel} onChange={e => set("nome_responsavel", e.target.value)}
                placeholder="Seu nome completo"
                style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px", boxSizing:"border-box", outline:"none" }}/>
            </div>

            <div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>E-mail *</div>
              <input type="email" value={form.email_responsavel} onChange={e => set("email_responsavel", e.target.value)}
                placeholder="seu@email.com"
                style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px", boxSizing:"border-box", outline:"none" }}/>
              <div style={{ fontSize:10, color:C.dim, marginTop:4 }}>Será o e-mail de acesso ao painel admin</div>
            </div>

            <div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Telefone / WhatsApp *</div>
              <input value={form.telefone} onChange={e => set("telefone", e.target.value)}
                placeholder="(51) 99999-9999"
                style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 12px", boxSizing:"border-box", outline:"none" }}/>
            </div>

            {/* Resumo */}
            <div style={{ background:C.surf2, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:8 }}>📋 Resumo da solicitação</div>
              <div style={{ fontSize:12, color:C.dim, lineHeight:1.8 }}>
                <b style={{ color:C.cream }}>Time:</b> {form.nome_time}<br/>
                {form.id_cidade && (() => { const c = (cidadesUf||[]).find(x => String(x.id_cidade) === String(form.id_cidade)); return c ? <><b style={{ color:C.cream }}>Cidade:</b> {c.nome} - {c.estado}<br/></> : null; })()}
                {form.id_tipo_time && (tipos||[]).find(t=>String(t.id_tipo_time)===String(form.id_tipo_time)) && (
                  <><b style={{ color:C.cream }}>Tipo:</b> {(tipos||[]).find(t=>String(t.id_tipo_time)===String(form.id_tipo_time))?.descricao}<br/></>
                )}
              </div>
            </div>

            {erro && <div style={{ background:C.loss+"22", border:`1px solid ${C.loss}44`, borderRadius:8, padding:"10px 14px", fontSize:12, color:C.loss }}>{erro}</div>}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setStep(1)}
                style={{ flex:1, background:C.surf2, color:C.dim, border:`1px solid ${C.border}`,
                  borderRadius:10, padding:"13px", fontFamily:"inherit", fontWeight:700,
                  fontSize:13, cursor:"pointer", textTransform:"uppercase" }}>
                ← Voltar
              </button>
              <button onClick={enviar} disabled={saving}
                style={{ flex:2, background: saving ? C.surf2 : C.gold,
                  color: saving ? C.dim : "#0B3D2E", border:"none",
                  borderRadius:10, padding:"13px", fontFamily:"inherit",
                  fontWeight:800, fontSize:14, cursor: saving ? "not-allowed" : "pointer",
                  textTransform:"uppercase" }}>
                {saving ? "Enviando..." : "✅ Enviar Solicitação"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [timeSel, setTimeSel] = useState(null);
  const { data: manut, loading: loadManut } = useQuery(() =>
    sb(`config_sistema?chave=eq.sistema_manutencao&select=valor&limit=1`)
  );

  if (loadManut) return null;
  if (["true","1"].includes(String(manut?.[0]?.valor ?? "").trim().toLowerCase())) return <TelaManutencao/>;

  if (timeSel) return <TimeApp time={timeSel} onVoltar={() => setTimeSel(null)} />;
  return <SeletorTimes onSelect={setTimeSel} />;
}

// ── Tela de Manutenção ────────────────────────────────────────
function TelaManutencao() {
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
