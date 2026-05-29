import { useState, useEffect, useCallback } from "react";

// ── Supabase ──────────────────────────────────────────────────
const URL  = "https://nxztffulmvohduvudbhg.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

let SESSION_TOKEN = null;

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

// ── Paleta ────────────────────────────────────────────────────
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
    if (res.access_token) { SESSION_TOKEN = res.access_token; onLogin(res); }
    else setErro("E-mail ou senha incorretos.");
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif" }}>
      <Card style={{ width: 380, padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.cream, textTransform: "uppercase", letterSpacing: "0.08em" }}>⚽ Nerd do Campo</div>
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
function ListaPartidas({ temporada, onSelect, onNova }) {
  const { data: partidas, loading, reload } = useQuery(
    () => api.get(`partida?id_temporada=eq.${temporada.id_temporada}&select=*,adversario(nome),campo(nome)&order=data.asc`),
    [temporada.id_temporada]
  );

  const [filtro, setFiltro] = useState("pendentes");
  const all      = partidas || [];
  const pendentes = all.filter(p => p.cancelada !== "S" && p.gols_marcados === null);
  const jogados   = all.filter(p => p.cancelada !== "S" && p.gols_marcados !== null);
  const lista = filtro === "pendentes" ? pendentes : filtro === "jogados" ? jogados : all;

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["pendentes", `Pendentes (${pendentes.length})`], ["jogados", `Jogados (${jogados.length})`], ["todos", `Todos (${all.length})`]].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{ background: filtro === v ? C.gold : C.surf2, color: filtro === v ? "#0B3D2E" : C.dim, border: "none", padding: "6px 14px", borderRadius: 8, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}>{l}</button>
          ))}
        </div>
        <Btn onClick={onNova}>+ Nova Partida</Btn>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map(p => {
          const res = resultado(p);
          const pendente = p.gols_marcados === null && p.cancelada !== "S";
          return (
            <Card key={p.id_partida} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "background 0.15s" }}
              onClick={() => onSelect(p)}
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
            </Card>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: C.dim, padding: 40 }}>Nenhuma partida encontrada</div>}
      </div>
    </div>
  );
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
function AdminApp() {
  const [session, setSession]         = useState(null);
  const [partida, setPartida]         = useState(null);
  const [novaPartida, setNovaPartida] = useState(false);

  const { data: times }      = useQuery(() => api.get(`time?select=*&limit=1`), [session]);
  const { data: temporadas } = useQuery(() => api.get(`temporada?select=*&order=data_inicio.desc`), [session]);
  const [temporadaSel, setTemporadaSel] = useState(null);

  useEffect(() => { if (temporadas?.length && !temporadaSel) setTemporadaSel(temporadas[0]); }, [temporadas]);

  if (!session) return <Login onLogin={setSession} />;

  const time = times?.[0];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Oswald','Arial Narrow',Arial,sans-serif", color: C.cream }}>
      {/* Header */}
      <header style={{ background: "#091F15", borderBottom: `3px solid ${C.gold}`, padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 64, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 20px #00000066" }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.cream }}>⚽ Nerd do Campo</div>
        <div style={{ fontSize: 11, color: C.gold, textTransform: "uppercase", letterSpacing: "0.1em" }}>Admin</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {(temporadas || []).length > 1 && (
            <select value={temporadaSel?.id_temporada || ""} onChange={e => setTemporadaSel(temporadas.find(t => t.id_temporada === Number(e.target.value)))}
              style={{ background: C.surf2, color: C.cream, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontFamily: "inherit", fontSize: 12 }}>
              {(temporadas || []).map(t => <option key={t.id_temporada} value={t.id_temporada}>{t.nome}</option>)}
            </select>
          )}
          {partida && <Btn variant="secondary" onClick={() => { setPartida(null); setNovaPartida(false); }}>← Voltar</Btn>}
          <Btn variant="danger" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => { SESSION_TOKEN = null; setSession(null); }}>Sair</Btn>
        </div>
      </header>

      {/* Breadcrumb */}
      <div style={{ background: C.surf2, borderBottom: `1px solid ${C.border}`, padding: "10px 24px", fontSize: 12, color: C.dim }}>
        {time?.nome || "Carregando..."} · {temporadaSel?.nome || ""}
        {partida && <> · <span style={{ color: C.cream }}>{partida.adversario?.nome || "Partida"}</span></>}
        {novaPartida && <> · <span style={{ color: C.cream }}>Nova Partida</span></>}
      </div>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {novaPartida && temporadaSel && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 24, background: C.gold, borderRadius: 2 }} />
              Nova Partida
            </div>
            <Card style={{ padding: 24 }}>
              <FormNovaPartida
                temporada={temporadaSel}
                onSalvo={() => setNovaPartida(false)}
                onCancelar={() => setNovaPartida(false)}
              />
            </Card>
          </>
        )}

        {partida && !novaPartida && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 24, background: C.gold, borderRadius: 2 }} />
              Ficha da Partida
            </div>
            <FichaPartida partida={partida} onVoltar={() => setPartida(null)} />
          </>
        )}

        {!partida && !novaPartida && temporadaSel && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 24, background: C.gold, borderRadius: 2 }} />
              Partidas — {temporadaSel.nome}
            </div>
            <ListaPartidas
              temporada={temporadaSel}
              onSelect={p => setPartida(p)}
              onNova={() => setNovaPartida(true)}
            />
          </>
        )}
      </main>
    </div>
  );
}

