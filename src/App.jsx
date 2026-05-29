import { useState, useEffect, useCallback } from "react";

// ── Supabase ──────────────────────────────────────────────────
const SUPABASE_URL = "https://nxztffulmvohduvudbhg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Paleta ────────────────────────────────────────────────────
const C = {
  bg:      "#0B3D2E",
  surface: "#103D2A",
  surf2:   "#174D36",
  border:  "#1F5C3E",
  gold:    "#E8A020",
  cream:   "#F0E8D0",
  dim:     "#8FAF9A",
  win:     "#4CAF50",
  draw:    "#E8A020",
  loss:    "#E53935",
};

// ── Logo ──────────────────────────────────────────────────────
function Logo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect x="18" y="14" width="58" height="62" rx="5" fill="#174D36" stroke="#F0E8D0" strokeWidth="2"/>
      <rect x="38" y="8" width="24" height="12" rx="3" fill="#E8A020"/>
      <circle cx="50" cy="14" r="4" fill="#0B3D2E"/>
      <rect x="26" y="30" width="36" height="38" rx="1" stroke="#F0E8D0" strokeWidth="1.5" fill="none"/>
      <line x1="44" y1="30" x2="44" y2="68" stroke="#F0E8D0" strokeWidth="1"/>
      <line x1="26" y1="49" x2="62" y2="49" stroke="#F0E8D0" strokeWidth="1"/>
      <rect x="35" y="56" width="10" height="10" stroke="#F0E8D0" strokeWidth="1" fill="none"/>
      <circle cx="70" cy="65" r="18" fill="#1A1A1A"/>
      <circle cx="63" cy="62" r="5" fill="#F0E8D0"/>
      <circle cx="77" cy="62" r="5" fill="#F0E8D0"/>
      <rect x="59" y="58" width="22" height="4" rx="2" fill="#1A1A1A"/>
      <line x1="65" y1="61" x2="75" y2="61" stroke="#555" strokeWidth="1.5"/>
    </svg>
  );
}

