
import { useState, useEffect } from "react";
import { IdiomaProvider, useIdioma, SeletorIdioma } from "./i18n";

// ── Supabase (leitura pública: avaliações aprovadas) ──
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://nxztffulmvohduvudbhg.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54enRmZnVsbXZvaGR1dnVkYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODY5ODMsImV4cCI6MjA5NTA2Mjk4M30.CwEmjukApMTJhkbKh1jlp4Q-IYrM26u-5SYx9p20nsg";
async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Conta pública de demonstração — divulgada no login, no /conheca e no app público.
const DEMO_EMAIL = "vemtestar@nerddocampo.com.br";
const DEMO_SENHA = "teste2026";
// Copia um valor solto (e-mail OU senha) para colar direto no campo.
// Usa a API moderna e cai num fallback que funciona no iOS.
async function copiarDemo(txt) {
  try { if (navigator?.clipboard) { await navigator.clipboard.writeText(txt); return true; } } catch (e) { /* cai no fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

// Bloco da conta de demonstração (usado no /conheca e no app público)
function BlocoDemo({ titulo, texto, rodape }) {
  const [copiado, setCopiado] = useState("");
  async function copiar(campo, valor) {
    const ok = await copiarDemo(valor);
    setCopiado(ok ? campo : "erro");
    setTimeout(() => setCopiado(""), 2000);
  }
  const linha = (campo, rotulo, valor) => (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0" }}>
      <span style={{ color:C.dim, fontSize:12, width:48, flexShrink:0 }}>{rotulo}</span>
      <span style={{ color:C.cream, fontFamily:"monospace", fontSize:12, flex:1, wordBreak:"break-all" }}>{valor}</span>
      <button onClick={() => copiar(campo, valor)} aria-label={`Copiar ${rotulo.toLowerCase()}`}
        style={{ background:"transparent", border:`1px solid ${C.gold}`, color:C.gold, borderRadius:6, padding:"4px 9px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0, whiteSpace:"nowrap" }}>
        {copiado === campo ? "✅" : "📋"}
      </button>
    </div>
  );
  return (
    <div style={{ border:`1px dashed ${C.gold}`, background:`${C.gold}12`, borderRadius:12, padding:"14px 16px", margin:"18px auto", maxWidth:520, textAlign:"left" }}>
      <div style={{ fontSize:14, fontWeight:800, color:C.gold, marginBottom:5 }}>{titulo}</div>
      <div style={{ fontSize:12.5, color:C.cream, lineHeight:1.5, marginBottom:10 }}>{texto}</div>
      <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 11px", marginBottom:10 }}>
        {linha("email", "E-mail", DEMO_EMAIL)}
        <div style={{ borderTop:`1px solid ${C.border}` }} />
        {linha("senha", "Senha", DEMO_SENHA)}
      </div>
      {copiado === "erro" && <div style={{ fontSize:11, color:C.dim, marginBottom:8 }}>Não deu pra copiar — segure o texto para selecionar.</div>}
      <a href="/admin" style={{ display:"block", background:C.gold, color:"#0B3D2E", borderRadius:7, padding:"10px 8px", fontSize:12.5, fontWeight:700, textAlign:"center", textDecoration:"none" }}>
        Abrir a demonstração
      </a>
      {rodape && <div style={{ fontSize:10.5, color:C.dim, marginTop:8, fontStyle:"italic", lineHeight:1.4 }}>{rodape}</div>}
    </div>
  );
}

const C = {
  bg: "#0B3D2E", surface: "#103D2A", surf2: "#174D36",
  border: "#1F5C3E", gold: "#E8A020", cream: "#F0E8D0",
  dim: "#8FAF9A", win: "#4CAF50", loss: "#E53935", draw: "#E8A020",
};

// Famílias de recursos — no tom casual do Anderson
const SECOES_POR_IDIOMA = {
  pt: [
    {
      titulo: "Antes, durante e depois do jogo",
      itens: [
        ["📅", "Calendário completo de partidas", "Monte a agenda da temporada e ainda procure adversários pelo próprio app, na sua região."],
        ["📋", "Ficha completa da partida", "Registre o esquema tático do jogo, mande o link de confirmação pré-jogo, e depois compartilhe placar, artilheiros e estatísticas. Tudo num lugar só."],
        ["🙋", "Confirmação de presença sem cadastro", "Manda um link no grupo e cada jogador toca no próprio nome: Vou, Talvez ou Não vou. Sem login, sem app pra instalar. Você já sabe quem vem antes de sair de casa."],
        ["📲", "Cards prontos pra mandar no grupo", "Resultado, convocação, escalação sorteada — o sistema gera a imagem com a marca do seu time, prontinha pra jogar no WhatsApp. Seu time com cara de profissional."],
        ["💸", "Gastos jogo a jogo", "Lançou o juiz, o transporte, a água? Cada partida tem seu controle de gastos, que já cai no caixa do time."],
      ],
    },
    {
      titulo: "O dinheiro do time, sem dor de cabeça",
      itens: [
        ["💰", "Módulo financeiro robusto", "Junta as mensalidades, os gastos das partidas e as receitas e despesas da temporada. O controle total do fluxo de caixa, sem planilha paralela."],
        ["🧾", "Mensalidades integradas", "O módulo de mensalidade completo já entra no fluxo de caixa automaticamente. Quem pagou, quem deve, tudo à mão."],
        ["🎟️", "Eventos e venda de cartões", "Aquele churras que precisa só da lista de presença? Tem. Aquele evento pra arrecadar fundos, com venda de cartões controlada por atleta E por convidado? Também tem."],
      ],
    },
    {
      titulo: "Feito pra qualquer time",
      itens: [
        ["🔒", "Seus dados, suas regras", "Está tendo uma temporada de altos e baixos e não quer compartilhar aqui? Deixe os dados privados. A escolha é sua."],
        ["🌐", "A vitrine pública do seu time", "Escudo, uniformes, elenco, artilheiros e resultados numa página que qualquer torcedor acessa. Seu time no mapa, com a cara que ele merece."],
        ["🔁", "É turma fechada? Tem também", "Times internos, rodízio, controle por total — o sistema entende quem joga entre amigos toda semana."],
        ["🎲", "Sorteio de times que acaba com a treta", "Cansou de ouvir que você montou o time pra ganhar? Deixe o sistema sortear, equilibrando posição e nível dos jogadores. Foi o sistema, não você. 😎"],
        ["👥", "Vários times, um login só", "Quer controlar mais de um time com o mesmo acesso? Sem problemas. Troque de time num clique."],
        ["👤", "Ficha cadastral completa dos jogadores", "Apelidos, contatos, aniversários — acompanhe tudo do elenco, e nunca mais esqueça o niver de ninguém."],
      ],
    },
    {
      titulo: "Pensado pra facilitar a sua vida",
      itens: [
        ["🔑", "Controle de acesso por usuário", "Você pode ser o nerd das estatísticas, e deixar outra pessoa cuidar da parte chata das finanças. Cada um vê só o que precisa."],
        ["📊", "Importe e exporte por planilha", "Já tem tudo no Excel? Importe de uma vez. Quer levar os dados pra fora? Exporte. Os cadastros ficam fáceis."],
        ["✅", "Barra de progresso do setup", "O sistema te mostra o quanto já está pronto pra usar, passo a passo, pra você não se perder no começo."],
        ["📖", "Manual e dicas dentro do app", "Um espaço só de ajuda, com o manual do usuário e dicas — sem precisar procurar em lugar nenhum."],
        ["🧩", "Sistema dinâmico", "Tudo funciona a partir dos cadastros que você mesmo faz nos dados do time. Quanto mais você preenche, mais o sistema trabalha por você."],
        ["📱", "Vira app no seu celular", "Não precisa baixar nada da loja: adicione à tela de início e o Nerd do Campo abre como um app, em tela cheia. Leve, rápido e sempre à mão."],
      ],
    },
  ],
  en: [
    {
      titulo: "Before, during, and after the match",
      itens: [
        ["📅", "Full match calendar", "Build your season's schedule and even find opponents right in the app, in your area."],
        ["📋", "Full match sheet", "Set the lineup, send the pre-match confirmation link, then share the score, top scorers, and stats. All in one place."],
        ["🙋", "No-signup attendance confirmation", "Send a link in the group chat and each player taps their own name: Going, Maybe, or Not going. No login, no app to install. You know who's coming before you leave home."],
        ["📲", "Ready-to-share cards for the group chat", "Results, call-ups, drawn lineups — the system generates the image with your team's branding, ready to post on WhatsApp. Your team looking pro."],
        ["💸", "Match-by-match expenses", "Paid the ref, the ride, the water? Every match has its own expense tracker, feeding straight into the team's cash box."],
      ],
    },
    {
      titulo: "The team's money, without the headache",
      itens: [
        ["💰", "Solid finance module", "Combines dues, match expenses, and the season's income and spending. Full cash-flow control, no side spreadsheet."],
        ["🧾", "Integrated dues", "The full dues module feeds the cash flow automatically. Who paid, who owes — all at hand."],
        ["🎟️", "Events and ticket sales", "Just need an attendance list for the cookout? Got it. Need a fundraiser with ticket sales tracked per player AND per guest? Also got it."],
      ],
    },
    {
      titulo: "Built for any team",
      itens: [
        ["🔒", "Your data, your rules", "Having an up-and-down season and don't want to share it here? Keep the data private. Your call."],
        ["🌐", "Your team's public showcase", "Crest, kits, roster, top scorers, and results on a page any fan can visit. Your team on the map, looking the way it deserves."],
        ["🔁", "Closed group? Covered too", "Internal teams, rotation, overall standings — the system gets how friends who play together every week actually work."],
        ["🎲", "Team draws that end the arguments", "Tired of hearing you stacked the teams to win? Let the system draw them, balancing position and skill level. It was the system, not you. 😎"],
        ["👥", "Several teams, one login", "Need to manage more than one team with the same account? No problem. Switch teams in one click."],
        ["👤", "Full player records", "Nicknames, contacts, birthdays — track the whole roster, and never miss anyone's birthday again."],
      ],
    },
    {
      titulo: "Built to make your life easier",
      itens: [
        ["🔑", "Per-user access control", "You can be the stats nerd and let someone else handle the boring finance stuff. Everyone sees only what they need."],
        ["📊", "Import and export via spreadsheet", "Already have everything in Excel? Import it all at once. Want to take your data elsewhere? Export it. Setup made easy."],
        ["✅", "Setup progress bar", "The system shows you how ready it is to use, step by step, so you don't get lost at the start."],
        ["📖", "Manual and tips built in", "A dedicated help space, with the user manual and tips — no need to look anywhere else."],
        ["🧩", "A system that grows with you", "Everything runs off the records you fill in for your team's data. The more you fill in, the more the system works for you."],
        ["📱", "Becomes an app on your phone", "No app store download needed: add it to your home screen and Nerd do Campo opens full-screen, like an app. Light, fast, and always at hand."],
      ],
    },
  ],
  es: [
    {
      titulo: "Antes, durante y después del partido",
      itens: [
        ["📅", "Calendario completo de partidos", "Armá la agenda de la temporada y hasta buscá rivales desde la misma app, en tu zona."],
        ["📋", "Ficha completa del partido", "Definí el esquema táctico, mandá el link de confirmación antes del partido, y después compartí el resultado, los goleadores y las estadísticas. Todo en un solo lugar."],
        ["🙋", "Confirmación de asistencia sin registro", "Mandá un link al grupo y cada jugador toca su propio nombre: Voy, Tal vez o No voy. Sin login, sin instalar nada. Ya sabés quién viene antes de salir de casa."],
        ["📲", "Tarjetas listas para el grupo", "Resultado, convocatoria, equipos sorteados — el sistema genera la imagen con la marca de tu equipo, lista para postear en WhatsApp. Tu equipo con cara de profesional."],
        ["💸", "Gastos partido por partido", "¿Pagaste el árbitro, el traslado, el agua? Cada partido tiene su propio control de gastos, que ya se suma a la caja del equipo."],
      ],
    },
    {
      titulo: "La plata del equipo, sin dolores de cabeza",
      itens: [
        ["💰", "Módulo financiero completo", "Junta las cuotas, los gastos de los partidos y los ingresos y egresos de la temporada. Control total del flujo de caja, sin planilla aparte."],
        ["🧾", "Cuotas integradas", "El módulo de cuotas completo ya se suma al flujo de caja automáticamente. Quién pagó, quién debe, todo a mano."],
        ["🎟️", "Eventos y venta de rifas", "¿Ese asado que solo necesita lista de presentes? Está. ¿Ese evento para recaudar fondos, con venta controlada por jugador Y por invitado? También está."],
      ],
    },
    {
      titulo: "Hecho para cualquier equipo",
      itens: [
        ["🔒", "Tus datos, tus reglas", "¿Estás en una temporada de altibajos y no querés compartirla acá? Dejá los datos privados. La decisión es tuya."],
        ["🌐", "La vidriera pública de tu equipo", "Escudo, camisetas, plantel, goleadores y resultados en una página que cualquier hincha puede ver. Tu equipo en el mapa, con la cara que se merece."],
        ["🔁", "¿Grupo cerrado? También lo tenemos", "Equipos internos, rotación, control por total — el sistema entiende a los que juegan entre amigos todas las semanas."],
        ["🎲", "Sorteo de equipos que termina con la polémica", "¿Cansado de que digan que armaste el equipo para ganar? Dejá que el sistema sortee, equilibrando posición y nivel de los jugadores. Fue el sistema, no vos. 😎"],
        ["👥", "Varios equipos, un solo login", "¿Necesitás manejar más de un equipo con el mismo acceso? Sin problema. Cambiá de equipo con un clic."],
        ["👤", "Ficha completa de los jugadores", "Apodos, contactos, cumpleaños — seguí todo el plantel, y no te olvides más del cumple de nadie."],
      ],
    },
    {
      titulo: "Pensado para facilitarte la vida",
      itens: [
        ["🔑", "Control de acceso por usuario", "Podés ser el nerd de las estadísticas y dejar que otra persona se encargue de la parte aburrida de las finanzas. Cada uno ve solo lo que necesita."],
        ["📊", "Importá y exportá por planilla", "¿Ya tenés todo en Excel? Importalo de una. ¿Querés llevarte los datos? Exportalos. Los registros se hacen fáciles."],
        ["✅", "Barra de progreso de la configuración", "El sistema te muestra cuánto falta para estar listo, paso a paso, para que no te pierdas al principio."],
        ["📖", "Manual y consejos dentro de la app", "Un espacio de ayuda con el manual del usuario y consejos — sin tener que buscar en ningún otro lado."],
        ["🧩", "Sistema dinámico", "Todo funciona a partir de los datos que vos mismo cargás del equipo. Cuanto más completás, más trabaja el sistema para vos."],
        ["📱", "Se convierte en app en tu celular", "No hace falta descargar nada de ninguna tienda: agregalo a la pantalla de inicio y Nerd do Campo se abre como una app, a pantalla completa. Liviano, rápido y siempre a mano."],
      ],
    },
  ],
};

// Perguntas que todo gestor faz antes de começar
const FAQ_POR_IDIOMA = {
  pt: [
    ["É de graça mesmo?", "É. O Nerd do Campo é gratuito pra usar. Sem mensalidade escondida, sem pegadinha — é só cadastrar o time e começar."],
    ["Preciso instalar algum aplicativo?", "Não. Funciona direto no navegador do celular ou do computador. Se quiser, dá pra adicionar à tela de início e usar como um app, mas é opcional."],
    ["Meus dados ficam seguros?", "Ficam. Cada time só enxerga os próprios dados, e você decide o que é público e o que é privado — inclusive temporada por temporada. Tudo salvo na nuvem, acessível de qualquer aparelho."],
    ["Serve pra turma fechada (a pelada dos amigos)?", "Serve! O sistema se adapta: times internos, rodízio, sorteio equilibrado e controle por total. Não precisa ter adversário de fora pra usar."],
  ],
  en: [
    ["Is it really free?", "It is. Nerd do Campo is free to use. No hidden fees, no catch — just sign up your team and get started."],
    ["Do I need to install an app?", "No. It runs right in your phone's or computer's browser. If you want, you can add it to your home screen and use it like an app, but that's optional."],
    ["Is my data safe?", "Yes. Each team only sees its own data, and you decide what's public and what's private — even season by season. Everything's saved in the cloud, accessible from any device."],
    ["Does it work for a closed pickup group (just friends playing)?", "It does! The system adapts: internal teams, rotation, balanced draws, and overall standings. You don't need an outside opponent to use it."],
  ],
  es: [
    ["¿Es gratis de verdad?", "Sí. Nerd do Campo es gratis para usar. Sin cuota escondida, sin trampa — solo tenés que registrar tu equipo y empezar."],
    ["¿Necesito instalar alguna aplicación?", "No. Funciona directo desde el navegador del celular o de la computadora. Si querés, podés agregarlo a la pantalla de inicio y usarlo como una app, pero es opcional."],
    ["¿Mis datos están seguros?", "Sí. Cada equipo ve solo sus propios datos, y vos decidís qué es público y qué es privado — hasta temporada por temporada. Todo guardado en la nube, accesible desde cualquier dispositivo."],
    ["¿Sirve para un grupo cerrado (la pelada de los amigos)?", "¡Sirve! El sistema se adapta: equipos internos, rotación, sorteo equilibrado y control por total. No hace falta tener rival de afuera para usarlo."],
  ],
};

// Depoimentos reais — avaliações aprovadas (só aparece com 3+, mesma regra do site)
function BlocoDepoimentos() {
  const { t } = useIdioma();
  const [lista, setLista] = useState(null);
  const [verTodas, setVerTodas] = useState(false);
  useEffect(() => {
    sb(`avaliacao?status=eq.aprovado&select=id,nota,texto,publicar_identidade,nome_exibicao,nome_time,criado_em,time(nome,escudo_url)&order=criado_em.desc`)
      .then(setLista).catch(() => setLista([]));
  }, []);
  if (!lista || lista.length < 3) return null;

  const media = (lista.reduce((s, a) => s + a.nota, 0) / lista.length).toFixed(1);
  const mostrar = verTodas ? lista.slice(0, 30) : lista.slice(0, 3);
  const estrelas = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  const tempoRel = (iso) => {
    const dias = Math.floor((new Date() - new Date(iso)) / 86400000);
    if (dias <= 0) return t("aval.hoje");
    if (dias === 1) return t("aval.ha_1_dia");
    if (dias < 30) return t("aval.ha_dias", { n: dias });
    return new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  };

  return (
    <div style={{ marginBottom:40 }}>
      <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:800, marginBottom:18, borderBottom:`1px solid ${C.border}`, paddingBottom:10 }}>{t("aval.titulo")}</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:20 }}>
        <div style={{ fontSize:52, fontWeight:900, color:C.gold, lineHeight:1 }}>{media}</div>
        <div>
          <div style={{ fontSize:24, color:C.gold, letterSpacing:2 }}>{estrelas(Math.round(media))}</div>
          <div style={{ fontSize:14, color:C.dim, marginTop:3 }}>{lista.length} {t("aval.count_gestores")}</div>
        </div>
      </div>
      {mostrar.map(av => {
        const escudo = av.time?.escudo_url;
        return (
          <div key={av.id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
            <div style={{ fontSize:16, color:C.gold, letterSpacing:1, marginBottom:9 }}>{estrelas(av.nota)}</div>
            <div style={{ fontSize:14, color:C.cream, lineHeight:1.55, marginBottom:12 }}>"{av.texto}"</div>
            <div style={{ display:"flex", alignItems:"center", gap:11 }}>
              {av.publicar_identidade && escudo
                ? <img src={escudo} alt="" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.gold}`, flexShrink:0 }} onError={e=>{e.currentTarget.style.display="none";}}/>
                : <div style={{ width:40, height:40, borderRadius:"50%", background:C.surf2, border:`2px solid ${C.dim}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:C.cream, flexShrink:0 }}>{av.publicar_identidade ? (av.nome_time?.[0]||"?").toUpperCase() : "?"}</div>}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.cream }}>{av.publicar_identidade ? (av.nome_exibicao || t("aval.gestor")) : t("aval.gestor_amador")}</div>
                <div style={{ fontSize:13, color:C.dim }}>{av.publicar_identidade ? (av.nome_time || av.time?.nome || "") : t("aval.identidade_oculta")}</div>
              </div>
              <div style={{ fontSize:12, color:C.dim, whiteSpace:"nowrap" }}>{tempoRel(av.criado_em)}</div>
            </div>
          </div>
        );
      })}
      {lista.length > 3 && !verTodas && (
        <div style={{ textAlign:"center", marginTop:8 }}>
          <button onClick={() => setVerTodas(true)}
            style={{ background:"none", border:`1px solid ${C.gold}`, color:C.gold, borderRadius:10, fontFamily:"inherit", fontWeight:800, fontSize:14, padding:"11px 26px", cursor:"pointer" }}>
            {t("aval.ver_todas")} {lista.length} {t("aval.count")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Conheca() {
  return (
    <IdiomaProvider>
      <ConhecaConteudo/>
    </IdiomaProvider>
  );
}

function ConhecaConteudo() {
  const { t, idioma } = useIdioma();

  const BtnQuero = ({ grande }) => (
    <a href="/?cadastro=1"
      style={{ background:C.gold, border:"none", borderRadius:10, color:"#0B3D2E", fontFamily:"inherit", fontWeight:800,
        fontSize: grande?16:14, padding: grande?"15px 38px":"12px 28px", cursor:"pointer", textTransform:"uppercase",
        letterSpacing:"0.06em", boxShadow:`0 6px 20px ${C.gold}44`, textDecoration:"none", display:"inline-block" }}>
      {t("home.cta.principal")}
    </a>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.cream, fontFamily:"-apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth:880, margin:"0 auto", padding:"32px 20px 60px" }}>

        {/* topo */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <a href="/" style={{ color:C.dim, fontSize:13, textDecoration:"none" }}>{t("nav.voltar_inicio")}</a>
          <SeletorIdioma C={C}/>
        </div>

        <div style={{ textAlign:"center", marginBottom:44 }}>
          <img src="/logo.png" alt="Nerd do Campo" style={{ width:84, height:84, borderRadius:"50%", objectFit:"cover", margin:"0 auto 18px", display:"block" }}/>
          <div style={{ fontSize:30, fontWeight:800, color:C.cream, marginBottom:10, lineHeight:1.25 }}>{t("conheca.titulo")}</div>
          <div style={{ fontSize:15, color:C.dim, maxWidth:560, margin:"0 auto", lineHeight:1.6 }}>
            {t("conheca.subtitulo")}
          </div>
        </div>

        {/* aviso: a lista é grande, mas ninguém precisa usar tudo de uma vez */}
        <div style={{ background:`linear-gradient(135deg, ${C.surf2}, ${C.surface})`, border:`1px solid ${C.gold}`, borderRadius:12, padding:"16px 18px", margin:"0 0 36px", display:"flex", gap:12, alignItems:"flex-start" }}>
          <span style={{ fontSize:26, flexShrink:0 }} aria-hidden="true">🧩</span>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.gold, marginBottom:3 }}>{t("conheca.aviso.titulo")}</div>
            <div style={{ fontSize:13, color:C.cream, lineHeight:1.5 }}>{t("conheca.aviso.texto")}</div>
          </div>
        </div>

        {/* seções de recursos */}
        {SECOES_POR_IDIOMA[idioma].map(sec => (
          <div key={sec.titulo} style={{ marginBottom:40 }}>
            <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:800, marginBottom:18, borderBottom:`1px solid ${C.border}`, paddingBottom:10 }}>{sec.titulo}</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:16 }}>
              {sec.itens.map(([ic, tit, desc]) => (
                <div key={tit} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 18px" }}>
                  <div style={{ fontSize:28, marginBottom:10 }}>{ic}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:C.gold, marginBottom:7 }}>{tit}</div>
                  <div style={{ fontSize:13, color:C.dim, lineHeight:1.55 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* depoimentos reais (só aparece com 3+ avaliações aprovadas) */}
        <BlocoDepoimentos/>

        {/* destaque do preço */}
        <div style={{ background:`linear-gradient(135deg, ${C.surf2}, ${C.surface})`, border:`2px solid ${C.gold}`, borderRadius:18, padding:"40px 28px", textAlign:"center", margin:"48px 0" }}>
          <div style={{ fontSize:15, color:C.dim, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:700, marginBottom:14 }}>{t("conheca.preco.pergunta")}</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:44, fontWeight:900, color:C.cream }}>R$</span>
            <span style={{ fontSize:58, lineHeight:1 }} role="img" aria-label="zero">⚽</span>
            <span style={{ fontSize:44, fontWeight:900, color:C.cream }}>,00</span>
          </div>
          <div style={{ fontSize:20, fontWeight:800, color:C.gold, marginBottom:8 }}>{t("conheca.preco.zero_reais")}</div>
          <div style={{ fontSize:14, color:C.dim, maxWidth:440, margin:"0 auto", lineHeight:1.6 }}>
            {t("conheca.preco.legenda")}
          </div>
          <div style={{ background:"rgba(232,160,32,.1)", border:`1px dashed ${C.gold}`, borderRadius:10, padding:"13px 15px", marginTop:20, textAlign:"left", display:"flex", gap:10, alignItems:"flex-start" }}>
            <span style={{ fontSize:20, flexShrink:0 }} aria-hidden="true">🧩</span>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:C.gold, marginBottom:2 }}>{t("conheca.selo.titulo")}</div>
              <div style={{ fontSize:12.5, color:C.cream, lineHeight:1.5 }}>{t("conheca.selo.texto")}</div>
            </div>
          </div>
        </div>

        {/* Manual do usuário — disponível para quem quer se aprofundar antes */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <a href={`/manual.pdf?v=1.37.0`} target="_blank" rel="noopener noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:10, background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 24px", color:C.cream, textDecoration:"none", fontSize:14, fontWeight:700 }}>
            <span style={{ fontSize:24 }}>📖</span>
            <span style={{ textAlign:"left" }}>
              <span style={{ display:"block", color:C.gold }}>{t("conheca.manual.titulo")}</span>
              <span style={{ display:"block", fontSize:12, color:C.dim, fontWeight:400 }}>{t("conheca.manual.sub")}</span>
            </span>
          </a>
        </div>

        {/* FAQ — dúvidas que travam a decisão */}
        <div style={{ marginBottom:44 }}>
          <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:800, marginBottom:18, borderBottom:`1px solid ${C.border}`, paddingBottom:10 }}>{t("conheca.faq.titulo")}</div>
          {FAQ_POR_IDIOMA[idioma].map(([q, a]) => (
            <div key={q} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.cream, marginBottom:6 }}>{q}</div>
              <div style={{ fontSize:14, color:C.dim, lineHeight:1.6 }}>{a}</div>
            </div>
          ))}
        </div>

        {/* CTA final */}
        <div style={{ textAlign:"center", padding:"20px 0 10px" }}>
          <div style={{ fontSize:18, fontWeight:800, color:C.cream, marginBottom:8 }}>{t("conheca.cta.titulo")}</div>
          <div style={{ fontSize:14, color:C.dim, marginBottom:22 }}>{t("conheca.cta.sub")}</div>
          <BtnQuero grande />
        </div>

        {/* Conta de demonstração */}
        <BlocoDemo
          titulo={t("conheca.demo.titulo")}
          texto={<>{t("conheca.demo.texto_antes")}<strong>{t("home.demo.texto_negrito")}</strong>{t("conheca.demo.texto_depois")}</>}
          rodape={t("conheca.demo.rodape")}
        />

        {/* contato */}
        <div style={{ textAlign:"center", marginTop:44, paddingTop:24, borderTop:`1px solid ${C.border}`, fontSize:13, color:C.dim }}>
          {t("home.footer.duvidas")}{" "}
          <a href="mailto:nerddocampo10@gmail.com" style={{ color:C.gold, textDecoration:"none", fontWeight:700 }}>nerddocampo10@gmail.com</a>{" "}{t("home.footer.ou_whatsapp")}{" "}<a href="https://wa.me/5551994418950" target="_blank" rel="noopener noreferrer" style={{ color:"#4CAF50", textDecoration:"none", fontWeight:700 }}>(51) 99441-8950</a>
        </div>

      </div>
    </div>
  );
}