// ── CADASTROS ─────────────────────────────────────────────────
// Este bloco substitui o export default AdminApp acima.
// Use o AdminAppCompleto abaixo no lugar do AdminApp.

function CrudJogadores({ show }) {
  const { data: jogadores, loading, reload } = useQuery(() => api.get(`jogador?id_jogador=gt.0&select=*,posicao(nome)&order=camisa.asc`));
  const { data: posicoes } = useQuery(() => api.get(`posicao?id_posicao_pai=not.is.null&select=*&order=nome.asc`));
  const [modal, setModal] = useState(null); // null | 'novo' | jogador
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() { setForm({ nome:"", apelido:"", camisa:"", id_posicao:"", data_inicio:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(j) { setForm({ ...j, id_posicao: j.id_posicao ? String(j.id_posicao) : "" }); setModal(j); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, apelido: form.apelido || null, camisa: form.camisa || null, id_posicao: form.id_posicao ? Number(form.id_posicao) : null, data_inicio: form.data_inicio || null, observacoes: form.observacoes || null };
      if (modal === "novo") await api.post("jogador", body);
      else await api.patch(`jogador?id_jogador=eq.${form.id_jogador}`, body);
      show(modal === "novo" ? "Jogador criado!" : "Jogador atualizado!");
      setModal(null); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function inativar(j) {
    if (!confirm(`Inativar ${j.apelido || j.nome}?`)) return;
    try { await api.patch(`jogador?id_jogador=eq.${j.id_jogador}`, { data_fim: new Date().toISOString().split("T")[0] }); show("Jogador inativado."); reload(); }
    catch (e) { show(e.message, "error"); }
  }

  if (loading) return <Spinner />;
  const ativos   = (jogadores||[]).filter(j => !j.data_fim);
  const inativos = (jogadores||[]).filter(j =>  j.data_fim);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <Btn onClick={abrirNovo}>+ Novo Jogador</Btn>
      </div>
      {["Ativos","Inativos"].map(grupo => {
        const lista = grupo === "Ativos" ? ativos : inativos;
        if (!lista.length) return null;
        return (
          <div key={grupo}>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>{grupo} ({lista.length})</div>
            <Card style={{ padding:0, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
                <thead><tr style={{ background:C.surf2 }}>
                  {["#","Nome","Apelido","Posição","Desde",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {lista.map((j,i) => (
                    <tr key={j.id_jogador} style={{ background: i%2===0?C.surface:C.bg }}>
                      <td style={{ padding:"11px 14px", fontWeight:800, color:C.gold }}>{j.camisa}</td>
                      <td style={{ padding:"11px 14px", fontWeight:700 }}>{j.nome}</td>
                      <td style={{ padding:"11px 14px", color:C.dim }}>{j.apelido || "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{j.posicao?.nome || "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{j.data_inicio ? new Date(j.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                      <td style={{ padding:"11px 14px", display:"flex", gap:8 }}>
                        <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(j)}>Editar</Btn>
                        {!j.data_fim && <Btn variant="danger" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => inativar(j)}>Inativar</Btn>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        );
      })}
      {modal && (
        <Modal title={modal === "novo" ? "Novo Jogador" : "Editar Jogador"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
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

function CrudAdversarios({ show }) {
  const { data: adversarios, loading, reload } = useQuery(() => api.get(`adversario?select=*,campo(nome),cidade(nome,estado)&order=nome.asc`));
  const { data: campos }   = useQuery(() => api.get(`campo?select=*&order=nome.asc`));
  const { data: cidades }  = useQuery(() => api.get(`cidade?select=*&order=nome.asc`));
  const [modal, setModal]  = useState(null);
  const [form, setForm]    = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() { setForm({ nome:"", id_campo:"", id_cidade:"", contato:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(a) { setForm({ ...a, id_campo: a.id_campo ? String(a.id_campo) : "", id_cidade: a.id_cidade ? String(a.id_cidade) : "" }); setModal(a); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, id_campo: form.id_campo ? Number(form.id_campo) : null, id_cidade: form.id_cidade ? Number(form.id_cidade) : null, contato: form.contato || null, observacoes: form.observacoes || null };
      if (modal === "novo") await api.post("adversario", body);
      else await api.patch(`adversario?id_adversario=eq.${form.id_adversario}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;
  const ativos = (adversarios||[]).filter(a => !a.data_fim);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"flex-end" }}><Btn onClick={abrirNovo}>+ Novo Adversário</Btn></div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Nome","Campo","Cidade","Contato",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {ativos.map((a,i) => (
              <tr key={a.id_adversario} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700 }}>{a.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{a.campo?.nome || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{a.cidade ? `${a.cidade.nome}/${a.cidade.estado}` : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{a.contato || "—"}</td>
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
            <Select label="Campo do Adversário" value={form.id_campo||""} onChange={e => set("id_campo", e.target.value)}>
              <option value="">Selecione...</option>
              {(campos||[]).map(c => <option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
            </Select>
            <Select label="Cidade" value={form.id_cidade||""} onChange={e => set("id_cidade", e.target.value)}>
              <option value="">Selecione...</option>
              {(cidades||[]).map(c => <option key={c.id_cidade} value={c.id_cidade}>{c.nome}/{c.estado}</option>)}
            </Select>
            <Input label="Contato" value={form.contato||""} onChange={e => set("contato", e.target.value)} placeholder="WhatsApp, e-mail..." />
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

function CrudCampos({ show }) {
  const { data: campos, loading, reload } = useQuery(() => api.get(`campo?select=*,cidade(nome,estado)&order=nome.asc`));
  const { data: cidades } = useQuery(() => api.get(`cidade?select=*&order=nome.asc`));
  const [modal, setModal]  = useState(null);
  const [form, setForm]    = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() { setForm({ nome:"", endereco:"", id_cidade:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(c) { setForm({ ...c, id_cidade: c.id_cidade ? String(c.id_cidade) : "" }); setModal(c); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, endereco: form.endereco || null, id_cidade: form.id_cidade ? Number(form.id_cidade) : null, observacoes: form.observacoes || null };
      if (modal === "novo") await api.post("campo", body);
      else await api.patch(`campo?id_campo=eq.${form.id_campo}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"flex-end" }}><Btn onClick={abrirNovo}>+ Novo Campo</Btn></div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Nome","Endereço","Cidade",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(campos||[]).filter(c=>!c.data_fim).map((c,i) => (
              <tr key={c.id_campo} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700 }}>{c.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{c.endereco || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{c.cidade ? `${c.cidade.nome}/${c.cidade.estado}` : "—"}</td>
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

function CrudCidades({ show }) {
  const { data: cidades, loading, reload } = useQuery(() => api.get(`cidade?select=*&order=nome.asc`));
  const [modal, setModal]  = useState(null);
  const [form, setForm]    = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() { setForm({ nome:"", estado:"", observacoes:"" }); setModal("novo"); }
  function abrirEditar(c) { setForm({ ...c }); setModal(c); }

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, estado: form.estado || null, observacoes: form.observacoes || null };
      if (modal === "novo") await api.post("cidade", body);
      else await api.patch(`cidade?id_cidade=eq.${form.id_cidade}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"flex-end" }}><Btn onClick={abrirNovo}>+ Nova Cidade</Btn></div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Cidade","Estado",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(cidades||[]).map((c,i) => (
              <tr key={c.id_cidade} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700 }}>{c.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim }}>{c.estado || "—"}</td>
                <td style={{ padding:"11px 14px" }}><Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(c)}>Editar</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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

// ── APP ADMIN COMPLETO (substitui o AdminApp) ─────────────────
const MENU = [
  { id:"partidas",    label:"Partidas",    icon:"📅", grupo:"Jogos" },
  { id:"jogadores",   label:"Jogadores",   icon:"👕", grupo:"Cadastros" },
  { id:"adversarios", label:"Adversários", icon:"⚔️", grupo:"Cadastros" },
  { id:"campos",      label:"Campos",      icon:"🏟️", grupo:"Cadastros" },
  { id:"cidades",     label:"Cidades",     icon:"📍", grupo:"Cadastros" },
  { id:"posicoes",    label:"Posições",    icon:"🎯", grupo:"Cadastros" },
  { id:"temporadas",  label:"Temporadas",  icon:"📆", grupo:"Configurações" },
  { id:"time",        label:"Meu Time",    icon:"⚙️", grupo:"Configurações" },
];

export default function AdminAppCompleto() {
  const [session, setSession]   = useState(null);
  const [menu, setMenu]         = useState("partidas");
  const [partida, setPartida]   = useState(null);
  const [novaPartida, setNovaPartida] = useState(false);
  const { toast, show }         = useToast();

  const { data: times }      = useQuery(() => api.get(`time?select=*&limit=1`), [session]);
  const { data: temporadas } = useQuery(() => api.get(`temporada?select=*&order=data_inicio.desc`), [session]);
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
        <div style={{ fontSize:18, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:C.cream }}>⚽ Nerd do Campo</div>
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", background:C.gold+"22", border:`1px solid ${C.gold}44`, borderRadius:6, padding:"2px 8px" }}>Admin</div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:12, color:C.dim }}>{time?.nome || ""}</span>
          {(temporadas||[]).length > 1 && (
            <select value={temporadaSel?.id_temporada||""} onChange={e => setTemporadaSel(temporadas.find(t=>t.id_temporada===Number(e.target.value)))}
              style={{ background:C.surf2, color:C.cream, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", fontFamily:"inherit", fontSize:12 }}>
              {(temporadas||[]).map(t=><option key={t.id_temporada} value={t.id_temporada}>{t.nome}</option>)}
            </select>
          )}
          <Btn variant="danger" style={{ fontSize:11, padding:"6px 12px" }} onClick={() => { SESSION_TOKEN=null; setSession(null); }}>Sair</Btn>
        </div>
      </header>

      <div style={{ display:"flex", flex:1 }}>
        {/* Sidebar */}
        <aside style={{ width:210, background:"#091F15", borderRight:`1px solid ${C.border}`, padding:"16px 0", flexShrink:0, position:"sticky", top:64, height:"calc(100vh - 64px)", overflowY:"auto" }}>
          {["Jogos","Cadastros","Configurações"].map(grupo => {
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
          {menu === "partidas" && !partida && !novaPartida && temporadaSel && (<>
            {secTitle(`Partidas — ${temporadaSel.nome}`)}
            <ListaPartidas temporada={temporadaSel} onSelect={p=>{setPartida(p);}} onNova={()=>setNovaPartida(true)} />
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
          {menu === "time"        && (<>{secTitle("Configurações do Time")}<ConfigTime show={show} /></>)}
        </main>
      </div>
    </div>
  );
}

// ── CRUD POSIÇÕES ─────────────────────────────────────────────
function CrudPosicoes({ show }) {
  const { data: posicoes, loading, reload } = useQuery(() =>
    api.get(`posicao?select=*,posicao_pai:posicao!id_posicao_pai(nome)&order=ordem.asc,nome.asc`)
  );
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
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

  const grupos = (posicoes||[]).filter(p => !p.id_posicao_pai);
  const filhas  = (posicoes||[]).filter(p =>  p.id_posicao_pai);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"flex-end" }}><Btn onClick={abrirNovo}>+ Nova Posição</Btn></div>
      {["Grupos (pai)","Posições detalhadas"].map((titulo, gi) => {
        const lista = gi === 0 ? grupos : filhas;
        if (!lista.length) return null;
        return (
          <div key={titulo}>
            <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, marginBottom:10, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>{titulo}</div>
            <Card style={{ padding:0, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
                <thead><tr style={{ background:C.surf2 }}>
                  {["Nome","Descrição","Ordem","Grupo pai",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {lista.map((p, i) => (
                    <tr key={p.id_posicao} style={{ background: i%2===0?C.surface:C.bg }}>
                      <td style={{ padding:"11px 14px", fontWeight:700 }}>{p.nome}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{p.descricao || "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, textAlign:"center" }}>{p.ordem ?? "—"}</td>
                      <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{p.posicao_pai?.nome || "—"}</td>
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
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() {
    const t = times?.[0];
    setForm({ nome:"", id_time: t ? String(t.id_time) : "", data_inicio:"", data_fim:"", tecnico: t?.tecnico||"", presidente: t?.presidente||"", vice_presidente: t?.vice_presidente||"", financeiro: t?.financeiro||"", vice_financeiro: t?.vice_financeiro||"", marca_jogos: t?.marca_jogos||"", resp_redes_sociais: t?.resp_redes_sociais||"", resp_eventos: t?.resp_eventos||"", observacoes:"" });
    setModal("novo");
  }
  function abrirEditar(t) { setForm({ ...t, id_time: t.id_time ? String(t.id_time) : "" }); setModal(t); }

  async function salvar() {
    if (!form.nome || !form.data_inicio || !form.data_fim) { show("Nome e datas são obrigatórios.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, id_time: form.id_time ? Number(form.id_time) : null, data_inicio: form.data_inicio, data_fim: form.data_fim, tecnico: form.tecnico||null, presidente: form.presidente||null, vice_presidente: form.vice_presidente||null, financeiro: form.financeiro||null, vice_financeiro: form.vice_financeiro||null, marca_jogos: form.marca_jogos||null, resp_redes_sociais: form.resp_redes_sociais||null, resp_eventos: form.resp_eventos||null, observacoes: form.observacoes||null };
      if (modal === "novo") await api.post("temporada", body);
      else await api.patch(`temporada?id_temporada=eq.${form.id_temporada}`, body);
      show("Salvo!"); setModal(null); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"flex-end" }}><Btn onClick={abrirNovo}>+ Nova Temporada</Btn></div>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Temporada","Time","Início","Fim","Técnico","Presidente",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(temporadas||[]).map((t,i) => (
              <tr key={t.id_temporada} style={{ background: i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"11px 14px", fontWeight:700, color:C.gold }}>{t.nome}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{t.time?.nome || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{t.data_inicio ? new Date(t.data_inicio).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{t.data_fim   ? new Date(t.data_fim  ).toLocaleDateString("pt-BR") : "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{t.tecnico    || "—"}</td>
                <td style={{ padding:"11px 14px", color:C.dim, fontSize:13 }}>{t.presidente || "—"}</td>
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
  const { data: campos } = useQuery(() => api.get(`campo?select=*&order=nome.asc`));
  const [form, setForm]   = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (times?.[0] && !form) {
      const t = times[0];
      setForm({ ...t, id_campo: t.id_campo ? String(t.id_campo) : "", data_fundacao: t.data_fundacao ? t.data_fundacao.split("T")[0] : "" });
    }
  }, [times]);

  async function salvar() {
    if (!form?.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const body = { nome: form.nome, telefone: form.telefone||null, id_campo: form.id_campo ? Number(form.id_campo) : null, data_fundacao: form.data_fundacao||null, numero_titulares: form.numero_titulares ? Number(form.numero_titulares) : null, quantidade_periodos: form.quantidade_periodos ? Number(form.quantidade_periodos) : null, minutos_padrao_periodo: form.minutos_padrao_periodo ? Number(form.minutos_padrao_periodo) : null, permite_acrescimos: form.permite_acrescimos||"N", tecnico: form.tecnico||null, presidente: form.presidente||null, vice_presidente: form.vice_presidente||null, financeiro: form.financeiro||null, vice_financeiro: form.vice_financeiro||null, marca_jogos: form.marca_jogos||null, resp_redes_sociais: form.resp_redes_sociais||null, resp_eventos: form.resp_eventos||null, observacoes: form.observacoes||null };
      await api.patch(`time?id_time=eq.${form.id_time}`, body);
      show("Configurações salvas!"); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading || !form) return <Spinner />;

  return (
    <Card style={{ padding:24, maxWidth:720 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Input label="Nome do Time *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
          <Input label="Telefone"       value={form.telefone||""} onChange={e => set("telefone", e.target.value)} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Input label="Data de Fundação" type="date" value={form.data_fundacao||""} onChange={e => set("data_fundacao", e.target.value)} />
          <Select label="Campo Principal" value={form.id_campo||""} onChange={e => set("id_campo", e.target.value)}>
            <option value="">Selecione...</option>
            {(campos||[]).map(c => <option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
          </Select>
        </div>

        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginTop:4, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>Regras do Jogo</div>
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
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
          <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar Configurações"}</Btn>
        </div>
      </div>
    </Card>
  );
}