// ── Atoms ─────────────────────────────────────────────────────
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
  return (
    <span style={{ background: cor + "22", color: cor, border: `1px solid ${cor}55`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 80, flexDirection: "column", gap: 16 }}>
      <div style={{ width: 44, height: 44, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: C.dim, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em" }}>Carregando...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrMsg({ msg }) {
  return (
    <Card style={{ border: `1px solid ${C.loss}44`, textAlign: "center", padding: 48 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: C.loss, fontWeight: 700, marginBottom: 8, fontSize: 16 }}>Erro ao carregar dados</div>
      <div style={{ color: C.dim, fontSize: 13, maxWidth: 400, margin: "0 auto" }}>{msg}</div>
    </Card>
  );
}

// ── Hook ──────────────────────────────────────────────────────
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
  return { data, loading, error };
}

// ── Helpers ───────────────────────────────────────────────────
function resultado(p) {
  if (p.cancelada === "S")        return { label: "Cancelado", cor: C.dim };
  if (p.gols_marcados === null)   return { label: "Pendente",  cor: C.dim };
  if (p.gols_marcados > p.gols_sofridos) return { label: "Vitória", cor: C.win };
  if (p.gols_marcados < p.gols_sofridos) return { label: "Derrota", cor: C.loss };
  return { label: "Empate", cor: C.draw };
}

function fmtData(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pt-BR");
}

function fmtHora(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Tabela genérica ───────────────────────────────────────────
function Tabela({ cols, rows, keyFn }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: C.surf2 }}>
            {cols.map(c => (
              <th key={c.label} style={{ padding: "12px 14px", textAlign: c.align || "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dim, fontWeight: 700, whiteSpace: "nowrap" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyFn ? keyFn(row) : i}
              style={{ background: i % 2 === 0 ? C.surface : C.bg, cursor: "default" }}
              onMouseEnter={e => e.currentTarget.style.background = C.surf2}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.surface : C.bg}>
              {cols.map(c => (
                <td key={c.label} style={{ padding: "12px 14px", textAlign: c.align || "left", ...(c.style || {}) }}>
                  {c.render ? c.render(row) : row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── VISÃO GERAL ───────────────────────────────────────────────
function VisaoGeral({ temporada }) {
  const { data: partidas, loading, error } = useQuery(
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo(nome)&order=data.asc`),
    [temporada.id_temporada]
  );
  const { data: topGols }   = useQuery(() => sb(`vw_estatisticas_jogadores?gols_marcados=not.is.null&order=gols_marcados.desc&limit=5`), []);
  const { data: topAssist } = useQuery(() => sb(`vw_estatisticas_jogadores?assistencias=not.is.null&order=assistencias.desc&limit=5`), []);

  if (loading) return <Spinner />;
  if (error)   return <ErrMsg msg={error} />;

  const jogadas = (partidas || []).filter(p => p.cancelada !== "S" && p.gols_marcados !== null);
  const v  = jogadas.filter(p => p.gols_marcados > p.gols_sofridos).length;
  const e  = jogadas.filter(p => p.gols_marcados === p.gols_sofridos).length;
  const d  = jogadas.filter(p => p.gols_marcados < p.gols_sofridos).length;
  const gm = jogadas.reduce((a, p) => a + (p.gols_marcados || 0), 0);
  const gs = jogadas.reduce((a, p) => a + (p.gols_sofridos || 0), 0);
  const pts = v * 3 + e;
  const pct = jogadas.length > 0 ? Math.round((v / jogadas.length) * 100) : 0;
  const ultima  = [...jogadas].reverse()[0];
  const proxima = (partidas || []).find(p => p.cancelada !== "S" && p.gols_marcados === null);

  const StatCard = ({ label, value, cor }) => (
    <Card style={{ textAlign: "center", padding: "18px 10px" }}>
      <div style={{ fontSize: 36, fontWeight: 800, color: cor || C.gold, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
    </Card>
  );

  const RankList = ({ items, valKey, cor, emptyMsg }) => {
    const max = items?.[0]?.[valKey] || 1;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(items || []).length === 0 && <div style={{ color: C.dim, fontSize: 13 }}>{emptyMsg}</div>}
        {(items || []).map((j, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: cor, fontWeight: 800, width: 18, textAlign: "center" }}>{i + 1}</span>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.surf2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: cor, fontSize: 13 }}>{j.camisa || "?"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{j.jogador}</div>
              <div style={{ fontSize: 11, color: C.dim }}>{j.posicao}</div>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: cor }}>{j[valKey]}</span>
            <div style={{ width: 60, height: 5, background: C.surf2, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(j[valKey] / max) * 100}%`, height: "100%", background: cor, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Jogos"    value={jogadas.length} />
        <StatCard label="Vitórias" value={v}   cor={C.win} />
        <StatCard label="Empates"  value={e}   cor={C.draw} />
        <StatCard label="Derrotas" value={d}   cor={C.loss} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Pontos"       value={pts} cor={C.gold} />
        <StatCard label="Gols Pró"     value={gm} />
        <StatCard label="Gols Contra"  value={gs}  cor={C.dim} />
        <StatCard label="Aproveit."    value={`${pct}%`} cor={pct >= 60 ? C.win : pct >= 40 ? C.draw : C.loss} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <SecTitle accent>Último Jogo</SecTitle>
          {ultima ? (<>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>{fmtData(ultima.data)} · {ultima.em_casa === "S" ? "Em Casa" : "Fora"}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{ultima.adversario?.nome}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: C.gold }}>{ultima.gols_marcados} × {ultima.gols_sofridos}</span>
              <Badge {...resultado(ultima)} />
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>🏟️ {ultima.campo?.nome}</div>
          </>) : <div style={{ color: C.dim }}>Nenhum jogo realizado ainda</div>}
        </Card>
        <Card>
          <SecTitle accent>Próximo Jogo</SecTitle>
          {proxima ? (<>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>{fmtData(proxima.data)} · {fmtHora(proxima.data)} · {proxima.em_casa === "S" ? "Em Casa" : "Fora"}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{proxima.adversario?.nome || "A definir"}</div>
            <div style={{ fontSize: 12, color: C.dim }}>🏟️ {proxima.campo?.nome}</div>
            <div style={{ marginTop: 12, padding: "8px 14px", background: C.gold + "22", border: `1px solid ${C.gold}55`, borderRadius: 8, display: "inline-block" }}>
              <span style={{ color: C.gold, fontWeight: 700, fontSize: 13 }}>⏰ Aguardando</span>
            </div>
          </>) : <div style={{ color: C.dim }}>Sem jogos agendados</div>}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <SecTitle accent>⚽ Artilheiros</SecTitle>
          <RankList items={topGols} valKey="gols_marcados" cor={C.gold} emptyMsg="Sem dados" />
        </Card>
        <Card>
          <SecTitle accent>🅰️ Assistências</SecTitle>
          <RankList items={topAssist} valKey="assistencias" cor={C.win} emptyMsg="Sem dados" />
        </Card>
      </div>
    </div>
  );
}

// ── CALENDÁRIO ────────────────────────────────────────────────
function Calendario({ temporada }) {
  const [filtro, setFiltro] = useState("todos");
  const { data: partidas, loading, error } = useQuery(
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo(nome)&order=data.asc`),
    [temporada.id_temporada]
  );

  if (loading) return <Spinner />;
  if (error)   return <ErrMsg msg={error} />;

  const all      = partidas || [];
  const jogados  = all.filter(p => p.cancelada !== "S" && p.gols_marcados !== null);
  const pendentes = all.filter(p => p.cancelada !== "S" && p.gols_marcados === null);
  const lista = filtro === "jogados" ? jogados : filtro === "pendentes" ? pendentes : filtro === "casa" ? all.filter(p => p.em_casa === "S") : filtro === "fora" ? all.filter(p => p.em_casa === "N") : all;

  const cols = [
    { label: "Data",      render: p => fmtData(p.data) },
    { label: "Hora",      render: p => fmtHora(p.data), style: { color: C.dim } },
    { label: "Adversário",render: p => p.adversario?.nome || "A definir", style: { fontWeight: 700 } },
    { label: "Local",     render: p => (
      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700, background: p.em_casa === "S" ? C.gold + "22" : C.surf2, color: p.em_casa === "S" ? C.gold : C.dim }}>
        {p.em_casa === "S" ? "🏠 Casa" : "✈️ Fora"}
      </span>
    )},
    { label: "Campo",     render: p => p.campo?.nome, style: { color: C.dim, fontSize: 12 } },
    { label: "Placar",    render: p => p.cancelada === "S" ? "—" : p.gols_marcados !== null ? `${p.gols_marcados} × ${p.gols_sofridos}` : "— × —", style: { fontWeight: 800, fontSize: 16 } },
    { label: "Resultado", render: p => <Badge {...resultado(p)} /> },
    { label: "Obs",       render: p => p.observacoes, style: { color: C.dim, fontSize: 12 } },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[["todos", `Todos (${all.length})`], ["jogados", `Jogados (${jogados.length})`], ["pendentes", `Pendentes (${pendentes.length})`], ["casa", "Em Casa"], ["fora", "Fora"]].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} style={{ background: filtro === v ? C.gold : C.surf2, color: filtro === v ? "#0B3D2E" : C.dim, border: "none", padding: "6px 14px", borderRadius: 8, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</button>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Tabela cols={cols} rows={lista} keyFn={p => p.id_partida} />
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.dim }}>{lista.length} partida{lista.length !== 1 ? "s" : ""} exibida{lista.length !== 1 ? "s" : ""}</div>
      </Card>
    </div>
  );
}

// ── ELENCO ────────────────────────────────────────────────────
function Elenco() {
  const { data: jogadores, loading, error } = useQuery(
    () => sb(`jogador?id_jogador=gt.0&select=*,posicao(nome)&order=camisa.asc`)
  );

  if (loading) return <Spinner />;
  if (error)   return <ErrMsg msg={error} />;

  const ativos = (jogadores || []).filter(j => !j.data_fim);
  const grupos = [...new Set(ativos.map(j => j.posicao?.nome).filter(Boolean))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ padding: "14px 20px", flex: "none" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.gold }}>{ativos.length}</div>
          <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase" }}>Jogadores ativos</div>
        </Card>
        <Card style={{ padding: "14px 20px", flex: "none" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.cream }}>{grupos.length}</div>
          <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase" }}>Posições</div>
        </Card>
      </div>

      {grupos.map(grupo => {
        const jogs = ativos.filter(j => j.posicao?.nome === grupo);
        return (
          <div key={grupo}>
            <div style={{ fontSize: 11, color: C.gold, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 10, borderLeft: `3px solid ${C.gold}`, paddingLeft: 10 }}>{grupo}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 10 }}>
              {jogs.map(j => (
                <Card key={j.id_jogador} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.surf2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.gold, fontSize: 18, flexShrink: 0 }}>
                    {j.camisa}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.apelido || j.nome}</div>
                    {j.apelido && <div style={{ fontSize: 11, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.nome}</div>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ESTATÍSTICAS ──────────────────────────────────────────────
function Estatisticas() {
  const [sortKey, setSortKey] = useState("gols_marcados");
  const [asc, setAsc]         = useState(false);

  const { data: stats, loading, error } = useQuery(() => sb(`vw_estatisticas_jogadores?select=*`));

  if (loading) return <Spinner />;
  if (error)   return <ErrMsg msg={error} />;

  const sorted = [...(stats || [])].sort((a, b) => {
    const va = a[sortKey] ?? 0; const vb = b[sortKey] ?? 0;
    if (typeof va === "string") return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return asc ? va - vb : vb - va;
  });

  const col = (label, key, extra = {}) => ({
    label, key, align: "center",
    style: key === sortKey ? { color: C.gold, fontWeight: 700 } : {},
    ...extra,
  });

  const COLS = [
    { label: "Camisa",  key: "camisa",           align: "center" },
    { label: "Jogador", key: "jogador",           align: "left", style: { fontWeight: 700 } },
    { label: "Posição", key: "posicao",           align: "left", style: { color: C.dim, fontSize: 13 } },
    col("PJ",      "total_partidas"),
    col("TIT",     "partidas_titular"),
    col("CAP",     "partidas_capitao"),
    { label: "Gols",    key: "gols_marcados",     align: "center", style: { color: C.gold, fontWeight: 800 } },
    col("Pen",     "gols_penalti"),
    { label: "Assist.", key: "assistencias",      align: "center", style: { color: C.win, fontWeight: 700 } },
    { label: "GC",      key: "gols_contra",       align: "center", style: { color: C.loss } },
  ];

  const handleSort = (key) => { if (sortKey === key) setAsc(!asc); else { setSortKey(key); setAsc(false); } };

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${C.border}` }}>
        <SecTitle accent>Estatísticas dos Jogadores</SecTitle>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: C.surf2 }}>
              {COLS.map(c => (
                <th key={c.label} onClick={() => handleSort(c.key)} style={{ padding: "12px 14px", textAlign: c.align || "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: sortKey === c.key ? C.gold : C.dim, fontWeight: 700, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                  {c.label} {sortKey === c.key ? (asc ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((j, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? C.surface : C.bg }}
                onMouseEnter={e => e.currentTarget.style.background = C.surf2}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? C.surface : C.bg}>
                {COLS.map(c => (
                  <td key={c.label} style={{ padding: "12px 14px", textAlign: c.align || "left", ...(c.style || {}) }}>
                    {j[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "12px 24px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.dim }}>
        PJ = Partidas Jogadas · TIT = Titular · CAP = Capitão · Pen = Pênaltis · GC = Gols Contra · Clique no cabeçalho para ordenar
      </div>
    </Card>
  );
}

// ── GOLS ──────────────────────────────────────────────────────
function Gols({ temporada }) {
  const [filtroPartida, setFiltroPartida] = useState("todos");

  const { data: gols, loading, error } = useQuery(
    () => sb(`vw_gols_partida?select=*&order=data_partida.asc,periodo.asc,minuto.asc`)
  );
  const { data: partidas } = useQuery(
    () => sb(`partida?id_temporada=eq.${temporada.id_temporada}&select=id_partida,data,adversario(nome)&cancelada=eq.N&gols_marcados=not.is.null&order=data.asc`),
    [temporada.id_temporada]
  );

  if (loading) return <Spinner />;
  if (error)   return <ErrMsg msg={error} />;

  const lista = filtroPartida === "todos" ? (gols || []) : (gols || []).filter(g => g.id_partida === Number(filtroPartida));

  const cols = [
    { label: "Data",       render: g => g.data_partida, style: { color: C.dim, fontSize: 13 } },
    { label: "Adversário", render: g => g.adversario, style: { fontWeight: 700 } },
    { label: "Jogador",    render: g => (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: C.gold, fontWeight: 700 }}>⚽ {g.jogador}</span>
        {g.penalti    === "Sim" && <Badge label="P"  cor={C.draw} />}
        {g.gol_contra === "Sim" && <Badge label="GC" cor={C.loss} />}
      </div>
    )},
    { label: "Período", key: "periodo", align: "center", render: g => `${g.periodo}°` },
    { label: "Minuto",  key: "minuto",  align: "center", render: g => `${g.minuto}'`, style: { fontWeight: 700 } },
    { label: "Pênalti",    align: "center", render: g => g.penalti    === "Sim" ? <Badge label="Sim" cor={C.draw} /> : <span style={{ color: C.dim, fontSize: 12 }}>Não</span> },
    { label: "Gol Contra", align: "center", render: g => g.gol_contra === "Sim" ? <Badge label="Sim" cor={C.loss} /> : <span style={{ color: C.dim, fontSize: 12 }}>Não</span> },
    { label: "Assistente", render: g => g.assistente ? <span style={{ color: C.win }}>🅰️ {g.assistente}</span> : "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em" }}>Filtrar:</span>
        <select value={filtroPartida} onChange={e => setFiltroPartida(e.target.value)} style={{ background: C.surf2, color: C.cream, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
          <option value="todos">Todos os jogos ({(gols || []).length} gols)</option>
          {(partidas || []).map(p => {
            const qtd = (gols || []).filter(g => g.id_partida === p.id_partida).length;
            return <option key={p.id_partida} value={p.id_partida}>{fmtData(p.data)} — {p.adversario?.nome} ({qtd} gol{qtd !== 1 ? "s" : ""})</option>;
          })}
        </select>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Tabela cols={cols} rows={lista} />
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.dim }}>
          {lista.length} gol{lista.length !== 1 ? "s" : ""} exibido{lista.length !== 1 ? "s" : ""}
        </div>
      </Card>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────
const TABS = [
  { label: "Visão Geral",   icon: "📊" },
  { label: "Calendário",    icon: "📅" },
  { label: "Elenco",        icon: "👕" },
  { label: "Estatísticas",  icon: "📈" },
  { label: "Gols",          icon: "⚽" },
];

export default function App() {
  const [tab, setTab]               = useState(0);
  const [temporadaSel, setTemporadaSel] = useState(null);

  const { data: times }     = useQuery(() => sb(`time?select=*&limit=1`));
  const { data: temporadas } = useQuery(() => sb(`temporada?select=*&order=data_inicio.desc`));

  useEffect(() => {
    if (temporadas?.length && !temporadaSel) setTemporadaSel(temporadas[0]);
  }, [temporadas]);

  const time = times?.[0];

  const screens = temporadaSel ? [
    <VisaoGeral   key="vg"    temporada={temporadaSel} />,
    <Calendario   key="cal"   temporada={temporadaSel} />,
    <Elenco       key="el" />,
    <Estatisticas key="st" />,
    <Gols         key="gols"  temporada={temporadaSel} />,
  ] : [<Spinner key="s" />];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", color: C.cream, letterSpacing: "0.02em" }}>
      {/* Header */}
      <header style={{ background: "#091F15", borderBottom: `3px solid ${C.gold}`, padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 68, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 24px #00000066" }}>
        <Logo size={42} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.cream, lineHeight: 1 }}>Nerd do Campo</div>
          <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {time?.nome || "Carregando..."} · {temporadaSel?.nome || ""}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {(temporadas || []).length > 1 && (
            <select value={temporadaSel?.id_temporada || ""} onChange={e => setTemporadaSel(temporadas.find(t => t.id_temporada === Number(e.target.value)))}
              style={{ background: C.surf2, color: C.cream, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
              {(temporadas || []).map(t => <option key={t.id_temporada} value={t.id_temporada}>{t.nome}</option>)}
            </select>
          )}
          <nav style={{ display: "flex", gap: 4 }}>
            {TABS.map((t, i) => (
              <button key={t.label} onClick={() => setTab(i)} style={{ background: tab === i ? C.gold : "transparent", color: tab === i ? "#0B3D2E" : C.dim, border: "none", padding: "7px 14px", borderRadius: 8, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Banner */}
      {time && temporadaSel && (
        <div style={{ background: "linear-gradient(135deg,#103D2A 0%,#174D36 50%,#1A5C40 100%)", borderBottom: `1px solid ${C.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: C.gold, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2 }}>
              {temporadaSel.nome}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase" }}>{time.nome}</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
              Técnico: <strong style={{ color: C.cream }}>{temporadaSel.tecnico || time.tecnico || "—"}</strong>
              {" · "}Presidente: <strong style={{ color: C.cream }}>{temporadaSel.presidente || time.presidente || "—"}</strong>
              {" · "}Campo: <strong style={{ color: C.cream }}>{time.id_campo ? "ASSOC ESP SAPIRANGA" : "—"}</strong>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        {screens[tab]}
      </main>

      <footer style={{ textAlign: "center", padding: "20px", color: C.dim, fontSize: 12, borderTop: `1px solid ${C.border}`, marginTop: 40 }}>
        ⚽ Nerd do Campo · Dados em tempo real via Supabase
      </footer>
    </div>
  );
}
