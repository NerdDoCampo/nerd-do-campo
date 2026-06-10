import { useState, useEffect, useCallback, useRef } from "react";

// ── Supabase ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://nxztffulmvohduvudbhg.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

let SESSION_TOKEN = sessionStorage.getItem("ndc_super_token") || null;
let REFRESH_TOKEN = sessionStorage.getItem("ndc_super_refresh") || null;

const UFS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
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
      sessionStorage.setItem("ndc_super_token", res.access_token);
      if (res.refresh_token) { REFRESH_TOKEN = res.refresh_token; sessionStorage.setItem("ndc_super_refresh", res.refresh_token); }
      return true;
    }
  } catch (e) {}
  return false;
}

// Limpa a sessão e força relogin (chamado quando o refresh falha).
function encerrarSessao() {
  SESSION_TOKEN = null; REFRESH_TOKEN = null;
  sessionStorage.removeItem("ndc_super_token");
  sessionStorage.removeItem("ndc_super_refresh");
  window.dispatchEvent(new CustomEvent("ndc-sessao-expirada"));
}

async function sb(path, opts = {}, _jaTentou = false) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SESSION_TOKEN || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  // Token expirado: tenta renovar UMA vez e repete a chamada.
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
  get:    (p)      => sb(p),
  post:   (p, b)   => sb(p, { method:"POST",   body:JSON.stringify(b) }),
  patch:  (p, b)   => sb(p, { method:"PATCH",  body:JSON.stringify(b) }),
  delete: (p)      => sb(p, { method:"DELETE", prefer:"return=minimal" }),
};

// ── Paleta ────────────────────────────────────────────────────
const C = {
  bg:"#0B1A2E", surface:"#0F2340", surf2:"#163060",
  border:"#1E3A5F", gold:"#E8A020", cream:"#F0E8D0",
  dim:"#7A9ABF", win:"#4CAF50", loss:"#E53935",
};

// ── Atoms ─────────────────────────────────────────────────────
function Card({ children, style: s = {} }) {
  return <div style={{ background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, ...s }}>{children}</div>;
}
function Btn({ children, variant="primary", onClick, disabled, style:s={} }) {
  const bg = disabled?C.surf2:variant==="primary"?C.gold:variant==="danger"?C.loss:C.surf2;
  const color = disabled?C.dim:variant==="primary"?"#0B1A2E":C.cream;
  return <button onClick={onClick} disabled={disabled} style={{ background:bg, color, border:"none", borderRadius:8, padding:"9px 18px", fontFamily:"inherit", fontWeight:700, fontSize:13, cursor:disabled?"not-allowed":"pointer", textTransform:"uppercase", letterSpacing:"0.06em", ...s }}>{children}</button>;
}
function Input({ label, error, style:s={}, ...p }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5, ...s }}>
      {label && <label style={{ fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{label}</label>}
      <input {...p} style={{ background:C.surf2, border:`1px solid ${error?C.loss:C.border}`, borderRadius:8, padding:"9px 12px", color:C.cream, fontFamily:"inherit", fontSize:14, outline:"none", width:"100%" }}/>
      {error && <span style={{ color:C.loss, fontSize:12 }}>{error}</span>}
    </div>
  );
}
function Select({ label, children, style:s={}, ...p }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5, ...s }}>
      {label && <label style={{ fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{label}</label>}
      <select {...p} style={{ background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 12px", color:C.cream, fontFamily:"inherit", fontSize:14, outline:"none", width:"100%" }}>{children}</select>
    </div>
  );
}
function Spinner() {
  return (
    <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
      <div style={{ width:36, height:36, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.gold}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function Toast({ msg, type }) {
  if (!msg) return null;
  const cor = type==="error"?C.loss:C.win;
  return <div style={{ position:"fixed", bottom:24, right:24, background:C.surf2, border:`1px solid ${cor}`, borderRadius:10, padding:"12px 20px", color:cor, fontWeight:700, fontSize:14, zIndex:9999 }}>{type==="error"?"❌":"✅"} {msg}</div>;
}
function Modal({ title, children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", display:"flex", alignItems:"center", justifyContent:"center", zIndex:500, padding:24 }}>
      <Card style={{ width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontWeight:700, fontSize:16, textTransform:"uppercase", letterSpacing:"0.06em", color:C.cream }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.dim, fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </Card>
    </div>
  );
}

function useQuery(fetcher, deps=[], opts={}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetcher()); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, deps);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!opts.refetchInterval) return;
    const id = setInterval(() => { load(); }, opts.refetchInterval);
    return () => clearInterval(id);
  }, [load, opts.refetchInterval]);
  return { data, loading, error, reload: load };
}

function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const show = (msg, type="success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({msg,type});
    const base = type === "error" ? 7000 : 4000;
    const dur = Math.min(base + String(msg||"").length * 60, type === "error" ? 16000 : 9000);
    timerRef.current = setTimeout(()=>setToast(null), dur);
  };
  return { toast, show };
}

// ── LOGIN SUPER ───────────────────────────────────────────────

// ── Badge de solicitações pendentes ──────────────────────────
function BadgePendentes() {
  const { data: pendentes } = useQuery(() =>
    api.get(`solicitacao_time?select=id&status=eq.pendente`),
    [], { refetchInterval: 20000 } // atualiza a cada 20s
  );
  const total = (pendentes||[]).length;
  if (!total) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6,
      background:"#F4433622", border:"1px solid #F4433644",
      borderRadius:8, padding:"3px 10px", animation:"pulse 2s infinite" }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:"#F44336" }}/>
      <span style={{ fontSize:11, color:"#F44336", fontWeight:800 }}>
        {total} solicitação{total > 1 ? "ões" : ""} pendente{total > 1 ? "s" : ""}
      </span>
    </div>
  );
}

