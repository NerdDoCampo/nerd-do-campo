import { useState, useEffect, useCallback } from "react";

// ── Supabase ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://nxztffulmvohduvudbhg.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";

let SESSION_TOKEN = sessionStorage.getItem("ndc_super_token") || null;

async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sb(path, opts = {}) {
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

function useQuery(fetcher, deps=[]) {
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
  return { data, loading, error, reload: load };
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };
  return { toast, show };
}

// ── LOGIN SUPER ───────────────────────────────────────────────
function LoginSuper({ onLogin }) {
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
      sessionStorage.setItem("ndc_super_token", res.access_token);
      // Verificar se é superadmin
      try {
        const check = await api.get(`usuario_time?user_id=eq.${res.user.id}&role=eq.superadmin`);
        if (check?.length > 0) { onLogin(res); }
        else { SESSION_TOKEN = null; sessionStorage.removeItem("ndc_super_token"); setErro("Acesso negado. Você não é super-admin."); }
      } catch(e) { setErro("Erro ao verificar permissões."); }
    } else { setErro("E-mail ou senha incorretos."); }
  }

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif" }}>
      <Card style={{ width:380, padding:40 }}>
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
  const { toast, show } = useToast();
  const [modalNovoTime, setModalNovoTime]     = useState(false);
  const [modalNovoUser, setModalNovoUser]     = useState(false);
  const [timeSelecionado, setTimeSelecionado] = useState(null);
  const [modalPerms, setModalPerms]           = useState(null); // { user_id, id_time, nome }
  const [aba, setAba] = useState("times");

  const totalTimes    = (times||[]).length;
  const totalUsuarios = (usuarios||[]).length;
  const totalAdmins   = (usuarios||[]).filter(u=>u.role==="admin").length;

  if (loading) return <Spinner/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <Toast {...(toast||{msg:null})}/>

      {/* Abas */}
      <div style={{ display:"flex", gap:8 }}>
        {[
          { id:"times", label:"🏆 Times" },
          { id:"tipos", label:"⚽ Tipos de Time" },
        ].map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            style={{ background: aba===a.id ? C.gold : C.surface, color: aba===a.id ? "#0B3D2E" : C.dim,
              border:`1px solid ${aba===a.id ? C.gold : C.border}`, borderRadius:8, padding:"8px 18px",
              fontFamily:"inherit", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase" }}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "tipos" && <CrudTipoTime show={show}/>}
      {aba === "times" && <>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
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
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead><tr style={{ background:C.surf2 }}>
            {["Time","Temporadas","Admins","Fundação","Ações"].map(h => <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {(times||[]).map((t,i) => (
              <tr key={t.id_time} style={{ background:i%2===0?C.surface:C.bg }}>
                <td style={{ padding:"13px 16px", fontWeight:700, color:C.cream }}>{t.nome}</td>
                <td style={{ padding:"13px 16px", color:C.dim }}>{t.temporada?.length||0}</td>
                <td style={{ padding:"13px 16px", color:C.dim }}>{(t.usuario_time||[]).filter(u=>u.role==="admin").length}</td>
                <td style={{ padding:"13px 16px", color:C.dim, fontSize:13 }}>{t.data_fundacao?new Date(t.data_fundacao).getFullYear():"—"}</td>
                <td style={{ padding:"13px 16px" }}>
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 12px" }} onClick={()=>{ setTimeSelecionado(t); setModalNovoUser(true); }}>
                    + Admin
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      </>}
    </div>
  );
}

// ── TABELA DE USUÁRIOS ────────────────────────────────────────
function UsuariosTable({ times, reload, show, onPermissoes }) {
  const { data: vinculos, loading, reload: reloadVinculos } = useQuery(() =>
    api.get(`vw_usuarios_time?select=*,time(nome)&order=criado_em.desc`)
  );

  async function revogar(id) {
    if (!confirm("Revogar acesso deste usuário?")) return;
    try { await api.delete(`usuario_time?id=eq.${id}`); show("Acesso revogado."); reloadVinculos(); }
    catch(e) { show(e.message, "error"); }
  }

  if (loading) return <Spinner/>;

  return (
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
      <thead><tr style={{ background:C.surf2 }}>
        {["E-mail","Último Acesso","Time","Role","Criado em","Ações"].map(h => <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>{h}</th>)}
      </tr></thead>
      <tbody>
        {(vinculos||[]).map((v,i) => (
          <tr key={v.id} style={{ background:i%2===0?C.surface:C.bg }}>
            <td style={{ padding:"12px 16px", color:C.cream, fontSize:13 }}>{v.email || v.user_id?.substring(0,8)+"..."}</td>
            <td style={{ padding:"12px 16px", color:C.dim, fontSize:12 }}>{v.last_sign_in_at ? new Date(v.last_sign_in_at).toLocaleDateString("pt-BR") : "Nunca"}</td>
            <td style={{ padding:"12px 16px", fontWeight:700, color:C.cream }}>{v.time?.nome||"—"}</td>
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
    </table>
  );
}

// ── FORM NOVO TIME ────────────────────────────────────────────
function FormNovoTime({ onSalvo, show }) {
  const { data: campos } = useQuery(() => api.get(`campo?select=*&order=nome.asc`));
  const [form, setForm] = useState({ nome:"", data_fundacao:"", numero_titulares:"11", quantidade_periodos:"2", minutos_padrao_periodo:"45", permite_acrescimos:"N", tecnico:"", presidente:"", id_campo:"" });
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
        id_campo: form.id_campo?Number(form.id_campo):null,
      });
      // Criar temporada inicial automaticamente
      const ano = new Date().getFullYear();
      await api.post("temporada", {
        nome: `Temporada ${ano}`,
        id_time: time[0].id_time,
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Input label="Data Fundação" type="date" value={form.data_fundacao} onChange={e=>set("data_fundacao",e.target.value)}/>
        <Select label="Campo Principal" value={form.id_campo} onChange={e=>set("id_campo",e.target.value)}>
          <option value="">Selecione...</option>
          {(campos||[]).map(c=><option key={c.id_campo} value={c.id_campo}>{c.nome}</option>)}
        </Select>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        <Input label="Nº Titulares" type="number" value={form.numero_titulares} onChange={e=>set("numero_titulares",e.target.value)}/>
        <Input label="Períodos" type="number" value={form.quantidade_periodos} onChange={e=>set("quantidade_periodos",e.target.value)}/>
        <Input label="Min/Período" type="number" value={form.minutos_padrao_periodo} onChange={e=>set("minutos_padrao_periodo",e.target.value)}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Input label="Técnico" value={form.tecnico} onChange={e=>set("tecnico",e.target.value)}/>
        <Input label="Presidente" value={form.presidente} onChange={e=>set("presidente",e.target.value)}/>
      </div>
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
            { label:"URL",  value: "nerd-do-campo.vercel.app/admin", cor: C.gold },
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
  { id:"cidades",      label:"📍 Cidades" },
  { id:"posicoes",     label:"🎯 Posições" },
  { id:"temporadas",   label:"📆 Temporadas" },
  { id:"time",         label:"⚙️ Meu Time" },
  { id:"mensalidades", label:"💰 Mensalidades" },
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
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
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
        </table>

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
// CRUD TIPOS DE TIME
// ══════════════════════════════════════════════════════════════
function CrudTipoTime({ show }) {
  const { data: tipos, loading, reload } = useQuery(() => api.get(`tipo_time?select=*&order=id_tipo_time.asc`));
  const { toast } = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);

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
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
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
                  <Btn variant="secondary" style={{ fontSize:11, padding:"5px 10px", color: t.status==="Ativo" ? C.loss : C.win }} onClick={() => alterarStatus(t)}>
                    {t.status==="Ativo" ? "Inativar" : "Ativar"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
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
    </div>
  );
}

export default function SuperApp() {
  const [session, setSession] = useState(SESSION_TOKEN ? {access_token: SESSION_TOKEN} : null);
  const APP_VERSION = process.env.REACT_APP_VERSION || "1.1.1";

  if (!session) return <LoginSuper onLogin={setSession}/>;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Oswald','Arial Narrow',Arial,sans-serif", color:C.cream }}>
      <header style={{ background:"#060F1E", borderBottom:`3px solid ${C.gold}`, padding:"0 24px", display:"flex", alignItems:"center", gap:16, height:64, position:"sticky", top:0, zIndex:100, boxShadow:"0 4px 20px #00000066" }}>
        <img src="/logo.png" alt="Nerd do Campo" style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}` }}/>
        <div style={{ fontSize:18, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:C.cream }}>Nerd do Campo</div>
        <div style={{ fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", background:C.gold+"22", border:`1px solid ${C.gold}44`, borderRadius:6, padding:"2px 8px" }}>Super Admin</div>
        {process.env.REACT_APP_ENV === "development" && (
          <div style={{ fontSize:10, color:"#ff6b6b", textTransform:"uppercase", background:"#ff6b6b22", border:"1px solid #ff6b6b44", borderRadius:6, padding:"2px 8px", fontWeight:700 }}>🧪 DEV</div>
        )}
        <div style={{ fontSize:10, color:C.dim }}>v{APP_VERSION}</div>
        <div style={{ marginLeft:"auto" }}>
          <Btn variant="danger" style={{ fontSize:11, padding:"6px 12px" }} onClick={()=>{ SESSION_TOKEN=null; sessionStorage.removeItem("ndc_super_token"); setSession(null); }}>Sair</Btn>
        </div>
      </header>
      <main style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px" }}>
        <DashboardSuper/>
      </main>
    </div>
  );
}
