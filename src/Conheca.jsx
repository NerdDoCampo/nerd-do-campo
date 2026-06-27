
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
    ],
  },
];

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
          <a href={`/manual.pdf?v=1.20.1`} target="_blank" rel="noopener noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:10, background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 24px", color:C.cream, textDecoration:"none", fontSize:14, fontWeight:700 }}>
            <span style={{ fontSize:24 }}>📖</span>
            <span style={{ textAlign:"left" }}>
              <span style={{ display:"block", color:C.gold }}>Quer ver tudo em detalhes?</span>
              <span style={{ display:"block", fontSize:12, color:C.dim, fontWeight:400 }}>Abra o manual completo do usuário (PDF)</span>
            </span>
          </a>
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
          <a href="mailto:nerddocampo10@gmail.com" style={{ color:C.gold, textDecoration:"none", fontWeight:700 }}>nerddocampo10@gmail.com</a>
        </div>

      </div>
    </div>
  );
}