function LoginSuper({ onLogin, aviso }) {
  const [email, setEmail]   = useState("");
  const [senha, setSenha]   = useState("");
  const [erro, setErro]     = useState(aviso || "");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setErro(""); setLoading(true);
    const res = await sbAuth("token?grant_type=password", { email, password: senha });
    setLoading(false);
    if (res.access_token) {
      SESSION_TOKEN = res.access_token;
      sessionStorage.setItem("ndc_super_token", res.access_token);
      if (res.refresh_token) { REFRESH_TOKEN = res.refresh_token; sessionStorage.setItem("ndc_super_refresh", res.refresh_token); }
      // Verificar se é superadmin
      try {
        const check = await api.get(`usuario_time?user_id=eq.${res.user.id}&role=eq.superadmin`);
        if (check?.length > 0) { onLogin(res); }
        else { SESSION_TOKEN = null; sessionStorage.removeItem("ndc_super_token"); setErro("Acesso negado. Você não é super-admin."); }
      } catch(e) { setErro("Erro ao verificar permissões."); }
    } else { setErro("E-mail ou senha incorretos."); }
  }

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif" }}>
      <Card style={{ width:"100%", maxWidth:380, padding:"32px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:4 }}>
            <img src="/logo.png" alt="Nerd do Campo" style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover" }}/>
          </div>
          <div style={{ fontSize:24, fontWeight:800, color:C.cream, textTransform:"uppercase", letterSpacing:"0.08em" }}>Super Admin</div>
          <div style={{ fontSize:12, color:C.gold, marginTop:4, textTransform:"uppercase", letterSpacing:"0.12em" }}>Nerd do Campo</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Input label="E-mail" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/>
          <Input label="Senha" type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
          {erro && <div style={{ color:C.loss, fontSize:13, textAlign:"center" }}>{erro}</div>}
          <Btn onClick={handleLogin} disabled={loading} style={{ marginTop:8, padding:"12px" }}>{loading?"Entrando...":"Entrar"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── DASHBOARD SUPER ───────────────────────────────────────────
function DashboardSuper() {
  const { data: times, loading, reload } = useQuery(() => api.get(`time?select=*,temporada(id_temporada,nome),usuario_time(user_id,role)&order=nome.asc`));
  const { data: usuarios } = useQuery(() => api.get(`usuario_time?select=*&order=criado_em.desc`));
  const { data: solPendentes, reload: reloadPendentes } = useQuery(() => api.get(`solicitacao_time?select=id&status=eq.pendente`));
  const { toast, show } = useToast();
  const [modalNovoTime, setModalNovoTime]     = useState(false);
  const [modalNovoUser, setModalNovoUser]     = useState(false);
  const [timeSelecionado, setTimeSelecionado] = useState(null);
  const [modalPerms, setModalPerms]           = useState(null); // { user_id, id_time, nome }
  const [modalNivel, setModalNivel]           = useState(null); // time selecionado para editar nível
  const [aba, setAba] = useState("times");

  const totalTimes    = (times||[]).length;
  const totalUsuarios = (usuarios||[]).length;
  const totalAdmins   = (usuarios||[]).filter(u=>u.role==="admin").length;

  if (loading) return <Spinner/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <Toast {...(toast||{msg:null})}/>

      {/* Abas */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {[
          { id:"times",        label:"🏆 Times" },
          { id:"mensalidades", label:"💵 Mensalidades" },
          { id:"solicitacoes", label:`📋 Solicitações${(solPendentes||[]).length > 0 ? ` (${(solPendentes||[]).length})` : ""}` },
          { id:"tipos",        label:"⚽ Tipos de Time" },
          { id:"cidades",      label:"📍 Cidades" },
          { id:"config",       label:"⚙️ Configurações" },
          { id:"ajuda",        label:"❓ Ajuda" },
        ].map(a => {
          const temPendentes = a.id === "solicitacoes" && (solPendentes||[]).length > 0;
          const corFundo = aba===a.id ? (temPendentes ? C.loss : C.gold)
                                       : (temPendentes ? C.loss+"22" : C.surface);
          const corTexto = aba===a.id ? (temPendentes ? "#fff" : "#0B3D2E")
                                       : (temPendentes ? C.loss : C.dim);
          const corBorda = temPendentes ? C.loss : (aba===a.id ? C.gold : C.border);
          return (
          <button key={a.id} onClick={() => setAba(a.id)}
            style={{ background: corFundo, color: corTexto,
              border:`1px solid ${corBorda}`, borderRadius:8, padding:"8px 18px",
              fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase",
              animation: temPendentes && aba!==a.id ? "pulse 2s infinite" : "none" }}>
            {a.label}
          </button>
        );})}
      </div>

      {aba === "tipos"        && <CrudTipoTime show={show}/>}
      {aba === "cidades"      && <GestaoCidades show={show}/>}
      {aba === "config"       && <ConfigSistema show={show}/>}
      {aba === "ajuda"        && <AjudaSuper/>}
      {aba === "mensalidades" && <CrudMensalidadeTimes show={show}/>}
      {aba === "solicitacoes" && <CrudSolicitacoes show={show} onMudou={reloadPendentes}/>}
      {aba === "times" && <>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(100px, 1fr))", gap:16 }}>
        {[
          { label:"Times cadastrados", value:totalTimes,    cor:C.gold },
          { label:"Usuários totais",   value:totalUsuarios, cor:C.win },
          { label:"Admins ativos",     value:totalAdmins,   cor:C.cream },
        ].map(s => (
          <Card key={s.label} style={{ padding:"20px 24px", textAlign:"center" }}>
            <div style={{ fontSize:40, fontWeight:800, color:s.cor, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.dim, marginTop:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Times */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:16, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:C.cream }}>Times Cadastrados</div>
          <Btn onClick={()=>setModalNovoTime(true)}>+ Novo Time</Btn>
        </div>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Time","Status","Nível","Temporadas","Admins","Fundação","Ações"].map(h => <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(times||[]).map((t,i) => (
              <tr key={t.id_time} style={{ background:i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"13px 16px", fontWeight:700, color:C.cream }}>{t.nome}</td>
                <td style={{ padding:"13px 16px" }}>
                  <span style={{ color: t.status==="Inativo" ? C.loss : C.win, fontWeight:700, fontSize:12 }}>
                    {t.status==="Inativo" ? "🔴 Inativo" : "🟢 Ativo"}
                  </span>
                </td>
                <td style={{ padding:"13px 16px" }}>
                  <span style={{ background:C.gold+"22", color:C.gold, border:`1px solid ${C.gold}44`, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>
                    Nível {t.nivel_mensalidade||1}
                  </span>
                </td>
                <td style={{ padding:"13px 16px", color:C.dim }}>{t.temporada?.length||0}</td>
                <td style={{ padding:"13px 16px", color:C.dim }}>{(t.usuario_time||[]).filter(u=>u.role==="admin").length}</td>
                <td style={{ padding:"13px 16px", color:C.dim, fontSize:13 }}>{t.data_fundacao?new Date(t.data_fundacao).getFullYear():"—"}</td>
                <td style={{ padding:"13px 16px", display:"flex", gap:6, flexWrap:"wrap" }}>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>{ setTimeSelecionado(t); setModalNovoUser(true); }}>
                    + Admin
                  </Btn>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=> setModalNivel(t)}>
                    Nível
                  </Btn>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px", color: t.status==="Inativo" ? C.win : C.loss }}
                    onClick={async ()=>{
                      const novo = t.status==="Inativo" ? "Ativo" : "Inativo";
                      await api.patch(`time?id_time=eq.${t.id_time}`, { status: novo });
                      show(`${t.nome}: ${novo}`); reload();
                    }}>
                    {t.status==="Inativo" ? "Ativar" : "Inativar"}
                  </Btn>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px", color: t.destaque ? C.gold : C.dim }}
                    onClick={async ()=>{
                      await api.patch(`time?id_time=eq.${t.id_time}`, { destaque: !t.destaque });
                      show(t.destaque ? `${t.nome}: destaque removido` : `${t.nome}: marcado como destaque`); reload();
                    }}>
                    {t.destaque ? "★ Destaque" : "☆ Destaque"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>

      {/* Usuários */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:16, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:C.cream }}>Usuários e Acessos</div>
        </div>
        <UsuariosTable times={times||[]} reload={reload} show={show} onPermissoes={setModalPerms}/>
      </Card>

      {/* Modal Novo Time */}
      {modalNovoTime && (
        <Modal title="Novo Time" onClose={()=>setModalNovoTime(false)}>
          <FormNovoTime onSalvo={()=>{ setModalNovoTime(false); reload(); show("Time criado!"); }} show={show}/>
        </Modal>
      )}

      {/* Modal Novo Admin */}
      {modalNovoUser && timeSelecionado && (
        <Modal title={`Criar Admin — ${timeSelecionado.nome}`} onClose={()=>{ setModalNovoUser(false); setTimeSelecionado(null); }}>
          <FormNovoAdmin time={timeSelecionado} onSalvo={()=>{ setModalNovoUser(false); setTimeSelecionado(null); reload(); show("Admin criado! Envie o acesso para o time."); }} show={show}/>
        </Modal>
      )}
      {/* Modal Permissões */}
      {modalPerms && (
        <ModalPermissoes
          user_id={modalPerms.user_id}
          id_time={modalPerms.id_time}
          nomeUsuario={modalPerms.nome}
          onClose={() => setModalPerms(null)}
          show={show}/>
      )}

      {/* Modal Nível de Mensalidade */}
      {modalNivel && (
        <ModalNivelMensalidade time={modalNivel}
          onClose={() => setModalNivel(null)}
          onSalvo={() => { setModalNivel(null); reload(); show("Nível atualizado!"); }}
          show={show}/>
      )}
      </>}
    </div>
  );
}

// ── TABELA DE USUÁRIOS ────────────────────────────────────────
function UsuariosTable({ times, reload, show, onPermissoes }) {
  const { data: vinculos, loading, reload: reloadVinculos } = useQuery(() =>
    api.post(`rpc/listar_usuarios_time`, {})
  );
  const [filtroEmail, setFiltroEmail] = useState("");

  async function revogar(id) {
    if (!confirm("Revogar acesso deste usuário?")) return;
    try { await api.delete(`usuario_time?id=eq.${id}`); show("Acesso revogado."); reloadVinculos(); }
    catch(e) { show(e.message, "error"); }
  }

  if (loading) return <Spinner/>;

  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <input
          value={filtroEmail}
          onChange={e => setFiltroEmail(e.target.value)}
          placeholder="🔍 Filtrar por e-mail (para descobrir de qual time é o usuário)"
          style={{ width:"100%", maxWidth:420, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, color:C.cream, fontFamily:"inherit", fontSize:14, padding:"10px 14px", outline:"none" }}
        />
        {filtroEmail && (
          <span style={{ marginLeft:12, fontSize:12, color:C.dim }}>
            {(vinculos||[]).filter(v => (v.email||"").toLowerCase().includes(filtroEmail.toLowerCase())).length} resultado(s)
          </span>
        )}
      </div>
      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
      <thead><tr style={{ background:C.surf2 }}>
        {["E-mail","Último Acesso","Time","Role","Criado em","Ações"].map(h => <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
      </tr></thead>
      <tbody>
        {(vinculos||[]).filter(v => !filtroEmail || (v.email||"").toLowerCase().includes(filtroEmail.toLowerCase())).map((v,i) => (
          <tr key={v.id} style={{ background:i%2===0?C.surface:C.bg }}>
            <td style={{ padding:"12px 16px", color:C.cream, fontSize:13 }}>{v.email || v.user_id?.substring(0,8)+"..."}</td>
            <td style={{ padding:"12px 16px", color:C.dim, fontSize:12 }}>{v.last_sign_in_at ? new Date(v.last_sign_in_at).toLocaleDateString("pt-BR") : "Nunca"}</td>
            <td style={{ padding:"12px 16px", fontWeight:700, color:C.cream }}>{v.nome_time||"—"}</td>
            <td style={{ padding:"12px 16px" }}>
              <span style={{ background:v.role==="superadmin"?C.gold+"33":v.role==="admin"?C.win+"33":C.surf2, color:v.role==="superadmin"?C.gold:v.role==="admin"?C.win:C.dim, border:`1px solid ${v.role==="superadmin"?C.gold:v.role==="admin"?C.win:C.border}55`, borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:700, textTransform:"uppercase" }}>
                {v.role}
              </span>
            </td>
            <td style={{ padding:"12px 16px", color:C.dim, fontSize:13 }}>{new Date(v.criado_em).toLocaleDateString("pt-BR")}</td>
            <td style={{ padding:"12px 16px", display:"flex", gap:6 }}>
              {v.role !== "superadmin" && (
                <Btn variant="secondary" style={{ fontSize:11, padding:"4px 10px" }}
                  onClick={() => onPermissoes && onPermissoes({ user_id: v.user_id, id_time: v.id_time, nome: v.email || v.user_id })}>
                  🔐 Permissões
                </Btn>
              )}
              {v.role !== "superadmin" && (
                <Btn variant="danger" style={{ fontSize:11, padding:"4px 10px" }} onClick={()=>revogar(v.id)}>Revogar</Btn>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table></div>
    </div>
  );
}

// ── FORM NOVO TIME ────────────────────────────────────────────
function FormNovoTime({ onSalvo, show }) {
  const [form, setForm] = useState({ nome:"", data_fundacao:"", numero_titulares:"11", quantidade_periodos:"2", minutos_padrao_periodo:"45", permite_acrescimos:"N", tecnico:"", presidente:"", nivel_mensalidade:"1" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  async function salvar() {
    if (!form.nome) { show("Nome obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const time = await api.post("time", {
        nome: form.nome,
        data_fundacao: form.data_fundacao||null,
        numero_titulares: Number(form.numero_titulares)||11,
        quantidade_periodos: Number(form.quantidade_periodos)||2,
        minutos_padrao_periodo: Number(form.minutos_padrao_periodo)||45,
        permite_acrescimos: form.permite_acrescimos,
        tecnico: form.tecnico||null,
        presidente: form.presidente||null,
        nivel_mensalidade: Number(form.nivel_mensalidade)||1,
      });
      // Criar temporada inicial automaticamente
      const novoIdTime = Array.isArray(time) ? time?.[0]?.id_time : time?.id_time;
      if (!novoIdTime) { show("Time criado, mas não foi possível criar a temporada inicial. Crie-a manualmente.", "error"); onSalvo?.(); return; }
      const ano = new Date().getFullYear();
      await api.post("temporada", {
        nome: `Temporada ${ano}`,
        id_time: novoIdTime,
        data_inicio: `${ano}-01-01`,
        data_fim: `${ano}-12-31`,
        tecnico: form.tecnico||null,
        presidente: form.presidente||null,
      });
      onSalvo();
    } catch(e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <Input label="Nome do Time *" value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="Ex: Flamengo FC Amador"/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:12 }}>
        <Input label="Data Fundação" type="date" value={form.data_fundacao} onChange={e=>set("data_fundacao",e.target.value)}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:12 }}>
        <Input label="Nº Titulares" type="number" value={form.numero_titulares} onChange={e=>set("numero_titulares",e.target.value)}/>
        <Input label="Períodos" type="number" value={form.quantidade_periodos} onChange={e=>set("quantidade_periodos",e.target.value)}/>
        <Input label="Min/Período" type="number" value={form.minutos_padrao_periodo} onChange={e=>set("minutos_padrao_periodo",e.target.value)}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Input label="Técnico" value={form.tecnico} onChange={e=>set("tecnico",e.target.value)}/>
        <Input label="Presidente" value={form.presidente} onChange={e=>set("presidente",e.target.value)}/>
      </div>
      <Select label="Nível de Mensalidade do Sistema" value={form.nivel_mensalidade} onChange={e=>set("nivel_mensalidade",e.target.value)}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>Nível {n}</option>)}
      </Select>
      <div style={{ background:C.surf2, borderRadius:8, padding:"12px 16px", fontSize:13, color:C.dim }}>
        ℹ️ Uma <strong style={{color:C.cream}}>Temporada {new Date().getFullYear()}</strong> será criada automaticamente para este time.
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8 }}>
        <Btn onClick={salvar} disabled={saving}>{saving?"Criando...":"Criar Time"}</Btn>
      </div>
    </div>
  );
}

// ── FORM NOVO ADMIN ───────────────────────────────────────────
// Fluxo em 2 passos:
// 1. Super-admin cria o usuário manualmente no Supabase Auth
// 2. Super-admin digita o e-mail aqui para vincular ao time
function FormNovoAdmin({ time, onSalvo, show }) {
  const [step, setStep]     = useState(1); // 1=instrucoes, 2=vincular
  const [email, setEmail]   = useState("");
  const [saving, setSaving] = useState(false);
  const [vinculado, setVinculado] = useState(null);

  async function vincular() {
    if (!email) { show("E-mail obrigatório.", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vincular_admin_time`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SESSION_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_email: email, p_id_time: time.id_time, p_role: "admin" }),
      });
      const result = await res.json();
      if (result.success) {
        setVinculado({ email, time: time.nome });
      } else {
        show(result.error || "Erro ao vincular usuário.", "error");
      }
    } catch(e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (vinculado) return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:C.win+"22", border:`1px solid ${C.win}55`, borderRadius:10, padding:20, textAlign:"center" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
        <div style={{ fontWeight:700, color:C.win, fontSize:16, marginBottom:4 }}>Admin vinculado com sucesso!</div>
        <div style={{ color:C.dim, fontSize:13 }}>Envie os dados de acesso para o time</div>
      </div>
      <Card style={{ padding:20 }}>
        <div style={{ fontSize:12, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12, fontWeight:700 }}>Dados de acesso</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
            { label:"Time", value: vinculado.time, cor: C.cream },
            { label:"URL",  value: `${typeof window !== "undefined" ? window.location.origin : "https://nerddocampo.com.br"}/admin`, cor: C.gold },
            { label:"E-mail", value: vinculado.email, cor: C.cream },
          ].map(item => (
            <div key={item.label} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:C.surf2, borderRadius:8 }}>
              <span style={{ color:C.dim }}>{item.label}</span>
              <span style={{ fontWeight:700, color:item.cor }}>{item.value}</span>
            </div>
          ))}
        </div>
      </Card>
      <Btn onClick={onSalvo}>Concluir</Btn>
    </div>
  );

  if (step === 1) return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:C.surf2, borderRadius:8, padding:"16px", fontSize:13, color:C.dim, lineHeight:1.6 }}>
        <div style={{ fontWeight:700, color:C.gold, marginBottom:10, fontSize:14 }}>📋 Passo 1 de 2 — Criar o usuário no Supabase</div>
        <div>Antes de vincular, você precisa criar o usuário no Supabase Auth:</div>
        <ol style={{ paddingLeft:20, marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
          <li>Acesse <strong style={{color:C.cream}}>supabase.com</strong> → seu projeto</li>
          <li>Vá em <strong style={{color:C.cream}}>Authentication → Users</strong></li>
          <li>Clique em <strong style={{color:C.cream}}>Add User</strong></li>
          <li>Preencha e-mail e senha do admin do time</li>
          <li>Clique <strong style={{color:C.cream}}>Create User</strong></li>
        </ol>
        <div style={{ marginTop:10, color:C.win }}>✅ Criou o usuário? Clique em Próximo.</div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
        <Btn onClick={() => setStep(2)}>Próximo →</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ background:C.surf2, borderRadius:8, padding:"12px 16px", fontSize:13, color:C.dim }}>
        <div style={{ fontWeight:700, color:C.gold, marginBottom:6, fontSize:14 }}>📋 Passo 2 de 2 — Vincular ao time</div>
        Vinculando admin ao time <strong style={{color:C.cream}}>{time.nome}</strong>.
      </div>
      <Input label="E-mail do Admin *" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@exemplo.com"/>
      <div style={{ display:"flex", justifyContent:"space-between", gap:10, marginTop:8 }}>
        <Btn variant="secondary" onClick={() => setStep(1)}>← Voltar</Btn>
        <Btn onClick={vincular} disabled={saving}>{saving?"Vinculando...":"Vincular ao Time"}</Btn>
      </div>
    </div>
  );
}

// ── APP SUPER ─────────────────────────────────────────────────


// ══════════════════════════════════════════════════════════════
// CONTROLE DE PERMISSÕES DE USUÁRIO
// ══════════════════════════════════════════════════════════════

const MODULOS_ADMIN = [
  { id:"inicio",       label:"🏠 Início" },
  { id:"app",          label:"👁️ Visão App" },
  { id:"partidas",     label:"📅 Partidas" },
  { id:"jogadores",    label:"👕 Jogadores" },
  { id:"adversarios",  label:"⚔️ Adversários" },
  { id:"campos",       label:"🏟️ Campos" },
  { id:"posicoes",     label:"🎯 Posições" },
  { id:"temporadas",   label:"📆 Temporadas" },
  { id:"time",         label:"⚙️ Meu Time" },
  { id:"mensalidades", label:"💰 Mensalidades" },
  { id:"caixa",        label:"💵 Caixa" },
  { id:"eventos",      label:"🎉 Eventos" },
  { id:"tiposmov",     label:"🏷️ Tipos de Movimento" },
];

function ModalPermissoes({ user_id, id_time, nomeUsuario, onClose, show }) {
  const { data: permissoes, reload } = useQuery(() =>
    api.get(`usuario_permissao?user_id=eq.${user_id}&id_time=eq.${id_time}&select=*`)
  );
  const [saving, setSaving] = useState(false);

  // Montar estado local com todas as permissões
  const [perms, setPerms] = useState(null);

  useEffect(() => {
    if (permissoes !== null) {
      const mapa = {};
      MODULOS_ADMIN.forEach(m => {
        const p = (permissoes||[]).find(p => p.modulo === m.id);
        mapa[m.id] = {
          pode_ver:    p ? p.pode_ver    : true,
          pode_editar: p ? p.pode_editar : true,
        };
      });
      setPerms(mapa);
    }
  }, [permissoes]);

  function toggle(modulo, campo) {
    setPerms(prev => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [campo]: !prev[modulo][campo],
        // Se desmarcar ver, desmarcar editar também
        ...(campo === 'pode_ver' && prev[modulo].pode_ver ? { pode_editar: false } : {}),
      }
    }));
  }

  async function salvar() {
    setSaving(true);
    try {
      for (const m of MODULOS_ADMIN) {
        const p = perms[m.id];
        const existe = (permissoes||[]).find(x => x.modulo === m.id);
        const body = {
          user_id, id_time, modulo: m.id,
          pode_ver:    p.pode_ver,
          pode_editar: p.pode_editar,
        };
        if (existe) {
          await api.patch(`usuario_permissao?id=eq.${existe.id}`, body);
        } else {
          await api.post(`usuario_permissao`, body);
        }
      }
      show("Permissões salvas!"); reload(); onClose();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(false); }
  }

  async function liberarTudo() {
    const novo = {};
    MODULOS_ADMIN.forEach(m => { novo[m.id] = { pode_ver: true, pode_editar: true }; });
    setPerms(novo);
  }

  async function bloquearTudo() {
    const novo = {};
    MODULOS_ADMIN.forEach(m => { novo[m.id] = { pode_ver: false, pode_editar: false }; });
    setPerms(novo);
  }

  if (!perms) return <Spinner/>;

  return (
    <Modal title={`Permissões — ${nomeUsuario}`} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {/* Ações rápidas */}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={liberarTudo}>✅ Liberar tudo</Btn>
          <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px", color:C.loss }} onClick={bloquearTudo}>🔒 Bloquear tudo</Btn>
        </div>

        {/* Tabela de permissões */}
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:C.surf2 }}>
              <th style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>Módulo</th>
              <th style={{ padding:"10px 14px", textAlign:"center", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700, width:90 }}>Ver</th>
              <th style={{ padding:"10px 14px", textAlign:"center", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700, width:90 }}>Editar</th>
            </tr>
          </thead>
          <tbody>
            {MODULOS_ADMIN.map((m, i) => {
              const p = perms[m.id];
              return (
                <tr key={m.id} style={{ background: i%2===0 ? C.surface : C.bg }}>
                  <td style={{ padding:"11px 14px", fontWeight:600, color:C.cream }}>{m.label}</td>
                  <td style={{ padding:"11px 14px", textAlign:"center" }}>
                    <button onClick={() => toggle(m.id, 'pode_ver')}
                      style={{ width:36, height:20, borderRadius:10, border:"none", cursor:"pointer",
                        background: p.pode_ver ? C.win : C.dim, position:"relative", transition:"background 0.2s" }}>
                      <span style={{ position:"absolute", top:2, left: p.pode_ver ? 18 : 2,
                        width:16, height:16, borderRadius:"50%", background:"white", transition:"left 0.2s", display:"block" }}/>
                    </button>
                  </td>
                  <td style={{ padding:"11px 14px", textAlign:"center" }}>
                    <button onClick={() => p.pode_ver && toggle(m.id, 'pode_editar')}
                      style={{ width:36, height:20, borderRadius:10, border:"none",
                        cursor: p.pode_ver ? "pointer" : "not-allowed",
                        background: p.pode_editar && p.pode_ver ? C.gold : C.dim,
                        position:"relative", transition:"background 0.2s",
                        opacity: p.pode_ver ? 1 : 0.4 }}>
                      <span style={{ position:"absolute", top:2, left: p.pode_editar && p.pode_ver ? 18 : 2,
                        width:16, height:16, borderRadius:"50%", background:"white", transition:"left 0.2s", display:"block" }}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>

        <div style={{ fontSize:11, color:C.dim, fontStyle:"italic" }}>
          ℹ️ Desativar "Ver" remove o módulo do menu. "Editar" desativado mantém visível mas sem botões de salvar/editar.
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar Permissões"}</Btn>
        </div>
      </div>
    </Modal>
  );
}


// ══════════════════════════════════════════════════════════════
// APROVAÇÃO DE SOLICITAÇÕES DE TIMES
// ══════════════════════════════════════════════════════════════
function CrudSolicitacoes({ show, onMudou }) {
  const { data: solicitacoes, reload } = useQuery(() =>
    api.get(`solicitacao_time?select=*&order=criado_em.desc`)
  );
  const { data: tipos } = useQuery(() => api.get(`tipo_time?select=*&status=eq.Ativo&order=descricao.asc`));
  const [modalSol, setModalSol] = useState(null);
  const [permsForm, setPermsForm] = useState({});
  const [obs, setObs]   = useState("");
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("pendente");

  function abrirAprovar(s) {
    // Permissões padrão — tudo liberado
    const p = {};
    MODULOS_ADMIN.forEach(m => { p[m.id] = { ver: true, editar: true }; });
    setPermsForm(p);
    setObs("");
    setModalSol(s);
  }

  function togglePerm(modulo, campo) {
    setPermsForm(prev => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [campo]: !prev[modulo][campo],
        ...(campo === 'pode_ver' && prev[modulo].ver ? { editar: false } : {}),
      }
    }));
  }

  async function aprovar() {
    setSaving(true);
    try {
      // 0. Buscar o raio padrão geral do sistema (semente para o novo time)
      let raioPadrao = 50;
      try {
        const cfg = await api.get(`config_sistema?chave=eq.raio_busca_padrao_km&select=valor&limit=1`);
        if (cfg?.[0]?.valor) raioPadrao = parseInt(cfg[0].valor) || 50;
      } catch {}

      // 1. Criar o time — mas se a solicitação já tem um time vinculado (retentativa
      //    após falha no vínculo do usuário), reusa em vez de duplicar.
      let id_time = modalSol.id_time_criado || null;
      if (!id_time) {
        // Buscar os parâmetros padrão do tipo de time escolhido (períodos, titulares etc.)
        // Se for turma fechada, os parâmetros vêm do SUBTIPO escolhido na solicitação.
        let paramsTipo = {};
        const idTipoParaParams = modalSol.id_subtipo || modalSol.id_tipo_time;
        if (idTipoParaParams) {
          try {
            const tt = await api.get(`tipo_time?id_tipo_time=eq.${idTipoParaParams}&select=numero_titulares,quantidade_periodos,minutos_padrao_periodo,permite_acrescimos&limit=1`);
            if (tt?.[0]) paramsTipo = {
              numero_titulares: tt[0].numero_titulares ?? 11,
              quantidade_periodos: tt[0].quantidade_periodos ?? 2,
              minutos_padrao_periodo: tt[0].minutos_padrao_periodo ?? 45,
              permite_acrescimos: tt[0].permite_acrescimos ?? "S",
            };
          } catch {}
        }
        const timeRes = await api.post(`time`, {
          nome: modalSol.nome_time,
          id_tipo_time: modalSol.id_tipo_time || null,
          id_subtipo: modalSol.id_subtipo || null,
          data_fundacao: modalSol.data_fundacao || null,
          telefone: modalSol.telefone || null,
          id_cidade_sede: modalSol.id_cidade || null,
          raio_busca_km: raioPadrao,
          publico: false,
          ...paramsTipo,
        });
        // O POST retorna o registro criado (Prefer: return=representation)
        id_time = Array.isArray(timeRes) ? timeRes[0]?.id_time : timeRes?.id_time;
        // Fallback: buscar pelo nome se por algum motivo não veio no retorno
        if (!id_time) {
          const times = await api.get(`time?nome=eq.${encodeURIComponent(modalSol.nome_time)}&order=id_time.desc&limit=1`);
          id_time = times?.[0]?.id_time;
        }
      }
      if (!id_time) throw new Error("Não foi possível criar ou localizar o time.");
      // Marca na solicitação qual time foi criado, para uma eventual retentativa não duplicar
      if (!modalSol.id_time_criado) {
        try { await api.patch(`solicitacao_time?id=eq.${modalSol.id}`, { id_time_criado: id_time }); } catch {}
      }

      // 3. Criar usuário admin via RPC
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_admin_time`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SESSION_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_email: modalSol.email_responsavel, p_id_time: id_time, p_role: "admin" }),
      });
      const rpcData = await rpcRes.json();
      // O RPC retorna { success, user_id, error }. Se falhou, PARA aqui (não marca como aprovado).
      if (!rpcData || rpcData.success === false || !rpcData.user_id) {
        const motivo = rpcData?.error || "não foi possível criar o vínculo do usuário.";
        throw new Error(`Time criado, mas o acesso do admin não foi vinculado: ${motivo} Verifique se o e-mail ${modalSol.email_responsavel} já existe em Authentication → Users no Supabase, e tente aprovar novamente.`);
      }
      const user_id = rpcData.user_id;

      // 4. Salvar permissões (limpa antes, caso seja uma retentativa)
      try { await api.delete(`usuario_permissao?user_id=eq.${user_id}&id_time=eq.${id_time}`); } catch {}
      for (const m of MODULOS_ADMIN) {
        const p = permsForm[m.id];
        await api.post(`usuario_permissao`, {
          user_id, id_time, modulo: m.id,
          pode_ver: p.ver, pode_editar: p.editar,
        });
      }

      // 5. Atualizar status da solicitação
      await api.patch(`solicitacao_time?id=eq.${modalSol.id}`, {
        status: "aprovado", observacoes_admin: obs || null,
      });

      show(`✅ Time "${modalSol.nome_time}" aprovado! Admin criado para ${modalSol.email_responsavel}.`);
      setModalSol(null); reload(); if (onMudou) onMudou();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(false); }
  }

  async function recusar() {
    if (!obs.trim()) { show("Informe o motivo da recusa.", "error"); return; }
    setSaving(true);
    try {
      await api.patch(`solicitacao_time?id=eq.${modalSol.id}`, {
        status: "recusado", observacoes_admin: obs,
      });
      show("Solicitação recusada."); setModalSol(null); reload(); if (onMudou) onMudou();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(false); }
  }

  const lista = (solicitacoes||[]).filter(s => filtro === "todos" || s.status === filtro);

  const STATUS_SOL = {
    pendente:  { label:"⏳ Pendente",  cor:"#E8A020" },
    aprovado:  { label:"✅ Aprovado",  cor:"#4CAF50" },
    recusado:  { label:"❌ Recusado",  cor:"#F44336" },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Filtros */}
      <div style={{ display:"flex", gap:8 }}>
        {[["todos","Todos"],["pendente","⏳ Pendentes"],["aprovado","✅ Aprovados"],["recusado","❌ Recusados"]].map(([k,l]) => (
          <button key={k} onClick={() => setFiltro(k)}
            style={{ background: filtro===k ? C.gold : C.surface, color: filtro===k ? "#0B3D2E" : C.dim,
              border:`1px solid ${filtro===k ? C.gold : C.border}`, borderRadius:8, padding:"7px 16px",
              fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
            {l} {k !== "todos" && `(${(solicitacoes||[]).filter(s=>s.status===k).length})`}
          </button>
        ))}
      </div>

      <Card style={{ padding:0, overflow:"hidden" }}>
        {lista.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:C.dim, fontSize:14 }}>
            Nenhuma solicitação {filtro !== "todos" ? filtro : ""} encontrada.
          </div>
        ) : (
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr style={{ background:C.surf2 }}>
              {["Data","Time","Tipo","Cidade","Responsável","E-mail","Telefone","Status","Ações"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {lista.map((s,i) => {
                const cfg = STATUS_SOL[s.status] || STATUS_SOL.pendente;
                return (
                  <tr key={s.id} style={{ background:i%2===0?C.surface:C.bg }}>
                    <td style={{ padding:"11px 14px", color:C.dim, fontSize:11, whiteSpace:"nowrap" }}>{new Date(s.criado_em).toLocaleDateString("pt-BR")}</td>
                    <td style={{ padding:"11px 14px", fontWeight:700, color:C.cream }}>{s.nome_time}</td>
                    <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{(tipos||[]).find(t => String(t.id_tipo_time) === String(s.id_tipo_time))?.descricao || "—"}</td>
                    <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{s.cidade || "—"}</td>
                    <td style={{ padding:"11px 14px", color:C.dim }}>{s.nome_responsavel}</td>
                    <td style={{ padding:"11px 14px", color:C.gold, fontSize:12 }}>{s.email_responsavel}</td>
                    <td style={{ padding:"11px 14px", color:C.dim, fontSize:12 }}>{s.telefone}</td>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ background:cfg.cor+"22", color:cfg.cor, border:`1px solid ${cfg.cor}44`, borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      {s.status === "pendente" && (
                        <Btn style={{ fontSize:11, padding:"5px 12px" }} onClick={() => abrirAprovar(s)}>
                          Analisar
                        </Btn>
                      )}
                      {s.status !== "pendente" && s.observacoes_admin && (
                        <span style={{ fontSize:11, color:C.dim, fontStyle:"italic" }}>{s.observacoes_admin}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>

      {/* Modal de análise */}
      {modalSol && (
        <Modal title={`Analisar Solicitação — ${modalSol.nome_time}`} onClose={() => setModalSol(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Dados da solicitação */}
            <div style={{ background:C.surf2, borderRadius:10, padding:16 }}>
              <div style={{ fontSize:11, color:C.gold, fontWeight:700, textTransform:"uppercase", marginBottom:10 }}>Dados da Solicitação</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12 }}>
                {[
                  ["Time",          modalSol.nome_time],
                  ["Tipo",          (tipos||[]).find(t => String(t.id_tipo_time) === String(modalSol.id_tipo_time))?.descricao || "—"],
                  ...(modalSol.id_subtipo ? [["Modalidade (subtipo)", (tipos||[]).find(t => String(t.id_tipo_time) === String(modalSol.id_subtipo))?.descricao || "—"]] : []),
                  ["Cidade",        modalSol.cidade || "—"],
                  ["Fundação",      modalSol.data_fundacao ? new Date(modalSol.data_fundacao+"T12:00:00").toLocaleDateString("pt-BR") : "—"],
                  ["Responsável",   modalSol.nome_responsavel],
                  ["E-mail",        modalSol.email_responsavel],
                  ["Telefone",      modalSol.telefone],
                ].map(([k,v]) => (
                  <div key={k}>
                    <span style={{ color:C.dim }}>{k}: </span>
                    <span style={{ color:C.cream, fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões */}
            <div>
              <div style={{ fontSize:11, color:C.gold, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>
                Permissões do Admin
              </div>
              <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                <Btn variant="secondary" style={{ fontSize:11, padding:"4px 12px" }}
                  onClick={() => { const p={}; MODULOS_ADMIN.forEach(m=>{p[m.id]={ver:true,editar:true}}); setPermsForm(p); }}>
                  ✅ Liberar tudo
                </Btn>
                <Btn variant="secondary" style={{ fontSize:11, padding:"4px 12px", color:C.loss }}
                  onClick={() => { const p={}; MODULOS_ADMIN.forEach(m=>{p[m.id]={ver:false,editar:false}}); setPermsForm(p); }}>
                  🔒 Bloquear tudo
                </Btn>
              </div>
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr style={{ background:C.surf2 }}>
                  {["Módulo","Ver","Editar"].map(h => (
                    <th key={h} style={{ padding:"8px 12px", textAlign: h==="Módulo"?"left":"center", fontSize:10, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {MODULOS_ADMIN.map((m,i) => {
                    const p = permsForm[m.id] || { ver:true, editar:true };
                    return (
                      <tr key={m.id} style={{ background:i%2===0?C.surface:C.bg }}>
                        <td style={{ padding:"8px 12px", color:C.cream, fontWeight:600 }}>{m.label}</td>
                        <td style={{ padding:"8px 12px", textAlign:"center" }}>
                          <button onClick={() => togglePerm(m.id, 'pode_ver')}
                            style={{ width:32, height:18, borderRadius:9, border:"none", cursor:"pointer",
                              background:p.ver?C.win:C.dim, position:"relative" }}>
                            <span style={{ position:"absolute", top:1, left:p.ver?14:2,
                              width:14, height:14, borderRadius:"50%", background:"white", display:"block" }}/>
                          </button>
                        </td>
                        <td style={{ padding:"8px 12px", textAlign:"center" }}>
                          <button onClick={() => p.ver && togglePerm(m.id, 'pode_editar')}
                            style={{ width:32, height:18, borderRadius:9, border:"none",
                              cursor:p.ver?"pointer":"not-allowed",
                              background:p.editar&&p.ver?C.gold:C.dim,
                              position:"relative", opacity:p.ver?1:0.4 }}>
                            <span style={{ position:"absolute", top:1, left:p.editar&&p.ver?14:2,
                              width:14, height:14, borderRadius:"50%", background:"white", display:"block" }}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>

            {/* Observações */}
            <div>
              <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Observações (obrigatório para recusar)</div>
              <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
                placeholder="Mensagem para o solicitante..."
                style={{ width:"100%", background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8,
                  color:C.cream, fontFamily:"inherit", fontSize:12, padding:"10px 12px",
                  resize:"vertical", boxSizing:"border-box", outline:"none" }}/>
            </div>

            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={() => setModalSol(null)}>Cancelar</Btn>
              <Btn variant="danger" onClick={recusar} disabled={saving} style={{ fontSize:12 }}>
                ❌ Recusar
              </Btn>
              <Btn onClick={aprovar} disabled={saving}>
                {saving ? "Processando..." : "✅ Aprovar e Criar Admin"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// CONFIGURAÇÕES GLOBAIS DO SISTEMA
// ══════════════════════════════════════════════════════════════
const CONFIGS_LABEL = {
  "cadastro_time_ativo": {
    label: "Cadastro de Times",
    desc:  "Exibe o botão '🏆 Cadastrar meu Time' no app público",
    icon:  "🏆",
  },
  "sistema_manutencao": {
    label: "Modo Manutenção",
    desc:  "Bloqueia TODO o acesso (público e admin) exibindo tela de manutenção",
    icon:  "🔧",
  },
};

function ConfigSistema({ show }) {
  const { data: configs, reload } = useQuery(() =>
    api.get(`config_sistema?select=*&order=chave.asc`)
  );
  const [saving, setSaving] = useState(null);
  const [niveis, setNiveis] = useState({});
  const [raioPadrao, setRaioPadrao] = useState("");

  // Sincronizar valores de níveis para edição local
  useEffect(() => {
    if (configs) {
      const n = {};
      configs.filter(c => c.chave.startsWith("mensalidade_nivel_")).forEach(c => {
        n[c.chave] = c.valor;
      });
      setNiveis(n);
      const r = configs.find(c => c.chave === "raio_busca_padrao_km");
      if (r) setRaioPadrao(r.valor);
    }
  }, [configs]);

  async function salvarRaioPadrao() {
    setSaving("raio_busca_padrao_km");
    try {
      await api.patch(`config_sistema?chave=eq.raio_busca_padrao_km`, {
        valor: String(parseInt(raioPadrao) || 50), atualizado_em: new Date().toISOString(),
      });
      show("Raio padrão salvo!"); reload();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(null); }
  }

  async function toggle(cfg) {
    setSaving(cfg.chave);
    try {
      const atual = String(cfg.valor ?? "").trim().toLowerCase();
      const estaAtivo = atual === "true" || atual === "1";
      const novoValor = estaAtivo ? "false" : "true";
      await api.patch(`config_sistema?chave=eq.${cfg.chave}`, {
        valor: novoValor, atualizado_em: new Date().toISOString(),
      });
      show(`${CONFIGS_LABEL[cfg.chave]?.label || cfg.chave}: ${novoValor === "true" ? "Ativado ✅" : "Desativado 🔒"}`);
      reload();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(null); }
  }

  async function salvarNivel(chave) {
    setSaving(chave);
    try {
      await api.patch(`config_sistema?chave=eq.${chave}`, {
        valor: String(niveis[chave] || "0"), atualizado_em: new Date().toISOString(),
      });
      show("Valor salvo!"); reload();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(null); }
  }

  const ehBooleano = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "true" || s === "false" || s === "1" || s === "0";
  };
  const ehAtivo = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "true" || s === "1";
  };
  const toggles = (configs||[]).filter(c => !c.chave.startsWith("mensalidade_nivel_") && ehBooleano(c.valor));
  const niveisList = (configs||[]).filter(c => c.chave.startsWith("mensalidade_nivel_"))
    .sort((a,b) => parseInt(a.chave.split("_")[2]) - parseInt(b.chave.split("_")[2]));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Toggles */}
      <Card style={{ padding:24, maxWidth:600 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.cream, marginBottom:20,
          borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>
          ⚙️ Configurações Globais do Sistema
        </div>
        {toggles.length === 0 && (
          <div style={{ color:C.dim, fontSize:13 }}>Nenhuma configuração encontrada.</div>
        )}
        {toggles.map(cfg => {
          const meta = CONFIGS_LABEL[cfg.chave] || { label: cfg.chave, desc: cfg.descricao, icon: "⚙️" };
          const ativo = ehAtivo(cfg.valor);
          return (
            <div key={cfg.chave} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"16px 0", borderBottom:`1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.cream }}>{meta.icon} {meta.label}</div>
                <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>{meta.desc}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                <span style={{ fontSize:11, color: ativo ? C.win : C.dim, fontWeight:700 }}>{ativo ? "Ativo" : "Inativo"}</span>
                <button onClick={() => toggle(cfg)} disabled={saving === cfg.chave}
                  style={{ width:48, height:26, borderRadius:13, border:"none", cursor:"pointer",
                    background: ativo ? C.win : C.dim, position:"relative", opacity: saving === cfg.chave ? 0.5 : 1 }}>
                  <span style={{ position:"absolute", top:3, left: ativo ? 24 : 3,
                    width:20, height:20, borderRadius:"50%", background:"white", display:"block" }}/>
                </button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Níveis de Mensalidade */}
      <Card style={{ padding:24, maxWidth:600 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.cream, marginBottom:8,
          borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>
          💰 Níveis de Mensalidade dos Times
        </div>
        <div style={{ fontSize:12, color:C.dim, marginBottom:16, paddingLeft:10 }}>
          Defina o valor mensal de cada nível. Cada time é associado a um nível no cadastro.
        </div>
        {niveisList.map(cfg => {
          const nivel = cfg.chave.split("_")[2];
          return (
            <div key={cfg.chave} style={{ display:"flex", alignItems:"center", gap:12,
              padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ width:90, fontSize:13, fontWeight:700, color:C.cream }}>Nível {nivel}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6, flex:1 }}>
                <span style={{ fontSize:13, color:C.dim }}>R$</span>
                <input type="number" min="0" step="0.01"
                  value={niveis[cfg.chave] ?? ""}
                  onChange={e => setNiveis(prev => ({ ...prev, [cfg.chave]: e.target.value }))}
                  style={{ width:120, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8,
                    color:C.cream, fontFamily:"inherit", fontSize:14, padding:"8px 12px", outline:"none" }}/>
              </div>
              <Btn variant="secondary" style={{ fontSize:11, padding:"6px 14px" }}
                disabled={saving === cfg.chave}
                onClick={() => salvarNivel(cfg.chave)}>
                {saving === cfg.chave ? "..." : "Salvar"}
              </Btn>
            </div>
          );
        })}
      </Card>

      {/* Raio de busca padrão */}
      <Card style={{ padding:24, maxWidth:600 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.cream, marginBottom:8,
          borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>
          📏 Raio de Busca de Adversários
        </div>
        <div style={{ fontSize:12, color:C.dim, marginBottom:16, paddingLeft:10 }}>
          Raio padrão (km) com que novos times nascem. Cada time pode ajustar o seu depois, em Meu Time.
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0" }}>
          <div style={{ width:90, fontSize:13, fontWeight:700, color:C.cream }}>Padrão</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, flex:1 }}>
            <input type="number" min="1" step="1"
              value={raioPadrao}
              onChange={e => setRaioPadrao(e.target.value)}
              style={{ width:120, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8,
                color:C.cream, fontFamily:"inherit", fontSize:14, padding:"8px 12px", outline:"none" }}/>
            <span style={{ fontSize:13, color:C.dim }}>km</span>
          </div>
          <Btn variant="secondary" style={{ fontSize:11, padding:"6px 14px" }}
            disabled={saving === "raio_busca_padrao_km"}
            onClick={salvarRaioPadrao}>
            {saving === "raio_busca_padrao_km" ? "..." : "Salvar"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
function ModalNivelMensalidade({ time, onClose, onSalvo, show }) {
  const { data: niveis } = useQuery(() =>
    api.get(`config_sistema?chave=like.mensalidade_nivel_*&select=*`)
  );
  const [nivel, setNivel] = useState(String(time.nivel_mensalidade || 1));
  const [saving, setSaving] = useState(false);

  function valorDoNivel(n) {
    const cfg = (niveis||[]).find(c => c.chave === `mensalidade_nivel_${n}`);
    return cfg ? Number(cfg.valor) : 0;
  }

  async function salvar() {
    setSaving(true);
    try {
      await api.patch(`time?id_time=eq.${time.id_time}`, { nivel_mensalidade: Number(nivel) });
      onSalvo();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Nível de Mensalidade — ${time.nome}`} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ fontSize:13, color:C.dim }}>
          Selecione o nível de mensalidade que este time paga ao sistema.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => {
            const sel = String(n) === nivel;
            return (
              <button key={n} onClick={() => setNivel(String(n))}
                style={{ background: sel ? C.gold+"22" : C.surf2,
                  border:`2px solid ${sel ? C.gold : C.border}`, borderRadius:8,
                  padding:"12px", cursor:"pointer", textAlign:"left",
                  fontFamily:"inherit" }}>
                <div style={{ fontSize:13, fontWeight:700, color: sel ? C.gold : C.cream }}>Nível {n}</div>
                <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>
                  R$ {valorDoNivel(n).toFixed(2).replace(".", ",")}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar Nível"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// CONTROLE DE MENSALIDADES DOS TIMES (cobrança do sistema)
// ══════════════════════════════════════════════════════════════
const STATUS_MT = {
  pago:     { label:"Pago",     cor:C.win,  icon:"✅" },
  parcial:  { label:"Parcial",  cor:C.gold, icon:"⚠️" },
  nao_pago: { label:"Não Pago", cor:C.loss, icon:"❌" },
  isento:   { label:"Isento",   cor:C.dim,  icon:"🔵" },
};
const MESES_MT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function fmtBRL(v) {
  return v != null ? `R$ ${Number(v).toFixed(2).replace(".", ",")}` : "—";
}

function CrudMensalidadeTimes({ show }) {
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1);
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [modalPag, setModalPag] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingComp, setUploadingComp] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [abaRel, setAbaRel] = useState("mensal");

  const { data: times } = useQuery(() =>
    api.get(`time?select=id_time,nome,nivel_mensalidade,status&order=nome.asc`)
  );
  const { data: niveis } = useQuery(() =>
    api.get(`config_sistema?chave=like.mensalidade_nivel_*&select=*`)
  );
  const { data: pagamentos, reload: reloadPag } = useQuery(() =>
    api.get(`mensalidade_time?mes=eq.${mesSel}&ano=eq.${anoSel}&select=*`),
    [mesSel, anoSel]
  );
  const { data: todasMensTimes } = useQuery(() =>
    api.get(`mensalidade_time?select=*&order=ano.desc,mes.desc`)
  );

  function valorNivel(n) {
    const cfg = (niveis||[]).find(c => c.chave === `mensalidade_nivel_${n}`);
    return cfg ? Number(cfg.valor) : 0;
  }

  const timesComStatus = (times||[]).map(t => {
    const pag = (pagamentos||[]).find(p => p.id_time === t.id_time);
    const esperado = valorNivel(t.nivel_mensalidade || 1);
    return { ...t, pag: pag || null, status: pag?.status || "nao_pago", esperado };
  });

  const filtrados = filtroStatus === "todos"
    ? timesComStatus
    : timesComStatus.filter(t => t.status === filtroStatus);

  // Totais
  const totalEsperado = timesComStatus
    .filter(t => t.status !== "isento")
    .reduce((s, t) => s + (t.pag?.valor_esperado ?? t.esperado), 0);
  const totalRecebido = timesComStatus.reduce((s, t) => s + (t.pag?.valor_pago || 0), 0);
  const totalPendente = timesComStatus
    .filter(t => t.status === "nao_pago" || t.status === "parcial")
    .reduce((s, t) => s + ((t.pag?.valor_esperado ?? t.esperado) - (t.pag?.valor_pago || 0)), 0);

  function abrirModal(t) {
    setForm({
      id_time: t.id_time,
      mes: mesSel, ano: anoSel,
      status: t.pag?.status || "pago",
      valor_esperado: t.pag?.valor_esperado ?? t.esperado,
      valor_pago: t.pag?.valor_pago ?? t.esperado,
      data_pagamento: t.pag?.data_pagamento || new Date().toISOString().split("T")[0],
      comprovante_url: t.pag?.comprovante_url || "",
      observacoes: t.pag?.observacoes || "",
      _nome: t.nome,
      _id_mens: t.pag?.id_mensalidade_time,
    });
    setModalPag(t);
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function uploadComprovante(file) {
    if (!file) return;
    setUploadingComp(true);
    try {
      const ext = file.name.split(".").pop();
      const nome = `comp_${form.id_time}_${form.mes}_${form.ano}_${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/comprovantes/${nome}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SESSION_TOKEN || SUPABASE_KEY}`,
          "Content-Type": file.type,
        },
        body: file,
      });
      if (!res.ok) throw new Error("Falha no upload do comprovante.");
      const url = `${SUPABASE_URL}/storage/v1/object/public/comprovantes/${nome}`;
      setF("comprovante_url", url);
      show("Comprovante anexado!");
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setUploadingComp(false); }
  }

  async function salvar() {
    setSaving(true);
    try {
      const body = {
        id_time: form.id_time, mes: form.mes, ano: form.ano,
        status: form.status,
        valor_esperado: Number(form.valor_esperado) || 0,
        valor_pago: Number(form.valor_pago) || 0,
        data_pagamento: form.data_pagamento || null,
        comprovante_url: form.comprovante_url || null,
        observacoes: form.observacoes || null,
        atualizado_em: new Date().toISOString(),
      };
      if (form._id_mens) {
        await api.patch(`mensalidade_time?id_mensalidade_time=eq.${form._id_mens}`, body);
      } else {
        await api.post(`mensalidade_time`, body);
      }
      show("Pagamento salvo!"); setModalPag(null); reloadPag();
    } catch(e) { show("Erro: " + e.message, "error"); }
    finally { setSaving(false); }
  }

  async function marcarPago(t) {
    const body = {
      id_time: t.id_time, mes: mesSel, ano: anoSel, status: "pago",
      valor_esperado: t.esperado, valor_pago: t.esperado,
      data_pagamento: new Date().toISOString().split("T")[0],
      atualizado_em: new Date().toISOString(),
    };
    try {
      if (t.pag?.id_mensalidade_time) {
        await api.patch(`mensalidade_time?id_mensalidade_time=eq.${t.pag.id_mensalidade_time}`, body);
      } else {
        await api.post(`mensalidade_time`, body);
      }
      show(`${t.nome}: Pago ✅`); reloadPag();
    } catch(e) { show("Erro: " + e.message, "error"); }
  }

  // Inadimplentes — times com 2+ meses em aberto
  const inadimplentes = (times||[]).map(t => {
    const debitos = (todasMensTimes||[]).filter(m =>
      m.id_time === t.id_time && (m.status === "nao_pago" || m.status === "parcial")
    );
    const totalDev = debitos.reduce((s,m) => s + ((m.valor_esperado||0) - (m.valor_pago||0)), 0);
    return { ...t, debitos, totalDev };
  }).filter(t => t.debitos.length >= 2);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Abas */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {[{ id:"mensal", label:"📋 Controle Mensal" }, { id:"inadimplentes", label:"🚨 Inadimplentes" }, { id:"relatorio", label:"📊 Relatório" }].map(a => (
          <button key={a.id} onClick={() => setAbaRel(a.id)}
            style={{ background: abaRel===a.id ? C.gold : C.surface, color: abaRel===a.id ? "#0B3D2E" : C.dim,
              border:`1px solid ${abaRel===a.id ? C.gold : C.border}`, borderRadius:8, padding:"8px 18px",
              fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
            {a.label}
          </button>
        ))}
      </div>

      {abaRel === "mensal" && (<>
      {/* Seletor mês/ano + resumo */}
      <Card style={{ padding:"16px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => { let m=mesSel-1,a=anoSel; if(m<1){m=12;a--;} setMesSel(m); setAnoSel(a); }}
              style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, cursor:"pointer", padding:"4px 12px", fontFamily:"inherit", fontSize:16 }}>‹</button>
            <div style={{ textAlign:"center", minWidth:160 }}>
              <div style={{ fontSize:18, fontWeight:800, color:C.cream }}>{MESES_MT[mesSel-1]} {anoSel}</div>
              <div style={{ fontSize:11, color:C.dim }}>Mensalidade dos times ao sistema</div>
            </div>
            <button onClick={() => { let m=mesSel+1,a=anoSel; if(m>12){m=1;a++;} setMesSel(m); setAnoSel(a); }}
              style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, cursor:"pointer", padding:"4px 12px", fontFamily:"inherit", fontSize:16 }}>›</button>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            {[
              { label:"Previsto",  valor:fmtBRL(totalEsperado), cor:C.cream },
              { label:"Recebido",  valor:fmtBRL(totalRecebido), cor:C.win },
              { label:"A Receber", valor:fmtBRL(totalPendente), cor: totalPendente>0 ? C.loss : C.win },
            ].map(s => (
              <div key={s.label} style={{ textAlign:"center", background:C.surf2, borderRadius:8, padding:"10px 16px" }}>
                <div style={{ fontSize:16, fontWeight:800, color:s.cor }}>{s.valor}</div>
                <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Filtros */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {[["todos","Todos",C.cream], ...Object.entries(STATUS_MT).map(([k,v])=>[k,v.label,v.cor])].map(([k,l,c]) => (
          <button key={k} onClick={() => setFiltroStatus(k)}
            style={{ background: filtroStatus===k ? c+"33" : C.surface, color: filtroStatus===k ? c : C.dim,
              border:`1px solid ${filtroStatus===k ? c : C.border}`, borderRadius:8, padding:"5px 14px",
              fontFamily:"inherit", fontWeight:700, fontSize:11, cursor:"pointer", textTransform:"uppercase" }}>
            {l} {k !== "todos" && `(${timesComStatus.filter(t=>t.status===k).length})`}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Time","Nível","Status","Esperado","Pago","Comprovante","Ações"].map(h => (
              <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtrados.map((t,i) => {
              const cfg = STATUS_MT[t.status] || STATUS_MT.nao_pago;
              const esperado = t.pag?.valor_esperado ?? t.esperado;
              const pago = t.pag?.valor_pago || 0;
              return (
                <tr key={t.id_time} style={{ background:i%2===0?C.surface:C.bg }}>
                  <td style={{ padding:"11px 14px", fontWeight:700, color:C.cream }}>{t.nome}</td>
                  <td style={{ padding:"11px 14px", color:C.dim }}>Nível {t.nivel_mensalidade||1}</td>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ background:cfg.cor+"22", color:cfg.cor, border:`1px solid ${cfg.cor}44`, borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  <td style={{ padding:"11px 14px", color:C.dim }}>{t.status==="isento" ? "—" : fmtBRL(esperado)}</td>
                  <td style={{ padding:"11px 14px", color:C.win, fontWeight:700 }}>{pago>0 ? fmtBRL(pago) : "—"}</td>
                  <td style={{ padding:"11px 14px" }}>
                    {t.pag?.comprovante_url
                      ? <a href={t.pag.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ color:C.gold, fontSize:12, textDecoration:"none" }}>📎 Ver</a>
                      : <span style={{ color:C.dim, fontSize:12 }}>—</span>}
                  </td>
                  <td style={{ padding:"11px 14px", display:"flex", gap:6 }}>
                    {t.status !== "pago" && t.status !== "isento" && (
                      <Btn style={{ fontSize:11, padding:"4px 10px", background:C.win, color:"white" }}
                        onClick={() => marcarPago(t)}>✅ Pago</Btn>
                    )}
                    <Btn variant="secondary" style={{ fontSize:11, padding:"4px 10px" }}
                      onClick={() => abrirModal(t)}>Detalhes</Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </Card>
      </>)}

      {/* ── ABA INADIMPLENTES ── */}
      {abaRel === "inadimplentes" && (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.cream }}>🚨 Times Inadimplentes — 2 ou mais meses em aberto</div>
            <span style={{ background:C.loss+"22", color:C.loss, border:`1px solid ${C.loss}44`, borderRadius:8, padding:"4px 14px", fontSize:13, fontWeight:800 }}>
              {inadimplentes.length} time(s)
            </span>
          </div>
          {inadimplentes.length === 0 ? (
            <div style={{ padding:32, textAlign:"center", color:C.win, fontSize:15, fontWeight:700 }}>
              🎉 Nenhum time inadimplente! Todos em dia.
            </div>
          ) : (
            <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:C.surf2 }}>
                {["Time","Meses em Aberto","Débito Total","Qtde"].map(h => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {inadimplentes.map((t,i) => (
                  <tr key={t.id_time} style={{ background:i%2===0?C.surface:C.bg }}>
                    <td style={{ padding:"12px 14px", fontWeight:700, color:C.cream }}>{t.nome}</td>
                    <td style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {t.debitos.map(d => (
                          <span key={d.id_mensalidade_time} style={{ background:C.loss+"22", color:C.loss, border:`1px solid ${C.loss}44`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                            {MESES_MT[d.mes-1].slice(0,3)}/{d.ano}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding:"12px 14px", color:C.loss, fontWeight:800, fontSize:15 }}>{fmtBRL(t.totalDev)}</td>
                    <td style={{ padding:"12px 14px", color:C.dim, fontSize:12 }}>{t.debitos.length} mês(es)</td>
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
              {["Mês","Pagos","Parciais","Não Pagos","Isentos","Arrecadado","A Receber"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {MESES_MT.map((mes, idx) => {
                const m = idx + 1;
                const mens = (todasMensTimes||[]).filter(p => p.mes===m && p.ano===anoSel);
                const pagos    = mens.filter(p=>p.status==="pago").length;
                const parciais = mens.filter(p=>p.status==="parcial").length;
                const nao_pagos= mens.filter(p=>p.status==="nao_pago").length;
                const isentos  = mens.filter(p=>p.status==="isento").length;
                const arrec    = mens.reduce((s,p)=>s+(p.valor_pago||0), 0);
                const pend     = mens.filter(p=>p.status==="nao_pago"||p.status==="parcial")
                                     .reduce((s,p)=>s+((p.valor_esperado||0)-(p.valor_pago||0)), 0);
                const ehAtual  = m===mesSel && anoSel===hoje.getFullYear();
                return (
                  <tr key={m} style={{ background: ehAtual ? C.gold+"11" : idx%2===0?C.surface:C.bg, cursor:"pointer" }}
                    onClick={() => { setMesSel(m); setAbaRel("mensal"); }}>
                    <td style={{ padding:"11px 14px", fontWeight: ehAtual ? 800 : 400, color: ehAtual ? C.gold : C.cream }}>
                      {mes} {ehAtual && "← atual"}
                    </td>
                    <td style={{ padding:"11px 14px", color:C.win, fontWeight:700 }}>{pagos}</td>
                    <td style={{ padding:"11px 14px", color:C.gold }}>{parciais}</td>
                    <td style={{ padding:"11px 14px", color:C.loss }}>{nao_pagos}</td>
                    <td style={{ padding:"11px 14px", color:C.dim }}>{isentos}</td>
                    <td style={{ padding:"11px 14px", color:C.win, fontWeight:700 }}>{arrec>0?fmtBRL(arrec):"—"}</td>
                    <td style={{ padding:"11px 14px", color:pend>0?C.loss:C.dim }}>{pend>0?fmtBRL(pend):"—"}</td>
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

      {/* Modal de pagamento */}
      {modalPag && (
        <Modal title={`Mensalidade — ${form._nome} — ${MESES_MT[mesSel-1]} ${anoSel}`} onClose={() => setModalPag(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Status */}
            <div>
              <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase", marginBottom:8 }}>Status</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {Object.entries(STATUS_MT).map(([k,v]) => (
                  <button key={k} onClick={() => {
                    setF("status", k);
                    if (k === "pago") setF("valor_pago", form.valor_esperado);
                    if (k === "isento") { setF("valor_esperado", 0); setF("valor_pago", 0); }
                    if (k === "nao_pago") setF("valor_pago", 0);
                  }}
                    style={{ background: form.status===k ? v.cor+"33" : C.surface,
                      color: form.status===k ? v.cor : C.dim,
                      border:`2px solid ${form.status===k ? v.cor : C.border}`,
                      borderRadius:8, padding:"8px 16px", fontFamily:"inherit", fontWeight:700,
                      fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Valores */}
            {form.status !== "isento" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Input label="Valor Esperado (R$)" type="number" min="0" step="0.01"
                  value={form.valor_esperado||""} onChange={e => setF("valor_esperado", e.target.value)}/>
                <Input label={form.status==="parcial" ? "Valor Pago (parcial)" : "Valor Pago (R$)"}
                  type="number" min="0" step="0.01"
                  value={form.valor_pago||""} onChange={e => setF("valor_pago", e.target.value)}/>
              </div>
            )}
            {form.status !== "isento" && form.status !== "nao_pago" && (
              <Input label="Data do Pagamento" type="date"
                value={form.data_pagamento||""} onChange={e => setF("data_pagamento", e.target.value)}/>
            )}
            {/* Comprovante */}
            {form.status !== "isento" && form.status !== "nao_pago" && (
              <div>
                <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:6 }}>Comprovante de Pagamento</div>
                {form.comprovante_url ? (
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <a href={form.comprovante_url} target="_blank" rel="noopener noreferrer"
                      style={{ color:C.gold, fontSize:13, textDecoration:"none" }}>📎 Ver comprovante anexado</a>
                    <button onClick={() => setF("comprovante_url", "")}
                      style={{ background:"none", border:"none", color:C.loss, cursor:"pointer", fontSize:12 }}>Remover</button>
                  </div>
                ) : (
                  <label style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.surf2,
                    border:`1px dashed ${C.border}`, borderRadius:8, padding:"10px 16px", cursor:"pointer", fontSize:13, color:C.dim }}>
                    {uploadingComp ? "Enviando..." : "📎 Anexar comprovante (imagem ou PDF)"}
                    <input type="file" accept="image/*,application/pdf" style={{ display:"none" }}
                      onChange={e => uploadComprovante(e.target.files[0])} disabled={uploadingComp}/>
                  </label>
                )}
              </div>
            )}
            <Input label="Observações" value={form.observacoes||""}
              onChange={e => setF("observacoes", e.target.value)}/>
            {/* Saldo */}
            {form.status !== "isento" && (
              <div style={{ background:C.surf2, borderRadius:8, padding:"12px 16px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:C.dim }}>Saldo devedor:</span>
                <span style={{ fontWeight:800, fontSize:15, color:
                  (form.valor_esperado||0)-(form.valor_pago||0) > 0 ? C.loss : C.win }}>
                  {fmtBRL((form.valor_esperado||0)-(form.valor_pago||0))}
                </span>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <Btn variant="secondary" onClick={() => setModalPag(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PÁGINA DE AJUDA DO SUPER
// ══════════════════════════════════════════════════════════════
function AjudaSuper() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:640 }}>
      <Card style={{ padding:32, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📕</div>
        <div style={{ fontSize:22, fontWeight:800, color:C.cream, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>
          Manual do Super Admin
        </div>
        <div style={{ fontSize:13, color:C.dim, marginBottom:24, lineHeight:1.7 }}>
          Guia completo de gestão do sistema: times, mensalidades, solicitações,
          tipos, configurações, permissões e os fluxos do dia a dia.
        </div>
        <a href="/manual-super.pdf?v=1.0.0" target="_blank" rel="noopener noreferrer"
          style={{ display:"inline-flex", alignItems:"center", gap:10,
            background:C.gold, color:"#0B3D2E", borderRadius:10,
            padding:"14px 28px", fontFamily:"inherit", fontWeight:800,
            fontSize:14, textDecoration:"none", textTransform:"uppercase",
            letterSpacing:"0.06em" }}>
          📥 Baixar Manual do Super (PDF)
        </a>
      </Card>

      <Card style={{ padding:24 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.gold, textTransform:"uppercase",
          letterSpacing:"0.08em", marginBottom:16, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>
          Atalhos rápidos
        </div>
        {[
          ["Aprovar um time novo","Aba Solicitações (fica vermelha quando há pendentes) → Analisar → definir permissões → Aprovar."],
          ["Registrar mensalidade","Aba Mensalidades → navegar até o mês → ✅ Pago ou Detalhes para anexar comprovante."],
          ["Suspender um time","Aba Times → Inativar. O acesso é bloqueado na hora, dados preservados."],
          ["Colocar em manutenção","Aba Configurações → Modo Manutenção. Você continua acessando o Super para desligar."],
          ["Definir valores de mensalidade","Aba Configurações → Níveis de Mensalidade → ajustar cada nível."],
        ].map(([p,r],i) => (
          <div key={i} style={{ borderBottom:`1px solid ${C.border}`, paddingBottom:12, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.cream, marginBottom:4 }}>▸ {p}</div>
            <div style={{ fontSize:12, color:C.dim, lineHeight:1.6 }}>{r}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// GESTÃO DE CIDADES (global — só super admin)
// ══════════════════════════════════════════════════════════════
function GestaoCidades({ show }) {
  const [uf, setUf] = useState("RS");
  const { data: cidades, loading, reload } = useQuery(() => uf ? api.get(`cidade?estado=eq.${uf}&select=*&order=nome.asc`) : Promise.resolve([]), [uf]);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function abrirNovo() { setForm({ nome:"", estado:uf, latitude:"", longitude:"" }); setModal("novo"); }
  function abrirEditar(c) { setForm({ ...c, latitude: c.latitude ?? "", longitude: c.longitude ?? "" }); setModal(c); }

  async function salvar() {
    if (!form.nome?.trim() || !form.estado?.trim()) { show("Informe nome e estado.", "error"); return; }
    setSaving(true);
    try {
      const body = {
        nome: form.nome.trim(),
        estado: form.estado.trim().toUpperCase().slice(0,2),
        latitude: form.latitude !== "" && form.latitude != null ? Number(form.latitude) : null,
        longitude: form.longitude !== "" && form.longitude != null ? Number(form.longitude) : null,
      };
      if (modal === "novo") await api.post("cidade", body);
      else await api.patch(`cidade?id_cidade=eq.${modal.id_cidade}`, body);
      show("Cidade salva!"); setModal(null); setUf(body.estado); reload();
    } catch (e) { show(e.message, "error"); }
    finally { setSaving(false); }
  }

  async function excluir(c) {
    if (!confirm(`Excluir a cidade "${c.nome}"? Times, campos ou adversários que apontam para ela ficarão sem cidade.`)) return;
    try { await api.delete(`cidade?id_cidade=eq.${c.id_cidade}`); show("Cidade excluída."); reload(); }
    catch (e) { show("Não foi possível excluir (pode estar em uso): " + e.message, "error"); }
  }

  const lista = (cidades||[]).filter(c => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <Card style={{ padding:24 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.cream, marginBottom:8, borderLeft:`3px solid ${C.gold}`, paddingLeft:10 }}>📍 Cidades do Brasil</div>
        <div style={{ fontSize:12, color:C.dim, marginBottom:16, paddingLeft:10 }}>
          Base global de cidades (IBGE), compartilhada por todos os times. Usada na cidade-sede, campos e adversários.
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end" }}>
          <Select label="Estado" value={uf} onChange={e => { setUf(e.target.value); setBusca(""); }} style={{ width:120 }}>
            {UFS_BR.map(u => <option key={u} value={u}>{u}</option>)}
          </Select>
          <Input label="Buscar cidade" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Digite o nome..." style={{ flex:1, minWidth:160 }} />
          <Btn onClick={abrirNovo}>+ Nova Cidade</Btn>
        </div>
        <div style={{ fontSize:12, color:C.dim, marginTop:10 }}>{lista.length} cidade{lista.length===1?"":"s"} em {uf}</div>
      </Card>

      {loading ? <Spinner /> : (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
            <thead><tr style={{ background:C.surf2 }}>
              {["Cidade","UF","Latitude","Longitude",""].map(h => <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", fontWeight:700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {lista.length === 0
                ? <tr><td colSpan={5} style={{ padding:"18px 14px", textAlign:"center", color:C.dim }}>Nenhuma cidade encontrada.</td></tr>
                : lista.map((c, i) => (
                  <tr key={c.id_cidade} style={{ background:i%2===0?C.surface:C.bg }}>
                    <td style={{ padding:"10px 14px", fontWeight:700, color:C.cream }}>{c.nome}</td>
                    <td style={{ padding:"10px 14px", color:C.dim }}>{c.estado}</td>
                    <td style={{ padding:"10px 14px", color:C.dim, fontSize:12 }}>{c.latitude ?? "—"}</td>
                    <td style={{ padding:"10px 14px", color:C.dim, fontSize:12 }}>{c.longitude ?? "—"}</td>
                    <td style={{ padding:"10px 14px", display:"flex", gap:6 }}>
                      <Btn variant="secondary" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => abrirEditar(c)}>Editar</Btn>
                      <Btn variant="danger" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => excluir(c)}>Excluir</Btn>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table></div>
        </Card>
      )}

      {modal && (
        <Modal title={modal === "novo" ? "Nova Cidade" : "Editar Cidade"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Nome *" value={form.nome||""} onChange={e => set("nome", e.target.value)} />
            <Select label="Estado *" value={form.estado||"RS"} onChange={e => set("estado", e.target.value)}>
              {UFS_BR.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
            <div style={{ display:"flex", gap:12 }}>
              <Input label="Latitude" value={form.latitude} onChange={e => set("latitude", e.target.value)} placeholder="-29.6383" style={{ flex:1 }} />
              <Input label="Longitude" value={form.longitude} onChange={e => set("longitude", e.target.value)} placeholder="-51.0069" style={{ flex:1 }} />
            </div>
            <div style={{ fontSize:11, color:C.dim }}>As coordenadas são usadas no cálculo de distância para a busca de adversários.</div>
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

// ══════════════════════════════════════════════════════════════
// CRUD TIPOS DE TIME
// ══════════════════════════════════════════════════════════════
function GestaoPosicoesTipo({ tipo, show, onClose }) {
  const { data: posicoes, loading, reload } = useQuery(() => api.get(`posicao?id_tipo_time=eq.${tipo.id_tipo_time}&select=*&order=ordem.asc,nome.asc`), [tipo]);
  const [form, setForm] = useState(null); // {nome, ordem, id_posicao_pai, descricao} ou null
  const [saving, setSaving] = useState(false);
  const lista = posicoes || [];
  const grupos = lista.filter(p => !p.id_posicao_pai);

  function abrirNovo() { setForm({ nome:"", ordem:"", id_posicao_pai:"", descricao:"" }); }
  function abrirEditar(p) { setForm({ ...p, id_posicao_pai: p.id_posicao_pai ? String(p.id_posicao_pai) : "", ordem: p.ordem ?? "" }); }

  async function salvar() {
    if (!form.nome?.trim()) { show("Informe o nome da posição."); return; }
    setSaving(true);
    try {
      const body = {
        nome: form.nome.trim(),
        descricao: form.descricao || null,
        ordem: form.ordem !== "" ? Number(form.ordem) : null,
        id_posicao_pai: form.id_posicao_pai ? Number(form.id_posicao_pai) : null,
        id_tipo_time: tipo.id_tipo_time,
      };
      if (form.id_posicao) await api.patch(`posicao?id_posicao=eq.${form.id_posicao}`, body);
      else await api.post(`posicao`, body);
      show("Posição salva!"); setForm(null); reload();
    } catch(e) { show("Erro: " + e.message); }
    finally { setSaving(false); }
  }

  async function excluir(p) {
    if (!confirm(`Excluir a posição "${p.nome}"? Jogadores que a usam ficarão sem posição.`)) return;
    try { await api.delete(`posicao?id_posicao=eq.${p.id_posicao}`); show("Posição excluída."); reload(); }
    catch(e) { show("Erro ao excluir: " + e.message); }
  }

  return (
    <Modal title={`Posições — ${tipo.descricao}`} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ fontSize:13, color:C.dim }}>
          Defina as posições disponíveis para times do tipo <b style={{color:C.cream}}>{tipo.descricao}</b>.
          Você pode criar posições simples (planas) ou agrupá-las indicando um grupo (posição-pai).
        </div>
        {loading ? <Spinner/> : (
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            {lista.length === 0 && <div style={{ padding:16, textAlign:"center", color:C.dim, fontSize:13 }}>Nenhuma posição cadastrada para este tipo.</div>}
            {lista.map(p => (
              <div key={p.id_posicao} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontSize:13, color:C.cream }}>
                  {p.id_posicao_pai && <span style={{ color:C.dim }}>↳ </span>}
                  {p.nome}
                  {p.ordem != null && <span style={{ color:C.dim, fontSize:11 }}> (ordem {p.ordem})</span>}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"3px 8px" }} onClick={() => abrirEditar(p)}>Editar</Btn>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"3px 8px", color:C.loss }} onClick={() => excluir(p)}>Excluir</Btn>
                </div>
              </div>
            ))}
          </div>
        )}

        {form ? (
          <div style={{ border:`1px solid ${C.gold}`, borderRadius:8, padding:12, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.gold, textTransform:"uppercase" }}>{form.id_posicao ? "Editar posição" : "Nova posição"}</div>
            <Input label="Nome *" value={form.nome} onChange={e => setForm(f => ({...f, nome:e.target.value}))} placeholder="Ex: Goleiro, Fixo, Ala, Pivô"/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Input label="Ordem" type="number" value={form.ordem} onChange={e => setForm(f => ({...f, ordem:e.target.value}))} placeholder="Ex: 1"/>
              <Select label="Grupo (opcional)" value={form.id_posicao_pai} onChange={e => setForm(f => ({...f, id_posicao_pai:e.target.value}))}>
                <option value="">Sem grupo (plana)</option>
                {grupos.filter(g => g.id_posicao !== form.id_posicao).map(g => <option key={g.id_posicao} value={g.id_posicao}>{g.nome}</option>)}
              </Select>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <Btn variant="secondary" onClick={() => setForm(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar posição"}</Btn>
            </div>
          </div>
        ) : (
          <Btn onClick={abrirNovo}>+ Nova posição</Btn>
        )}
      </div>
    </Modal>
  );
}

function CrudTipoTime({ show }) {
  const { data: tipos, loading, reload } = useQuery(() => api.get(`tipo_time?select=*&order=id_tipo_time.asc`));
  const { toast } = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [gerenciarPos, setGerenciarPos] = useState(null); // tipo cujo gerenciador de posições está aberto

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function abrirNovo() {
    setForm({ descricao:"", status:"Ativo", numero_titulares:11, quantidade_periodos:2, minutos_padrao_periodo:45, permite_acrescimos:"S" });
    setModal("novo");
  }

  function abrirEditar(t) {
    setForm({ ...t });
    setModal(t);
  }

  async function salvar() {
    if (!form.descricao) { show("Descrição obrigatória"); return; }
    setSaving(true);
    try {
      const body = {
        descricao: form.descricao,
        status: form.status || "Ativo",
        numero_titulares: Number(form.numero_titulares) || 11,
        quantidade_periodos: Number(form.quantidade_periodos) || 2,
        minutos_padrao_periodo: Number(form.minutos_padrao_periodo) || 45,
        permite_acrescimos: form.permite_acrescimos || "S",
        eh_turma_fechada: !!form.eh_turma_fechada,
      };
      if (modal === "novo") {
        await api.post(`tipo_time`, body);
        show("Tipo criado!");
      } else {
        await api.patch(`tipo_time?id_tipo_time=eq.${modal.id_tipo_time}`, body);
        show("Tipo atualizado!");
      }
      setModal(null); reload();
    } catch(e) { show("Erro ao salvar: " + e.message); }
    finally { setSaving(false); }
  }

  async function alterarStatus(t) {
    const novoStatus = t.status === "Ativo" ? "Inativo" : "Ativo";
    await api.patch(`tipo_time?id_tipo_time=eq.${t.id_tipo_time}`, { status: novoStatus });
    show(`${t.descricao}: ${novoStatus}`); reload();
  }

  if (loading) return <Spinner/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:16, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:C.cream }}>⚽ Tipos de Time</div>
          <Btn onClick={abrirNovo}>+ Novo Tipo</Btn>
        </div>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Descrição","Status","Titulares","Períodos","Min/Período","Acrésc.","Ações"].map(h => (
              <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(tipos||[]).map((t,i) => (
              <tr key={t.id_tipo_time} style={{ background:i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"13px 16px", fontWeight:700, color:C.cream }}>{t.descricao}</td>
                <td style={{ padding:"13px 16px" }}>
                  <span style={{ color: t.status==="Ativo" ? C.win : C.dim, fontWeight:700, fontSize:12 }}>
                    {t.status==="Ativo" ? "🟢 Ativo" : "🔴 Inativo"}
                  </span>
                </td>
                <td style={{ padding:"13px 16px", color:C.dim }}>{t.numero_titulares}</td>
                <td style={{ padding:"13px 16px", color:C.dim }}>{t.quantidade_periodos}</td>
                <td style={{ padding:"13px 16px", color:C.dim }}>{t.minutos_padrao_periodo} min</td>
                <td style={{ padding:"13px 16px", color:C.dim }}>{t.permite_acrescimos==="S" ? "Sim" : "Não"}</td>
                <td style={{ padding:"13px 16px", display:"flex", gap:8 }}>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px" }} onClick={() => abrirEditar(t)}>Editar</Btn>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px", color:C.gold }} onClick={() => setGerenciarPos(t)}>⚽ Posições</Btn>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px", color: t.status==="Ativo" ? C.loss : C.win }} onClick={() => alterarStatus(t)}>
                    {t.status==="Ativo" ? "Inativar" : "Ativar"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>

      {modal && (
        <Modal title={modal==="novo" ? "Novo Tipo de Time" : "Editar Tipo de Time"} onClose={() => setModal(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Input label="Descrição *" value={form.descricao||""} onChange={e => set("descricao", e.target.value)}/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase", marginBottom:4 }}>Status</div>
                <select value={form.status||"Ativo"} onChange={e => set("status", e.target.value)}
                  style={{ width:"100%", background:C.surf2, color:C.cream, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", fontFamily:"inherit", fontSize:13 }}>
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:C.dim, textTransform:"uppercase", marginBottom:4 }}>Permite Acréscimos</div>
                <select value={form.permite_acrescimos||"S"} onChange={e => set("permite_acrescimos", e.target.value)}
                  style={{ width:"100%", background:C.surf2, color:C.cream, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", fontFamily:"inherit", fontSize:13 }}>
                  <option value="S">Sim</option>
                  <option value="N">Não</option>
                </select>
              </div>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:10, background:C.surf2, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", cursor:"pointer", fontSize:13 }}>
              <input type="checkbox" checked={!!form.eh_turma_fechada} onChange={e => set("eh_turma_fechada", e.target.checked)} style={{ width:18, height:18, accentColor:C.gold }} />
              <span><strong style={{ color:C.cream }}>É turma fechada</strong> <span style={{ color:C.dim }}>— grupo que joga entre si (racha/pelada). Times do tipo turma fechada escolhem um subtipo e usam encontros em vez de partidas.</span></span>
            </label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:12 }}>
              <Input label="Nº Titulares"    type="number" value={form.numero_titulares||""} onChange={e => set("numero_titulares", e.target.value)}/>
              <Input label="Qtd Períodos"    type="number" value={form.quantidade_periodos||""} onChange={e => set("quantidade_periodos", e.target.value)}/>
              <Input label="Min por Período" type="number" value={form.minutos_padrao_periodo||""} onChange={e => set("minutos_padrao_periodo", e.target.value)}/>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:8 }}>
              <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {gerenciarPos && (
        <GestaoPosicoesTipo tipo={gerenciarPos} show={show} onClose={() => setGerenciarPos(null)} />
      )}
    </div>
  );
}

export default function SuperApp() {
  const [session, setSession] = useState(SESSION_TOKEN ? {access_token: SESSION_TOKEN} : null);
  const [sessaoExpirou, setSessaoExpirou] = useState(false);
  const APP_VERSION = process.env.REACT_APP_VERSION || "1.0.0";

  useEffect(() => {
    const handler = () => { setSessaoExpirou(true); setSession(null); };
    window.addEventListener("ndc-sessao-expirada", handler);
    return () => window.removeEventListener("ndc-sessao-expirada", handler);
  }, []);

  if (!session) return <LoginSuper onLogin={(r) => { setSessaoExpirou(false); setSession(r); }} aviso={sessaoExpirou ? "Sua sessão expirou. Faça login novamente." : ""}/>;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif", color:C.cream }}>
      <header style={{ background:"#060F1E", borderBottom:`3px solid ${C.gold}`, padding:"0 24px", display:"flex", alignItems:"center", gap:16, height:64, position:"sticky", top:0, zIndex:100, boxShadow:"0 4px 20px #00000066" }}>
        <img src="/logo.png" alt="Nerd do Campo" style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}` }}/>
        <div style={{ fontSize:18, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:C.cream }}>Nerd do Campo</div>
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", background:C.gold+"22", border:`1px solid ${C.gold}44`, borderRadius:6, padding:"2px 8px" }}>Super Admin</div>
        <BadgePendentes/>
        {process.env.REACT_APP_ENV === "development" && (
          <div style={{ fontSize:10, color:"#ff6b6b", textTransform:"uppercase", background:"#ff6b6b22", border:"1px solid #ff6b6b44", borderRadius:6, padding:"2px 8px", fontWeight:700 }}>🧪 DEV</div>
        )}
        <div style={{ fontSize:10, color:C.dim }}>v{APP_VERSION}</div>
        <div style={{ marginLeft:"auto" }}>
          <Btn variant="danger" style={{ fontSize:11, padding:"6px 12px" }} onClick={()=>{ SESSION_TOKEN=null; REFRESH_TOKEN=null; sessionStorage.removeItem("ndc_super_token"); sessionStorage.removeItem("ndc_super_refresh"); setSession(null); }}>Sair</Btn>
        </div>
      </header>
      <main style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px" }}>
        <DashboardSuper/>
      </main>
    </div>
  );
}
