
import { useState, useEffect } from "react";

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

const C = {
  bg: "#0B3D2E", surface: "#103D2A", surf2: "#174D36",
  border: "#1F5C3E", gold: "#E8A020", cream: "#F0E8D0",
  dim: "#8FAF9A", win: "#4CAF50", loss: "#E53935", draw: "#E8A020",
};

// Famílias de recursos — no tom casual do Anderson
const SECOES = [
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
];

// Perguntas que todo gestor faz antes de começar
const FAQ = [
  ["É de graça mesmo?", "É. O Nerd do Campo é gratuito pra usar. Sem mensalidade escondida, sem pegadinha — é só cadastrar o time e começar."],
  ["Preciso instalar algum aplicativo?", "Não. Funciona direto no navegador do celular ou do computador. Se quiser, dá pra adicionar à tela de início e usar como um app, mas é opcional."],
  ["Meus dados ficam seguros?", "Ficam. Cada time só enxerga os próprios dados, e você decide o que é público e o que é privado — inclusive temporada por temporada. Tudo salvo na nuvem, acessível de qualquer aparelho."],
  ["Serve pra turma fechada (a pelada dos amigos)?", "Serve! O sistema se adapta: times internos, rodízio, sorteio equilibrado e controle por total. Não precisa ter adversário de fora pra usar."],
];

// Depoimentos reais — avaliações aprovadas (só aparece com 3+, mesma regra do site)
function BlocoDepoimentos() {
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
    if (dias <= 0) return "hoje";
    if (dias === 1) return "há 1 dia";
    if (dias < 30) return `há ${dias} dias`;
    return new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  };

  return (
    <div style={{ marginBottom:40 }}>
      <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:800, marginBottom:18, borderBottom:`1px solid ${C.border}`, paddingBottom:10 }}>O que os gestores estão achando</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:20 }}>
        <div style={{ fontSize:52, fontWeight:900, color:C.gold, lineHeight:1 }}>{media}</div>
        <div>
          <div style={{ fontSize:24, color:C.gold, letterSpacing:2 }}>{estrelas(Math.round(media))}</div>
          <div style={{ fontSize:14, color:C.dim, marginTop:3 }}>{lista.length} avaliações de gestores</div>
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
                <div style={{ fontSize:14, fontWeight:800, color:C.cream }}>{av.publicar_identidade ? (av.nome_exibicao || "Gestor") : "Gestor de time amador"}</div>
                <div style={{ fontSize:13, color:C.dim }}>{av.publicar_identidade ? (av.nome_time || av.time?.nome || "") : "identidade não divulgada"}</div>
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
            Ver todas as {lista.length} avaliações
          </button>
        </div>
      )}
    </div>
  );
}

export default function Conheca() {

  const BtnQuero = ({ grande }) => (
    <a href="/?cadastro=1"
      style={{ background:C.gold, border:"none", borderRadius:10, color:"#0B3D2E", fontFamily:"inherit", fontWeight:800,
        fontSize: grande?16:14, padding: grande?"15px 38px":"12px 28px", cursor:"pointer", textTransform:"uppercase",
        letterSpacing:"0.06em", boxShadow:`0 6px 20px ${C.gold}44`, textDecoration:"none", display:"inline-block" }}>
      🏆 Quero o meu time aqui
    </a>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.cream, fontFamily:"-apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth:880, margin:"0 auto", padding:"32px 20px 60px" }}>

        {/* topo */}
        <a href="/" style={{ color:C.dim, fontSize:13, textDecoration:"none", display:"inline-block", marginBottom:24 }}>← Voltar para a página inicial</a>

        <div style={{ textAlign:"center", marginBottom:44 }}>
          <img src="/logo.png" alt="Nerd do Campo" style={{ width:84, height:84, borderRadius:"50%", objectFit:"cover", margin:"0 auto 18px", display:"block" }}/>
          <div style={{ fontSize:30, fontWeight:800, color:C.cream, marginBottom:10, lineHeight:1.25 }}>Tudo que o Nerd do Campo faz pelo seu time</div>
          <div style={{ fontSize:15, color:C.dim, maxWidth:560, margin:"0 auto", lineHeight:1.6 }}>
            Do calendário ao caixa, do churrasco à artilharia. Dá uma olhada no que te espera — e repara no preço lá embaixo.
          </div>
        </div>

        {/* seções de recursos */}
        {SECOES.map(sec => (
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
          <div style={{ fontSize:15, color:C.dim, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:700, marginBottom:14 }}>E quanto custa tudo isso?</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:44, fontWeight:900, color:C.cream }}>R$</span>
            <span style={{ fontSize:58, lineHeight:1 }} role="img" aria-label="zero">⚽</span>
            <span style={{ fontSize:44, fontWeight:900, color:C.cream }}>,00</span>
          </div>
          <div style={{ fontSize:20, fontWeight:800, color:C.gold, marginBottom:8 }}>ZERO reais.</div>
          <div style={{ fontSize:14, color:C.dim, maxWidth:440, margin:"0 auto", lineHeight:1.6 }}>
            Isso mesmo — aquela bola ali no lugar do número. Tudo que você viu acima, sem custo nenhum pro seu time.
          </div>
        </div>

        {/* Manual do usuário — disponível para quem quer se aprofundar antes */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <a href={`/manual.pdf?v=1.26.0`} target="_blank" rel="noopener noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:10, background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 24px", color:C.cream, textDecoration:"none", fontSize:14, fontWeight:700 }}>
            <span style={{ fontSize:24 }}>📖</span>
            <span style={{ textAlign:"left" }}>
              <span style={{ display:"block", color:C.gold }}>Quer ver tudo em detalhes?</span>
              <span style={{ display:"block", fontSize:12, color:C.dim, fontWeight:400 }}>Abra o manual completo do usuário (PDF)</span>
            </span>
          </a>
        </div>

        {/* FAQ — dúvidas que travam a decisão */}
        <div style={{ marginBottom:44 }}>
          <div style={{ fontSize:13, color:C.gold, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:800, marginBottom:18, borderBottom:`1px solid ${C.border}`, paddingBottom:10 }}>Perguntas frequentes</div>
          {FAQ.map(([q, a]) => (
            <div key={q} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.cream, marginBottom:6 }}>{q}</div>
              <div style={{ fontSize:14, color:C.dim, lineHeight:1.6 }}>{a}</div>
            </div>
          ))}
        </div>

        {/* CTA final */}
        <div style={{ textAlign:"center", padding:"20px 0 10px" }}>
          <div style={{ fontSize:18, fontWeight:800, color:C.cream, marginBottom:8 }}>Bora colocar seu time no mapa?</div>
          <div style={{ fontSize:14, color:C.dim, marginBottom:22 }}>É rápido pra começar, e a gente te ajuda no caminho.</div>
          <BtnQuero grande />
        </div>

        {/* contato */}
        <div style={{ textAlign:"center", marginTop:44, paddingTop:24, borderTop:`1px solid ${C.border}`, fontSize:13, color:C.dim }}>
          Dúvidas ou sugestões? Fale com a gente pelo e-mail{" "}
          <a href="mailto:nerddocampo10@gmail.com" style={{ color:C.gold, textDecoration:"none", fontWeight:700 }}>nerddocampo10@gmail.com</a>{" "}ou no WhatsApp{" "}<a href="https://wa.me/5551994418950" target="_blank" rel="noopener noreferrer" style={{ color:"#4CAF50", textDecoration:"none", fontWeight:700 }}>(51) 99441-8950</a>
        </div>

      </div>
    </div>
  );
}
