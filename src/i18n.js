import { createContext, useContext, useState, useCallback, useMemo } from "react";

// ── Idiomas suportados ──────────────────────────────────────────
// Adicionar um novo idioma: (1) incluir aqui, (2) criar a chave em
// cada objeto de DICT abaixo, (3) nas telas que usam arrays de
// conteúdo por idioma (ex: SECOES/FAQ do Conheca), adicionar a nova
// chave lá também. Uma chave ausente sempre cai no português (nunca
// mostra a chave crua pro usuário).
export const IDIOMAS = [
  { codigo: "pt", bandeira: "🇧🇷", nome: "Português" },
  { codigo: "en", bandeira: "🇺🇸", nome: "English" },
  { codigo: "es", bandeira: "🇪🇸", nome: "Español" },
];
const IDIOMA_PADRAO = "pt";
const CHAVE_STORAGE = "nerd_idioma";

// ── Dicionário ───────────────────────────────────────────────────
// Chaves curtas e namespaced (ex: "home.hero.titulo"). Cobre por ora:
// App.jsx (SeletorTimes/CardTime/BlocoAvaliacoes/TelaManutencao),
// Conheca.jsx (chrome — SECOES/FAQ ficam como arrays por idioma no
// próprio arquivo, não aqui) e Admin.jsx (só login + menu principal).
// O resto do Admin (Cadastros, Financeiro, Jogos...) ainda não foi
// migrado — ver pendência anotada no fim deste arquivo.
const DICT = {
  pt: {
    // navegação / geral
    "nav.area_gestor": "🔑 Área do gestor",
    "nav.voltar_inicio": "← Voltar para a página inicial",
    "geral.carregando": "Carregando...",

    // home (SeletorTimes)
    "home.subtitulo": "Estatísticas de Futebol Amador",
    "home.selecione": "Selecione um time para ver as estatísticas da temporada",
    "home.hero.titulo": "O sistema completo para o seu time amador",
    "home.hero.desc": "Organize estatísticas, finanças e presença num só lugar — e mostre os números do seu time numa página como as que você vê abaixo.",
    "home.hero.item1_tit": "Calendário e adversários",
    "home.hero.item1_desc": "Agenda da temporada e busca de adversários pelo app.",
    "home.hero.item2_tit": "Ficha completa da partida",
    "home.hero.item2_desc": "Tático, confirmação pré-jogo e estatísticas pós-jogo.",
    "home.hero.item3_tit": "Financeiro robusto",
    "home.hero.item3_desc": "Mensalidades, gastos e receitas num fluxo de caixa só.",
    "home.hero.item4_tit": "Eventos e venda de cartões",
    "home.hero.item4_desc": "Do churras à arrecadação, com venda por atleta e convidado.",
    "home.hero.item5_tit": "Seus dados, suas regras",
    "home.hero.item5_desc": "Temporada ruim? Deixe as informações privadas.",
    "home.hero.img_em_breve": "Imagem em breve",
    "home.hero.ampliar": "🔍 ampliar",
    "home.preco.pergunta": "E quanto custa?",
    "home.preco.zero": "(ZERO)",
    "home.preco.legenda": "Sim, de graça. Aquela bola ali no lugar do zero.",
    "home.cta.principal": "🏆 Quero o meu time aqui",
    "home.cta.ver_tudo": "Ver tudo que o app faz",
    "home.filtro.todos": "Todos",
    "home.filtro.data.titulo": "Filtrar por data",
    "home.filtro.data.desc_vazio": "Opcional — sem filtro mostra todos os times",
    "home.filtro.data.desc_ativo": "Times com temporada ativa em",
    "home.filtro.data.deixe_branco": "ou deixe em branco",
    "home.filtro.limpar": "✕ Limpar",
    "home.filtro.raio.titulo": "Filtrar por distância",
    "home.filtro.raio.desc_vazio": "Opcional — escolha uma cidade e o raio em km",
    "home.filtro.raio.desc_ativo": "Times até",
    "home.filtro.raio.desc_ativo_fim": "km da cidade escolhida",
    "home.filtro.raio.estado": "Estado",
    "home.filtro.raio.escolha_estado": "Escolha o estado",
    "home.filtro.raio.cidade": "Cidade",
    "home.filtro.raio.raio_km": "Raio km",
    "home.filtro.raio.sem_coordenadas": "⚠️ Esta cidade não tem coordenadas cadastradas, então o filtro de distância pode não funcionar para ela.",
    "home.destaque.titulo": "⭐ Time em destaque",
    "home.destaque.todos_times": "Todos os times",
    "home.demo.titulo": "🧪 Tem um time? Experimente o painel",
    "home.demo.texto_antes": "Antes de cadastrar o seu, entre na ",
    "home.demo.texto_negrito": "conta de demonstração",
    "home.demo.texto_depois": " e veja como é administrar um time por dentro.",
    "home.gostou.titulo": "Gostou do que viu?",
    "home.gostou.desc": "Coloque o seu time aqui também — é rápido para começar.",
    "home.gostou.botao": "🏆 Cadastrar meu Time",
    "home.footer.assinatura": "⚽ Nerd do Campo — Estatísticas de Futebol Amador",
    "home.footer.duvidas": "Dúvidas ou sugestões? Fale com a gente pelo e-mail",
    "home.footer.ou_whatsapp": "ou no WhatsApp",
    "home.footer.area_gestor": "🔑 Área do gestor — acessar o painel",
    "home.lightbox.fechar": "Toque fora da imagem para fechar",

    // cartão de time (CardTime)
    "cardtime.oficial": "⭐ Oficial",
    "cardtime.fundado": "Fundado em",
    "cardtime.marca_jogos": "Marca jogos:",

    // avaliações (BlocoAvaliacoes / BlocoDepoimentos)
    "aval.titulo": "O que os gestores estão achando",
    "aval.count": "avaliações",
    "aval.count_gestores": "avaliações de gestores",
    "aval.ver_todas": "Ver todas as",
    "aval.gestor": "Gestor",
    "aval.gestor_amador": "Gestor de time amador",
    "aval.identidade_oculta": "identidade não divulgada",
    "aval.hoje": "hoje",
    "aval.ha_1_dia": "há 1 dia",
    "aval.ha_dias": "há {n} dias",

    // manutenção
    "manut.titulo": "Sistema em Manutenção",
    "manut.texto": "Estamos realizando melhorias no Nerd do Campo. Volte em alguns instantes — já já estaremos de volta! ⚽",

    // admin: login
    "login.acessar_conta": "Acessar minha conta",
    "login.email": "E-mail",
    "login.senha": "Senha",
    "login.entrar": "Entrar",
    "login.entrando": "Entrando...",
    "login.esqueci_senha": "Esqueci minha senha",
    "login.demo_titulo": "🧪 Quer testar antes de criar seu time?",
    "login.demo_texto": "Entre na conta de demonstração e mexa à vontade — tem dois times prontos, com jogos, jogadores e financeiro pra você explorar.",
    "login.demo_botao": "Entrar na demonstração",
    "login.demo_aviso": "É uma conta pública de testes: pode bagunçar sem medo, mas não guarde dados de verdade aí.",
    "login.copiar_erro": "Não deu pra copiar — segure o texto para selecionar.",
    "login.erro_credenciais": "E-mail ou senha incorretos.",
    "login.email_invalido": "Informe um e-mail válido.",
    "login.recuperacao_enviada": "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha. Verifique a caixa de entrada e o spam.",
    "login.recuperacao_erro": "Não foi possível enviar agora. Tente novamente em instantes.",
    "login.painel_admin": "Painel Admin",
    "login.ocultar_senha": "Ocultar senha",
    "login.mostrar_senha": "Mostrar senha",
    "login.ver_times_publico": "🌐 Ver os times no app público",
    "login.recuperar_senha": "Recuperar senha",
    "login.recuperar_instrucao": "Informe o e-mail cadastrado. Enviaremos um link para você criar uma nova senha.",
    "login.fechar": "Fechar",
    "login.enviando": "Enviando...",
    "login.enviar_link": "Enviar link",

    // conheça (página de vendas)
    "conheca.titulo": "Tudo que o Nerd do Campo faz pelo seu time",
    "conheca.subtitulo": "Do calendário ao caixa, do churrasco à artilharia. Dá uma olhada no que te espera — e repara no preço lá embaixo.",
    "conheca.aviso.titulo": "Você não precisa usar tudo isso",
    "conheca.aviso.texto": "A lista é grande porque o sistema é completo — mas o seu time usa só o que fizer sentido. Comece pelo básico e ative o resto quando quiser.",
    "conheca.preco.pergunta": "E quanto custa tudo isso?",
    "conheca.preco.zero_reais": "ZERO reais.",
    "conheca.preco.legenda": "Isso mesmo — aquela bola ali no lugar do número. Tudo que você viu acima, sem custo nenhum pro seu time.",
    "conheca.selo.titulo": "E não precisa usar tudo de uma vez",
    "conheca.selo.texto": "Ative um módulo por vez, no seu ritmo. A maioria dos times começa só com o calendário e a escalação — o resto vem depois.",
    "conheca.manual.titulo": "Quer ver tudo em detalhes?",
    "conheca.manual.sub": "Abra o manual completo do usuário (PDF)",
    "conheca.faq.titulo": "Perguntas frequentes",
    "conheca.cta.titulo": "Bora colocar seu time no mapa?",
    "conheca.cta.sub": "É rápido pra começar, e a gente te ajuda no caminho.",
    "conheca.demo.titulo": "🧪 Prefere ver por dentro antes?",
    "conheca.demo.texto_antes": "Use a ",
    "conheca.demo.texto_depois": " e navegue pelo painel como se o time fosse seu: escale, lance placar, teste o financeiro. Nada do que você fizer lá atrapalha ninguém.",
    "conheca.demo.rodape": "Conta pública de testes — pode mexer em tudo.",

    // admin: menu principal (grupos e itens usados hoje)
    "menu.grupo.configurar": "Configurar",
    "menu.grupo.cadastros": "Cadastros",
    "menu.grupo.jogos": "Jogos",
    "menu.grupo.financeiro": "Financeiro",
    "menu.grupo.acompanhar": "Acompanhar",
    "menu.inicio": "Início",
    "menu.meutime": "Meu Time",
    "menu.temporadas": "Temporadas",
    "menu.campos": "Campos",
    "menu.posicoes": "Posições",
    "menu.adversarios": "Adversários",
    "menu.jogadores": "Jogadores",
    "menu.premiacao": "Premiação",
    "menu.partidas": "Partidas",
    "menu.caixa": "Caixa",
    "menu.mensalidades": "Mensalidades",
    "menu.eventos": "Eventos",
    "menu.relatorio": "Relatório",
    "menu.visaoapp": "Visão App",
    "menu.dicas": "Dicas",
    "menu.tiposmov": "Tipos de Mov.",
    "menu.indique": "Indique o app",
    "menu.avaliar": "Avaliar o app",
    "menu.ajuda": "Ajuda",
    "menu.sair": "Sair",
  },

  en: {
    "nav.area_gestor": "🔑 Manager area",
    "nav.voltar_inicio": "← Back to home",
    "geral.carregando": "Loading...",

    "home.subtitulo": "Amateur Football Stats",
    "home.selecione": "Select a team to see the season stats",
    "home.hero.titulo": "The complete system for your amateur team",
    "home.hero.desc": "Organize stats, finances, and attendance in one place — and show your team's numbers on a page like the ones below.",
    "home.hero.item1_tit": "Schedule and opponents",
    "home.hero.item1_desc": "Season calendar and opponent search right in the app.",
    "home.hero.item2_tit": "Full match sheet",
    "home.hero.item2_desc": "Lineup, pre-match confirmation, and post-match stats.",
    "home.hero.item3_tit": "Solid finances",
    "home.hero.item3_desc": "Dues, expenses, and income in a single cash flow.",
    "home.hero.item4_tit": "Events and ticket sales",
    "home.hero.item4_desc": "From cookouts to fundraisers, with per-player and per-guest sales.",
    "home.hero.item5_tit": "Your data, your rules",
    "home.hero.item5_desc": "Rough season? Keep the info private.",
    "home.hero.img_em_breve": "Image coming soon",
    "home.hero.ampliar": "🔍 zoom in",
    "home.preco.pergunta": "How much does it cost?",
    "home.preco.zero": "(ZERO)",
    "home.preco.legenda": "Yeah, free. That ball right where the zero goes.",
    "home.cta.principal": "🏆 I want my team here",
    "home.cta.ver_tudo": "See everything the app does",
    "home.filtro.todos": "All",
    "home.filtro.data.titulo": "Filter by date",
    "home.filtro.data.desc_vazio": "Optional — no filter shows every team",
    "home.filtro.data.desc_ativo": "Teams with an active season on",
    "home.filtro.data.deixe_branco": "or leave it blank",
    "home.filtro.limpar": "✕ Clear",
    "home.filtro.raio.titulo": "Filter by distance",
    "home.filtro.raio.desc_vazio": "Optional — pick a city and a radius in km",
    "home.filtro.raio.desc_ativo": "Teams within",
    "home.filtro.raio.desc_ativo_fim": "km of the chosen city",
    "home.filtro.raio.estado": "State",
    "home.filtro.raio.escolha_estado": "Pick a state",
    "home.filtro.raio.cidade": "City",
    "home.filtro.raio.raio_km": "Radius km",
    "home.filtro.raio.sem_coordenadas": "⚠️ This city has no registered coordinates, so the distance filter may not work for it.",
    "home.destaque.titulo": "⭐ Featured team",
    "home.destaque.todos_times": "All teams",
    "home.demo.titulo": "🧪 Have a team? Try the dashboard",
    "home.demo.texto_antes": "Before signing up yours, log into the ",
    "home.demo.texto_negrito": "demo account",
    "home.demo.texto_depois": " and see what running a team looks like from the inside.",
    "home.gostou.titulo": "Liked what you saw?",
    "home.gostou.desc": "Get your team on here too — it's quick to start.",
    "home.gostou.botao": "🏆 Register my Team",
    "home.footer.assinatura": "⚽ Nerd do Campo — Amateur Football Stats",
    "home.footer.duvidas": "Questions or suggestions? Reach us by email",
    "home.footer.ou_whatsapp": "or on WhatsApp",
    "home.footer.area_gestor": "🔑 Manager area — go to the dashboard",
    "home.lightbox.fechar": "Tap outside the image to close",

    "cardtime.oficial": "⭐ Official",
    "cardtime.fundado": "Founded in",
    "cardtime.marca_jogos": "Books matches:",

    "aval.titulo": "What managers are saying",
    "aval.count": "reviews",
    "aval.count_gestores": "reviews from managers",
    "aval.ver_todas": "See all",
    "aval.gestor": "Manager",
    "aval.gestor_amador": "Amateur team manager",
    "aval.identidade_oculta": "identity not shared",
    "aval.hoje": "today",
    "aval.ha_1_dia": "1 day ago",
    "aval.ha_dias": "{n} days ago",

    "manut.titulo": "System Under Maintenance",
    "manut.texto": "We're making improvements to Nerd do Campo. Check back in a bit — we'll be right back! ⚽",

    "login.acessar_conta": "Log into my account",
    "login.email": "Email",
    "login.senha": "Password",
    "login.entrar": "Log in",
    "login.entrando": "Logging in...",
    "login.esqueci_senha": "Forgot my password",
    "login.demo_titulo": "🧪 Want to try it before creating your team?",
    "login.demo_texto": "Log into the demo account and poke around freely — there are two teams ready to go, with matches, players, and finances to explore.",
    "login.demo_botao": "Enter the demo",
    "login.demo_aviso": "This is a public test account: mess it up all you want, but don't store real data in it.",
    "login.copiar_erro": "Couldn't copy — hold the text to select it.",
    "login.erro_credenciais": "Incorrect email or password.",
    "login.email_invalido": "Enter a valid email.",
    "login.recuperacao_enviada": "If this email is registered, you'll get a link to reset your password. Check your inbox and spam folder.",
    "login.recuperacao_erro": "Couldn't send it right now. Try again in a moment.",
    "login.painel_admin": "Admin Dashboard",
    "login.ocultar_senha": "Hide password",
    "login.mostrar_senha": "Show password",
    "login.ver_times_publico": "🌐 See the teams on the public app",
    "login.recuperar_senha": "Reset password",
    "login.recuperar_instrucao": "Enter your registered email. We'll send you a link to create a new password.",
    "login.fechar": "Close",
    "login.enviando": "Sending...",
    "login.enviar_link": "Send link",

    // conheça (sales page)
    "conheca.titulo": "Everything Nerd do Campo does for your team",
    "conheca.subtitulo": "From the calendar to the cash box, from the cookout to the scoring chart. Take a look at what's waiting for you — and check the price down below.",
    "conheca.aviso.titulo": "You don't have to use all of this",
    "conheca.aviso.texto": "The list is long because the system is complete — but your team only uses what makes sense for it. Start with the basics and turn on the rest whenever you want.",
    "conheca.preco.pergunta": "So how much does all this cost?",
    "conheca.preco.zero_reais": "ZERO dollars.",
    "conheca.preco.legenda": "That's right — that ball right where the number goes. Everything you saw above, at no cost to your team.",
    "conheca.selo.titulo": "And you don't have to use it all at once",
    "conheca.selo.texto": "Turn on one module at a time, at your own pace. Most teams start with just the calendar and lineups — the rest comes later.",
    "conheca.manual.titulo": "Want to see it all in detail?",
    "conheca.manual.sub": "Open the full user manual (PDF)",
    "conheca.faq.titulo": "Frequently asked questions",
    "conheca.cta.titulo": "Ready to put your team on the map?",
    "conheca.cta.sub": "It's quick to get started, and we'll help you along the way.",
    "conheca.demo.titulo": "🧪 Rather see it from the inside first?",
    "conheca.demo.texto_antes": "Use the ",
    "conheca.demo.texto_depois": " and browse the dashboard as if the team were yours: set lineups, post scores, try out the finances. Nothing you do there affects anyone else.",
    "conheca.demo.rodape": "Public test account — feel free to mess with everything.",

    "menu.grupo.configurar": "Setup",
    "menu.grupo.cadastros": "Records",
    "menu.grupo.jogos": "Matches",
    "menu.grupo.financeiro": "Finances",
    "menu.grupo.acompanhar": "Follow up",
    "menu.inicio": "Home",
    "menu.meutime": "My Team",
    "menu.temporadas": "Seasons",
    "menu.campos": "Fields",
    "menu.posicoes": "Positions",
    "menu.adversarios": "Opponents",
    "menu.jogadores": "Players",
    "menu.premiacao": "Awards",
    "menu.partidas": "Matches",
    "menu.caixa": "Cash Box",
    "menu.mensalidades": "Dues",
    "menu.eventos": "Events",
    "menu.relatorio": "Report",
    "menu.visaoapp": "Public View",
    "menu.dicas": "Tips",
    "menu.tiposmov": "Entry Types",
    "menu.indique": "Refer the app",
    "menu.avaliar": "Rate the app",
    "menu.ajuda": "Help",
    "menu.sair": "Log out",
  },

  es: {
    "nav.area_gestor": "🔑 Área del gestor",
    "nav.voltar_inicio": "← Volver al inicio",
    "geral.carregando": "Cargando...",

    "home.subtitulo": "Estadísticas de Fútbol Amateur",
    "home.selecione": "Elegí un equipo para ver las estadísticas de la temporada",
    "home.hero.titulo": "El sistema completo para tu equipo amateur",
    "home.hero.desc": "Organizá estadísticas, finanzas y asistencia en un solo lugar — y mostrá los números de tu equipo en una página como las de abajo.",
    "home.hero.item1_tit": "Calendario y rivales",
    "home.hero.item1_desc": "Agenda de la temporada y búsqueda de rivales desde la app.",
    "home.hero.item2_tit": "Ficha completa del partido",
    "home.hero.item2_desc": "Táctica, confirmación previa al partido y estadísticas posteriores.",
    "home.hero.item3_tit": "Finanzas sólidas",
    "home.hero.item3_desc": "Cuotas, gastos e ingresos en un único flujo de caja.",
    "home.hero.item4_tit": "Eventos y venta de rifas",
    "home.hero.item4_desc": "Del asado a la recaudación, con venta por jugador e invitado.",
    "home.hero.item5_tit": "Tus datos, tus reglas",
    "home.hero.item5_desc": "¿Temporada floja? Dejá la información privada.",
    "home.hero.img_em_breve": "Imagen próximamente",
    "home.hero.ampliar": "🔍 ampliar",
    "home.preco.pergunta": "¿Y cuánto cuesta?",
    "home.preco.zero": "(CERO)",
    "home.preco.legenda": "Sí, gratis. Esa pelota ahí en el lugar del cero.",
    "home.cta.principal": "🏆 Quiero mi equipo acá",
    "home.cta.ver_tudo": "Ver todo lo que hace la app",
    "home.filtro.todos": "Todos",
    "home.filtro.data.titulo": "Filtrar por fecha",
    "home.filtro.data.desc_vazio": "Opcional — sin filtro se muestran todos los equipos",
    "home.filtro.data.desc_ativo": "Equipos con temporada activa el",
    "home.filtro.data.deixe_branco": "o dejalo en blanco",
    "home.filtro.limpar": "✕ Borrar",
    "home.filtro.raio.titulo": "Filtrar por distancia",
    "home.filtro.raio.desc_vazio": "Opcional — elegí una ciudad y el radio en km",
    "home.filtro.raio.desc_ativo": "Equipos a hasta",
    "home.filtro.raio.desc_ativo_fim": "km de la ciudad elegida",
    "home.filtro.raio.estado": "Provincia",
    "home.filtro.raio.escolha_estado": "Elegí la provincia",
    "home.filtro.raio.cidade": "Ciudad",
    "home.filtro.raio.raio_km": "Radio km",
    "home.filtro.raio.sem_coordenadas": "⚠️ Esta ciudad no tiene coordenadas registradas, así que el filtro de distancia puede no funcionar para ella.",
    "home.destaque.titulo": "⭐ Equipo destacado",
    "home.destaque.todos_times": "Todos los equipos",
    "home.demo.titulo": "🧪 ¿Tenés un equipo? Probá el panel",
    "home.demo.texto_antes": "Antes de registrar el tuyo, entrá con la ",
    "home.demo.texto_negrito": "cuenta de demostración",
    "home.demo.texto_depois": " y mirá cómo es gestionar un equipo por dentro.",
    "home.gostou.titulo": "¿Te gustó lo que viste?",
    "home.gostou.desc": "Sumá tu equipo también — es rápido para empezar.",
    "home.gostou.botao": "🏆 Registrar mi Equipo",
    "home.footer.assinatura": "⚽ Nerd do Campo — Estadísticas de Fútbol Amateur",
    "home.footer.duvidas": "¿Dudas o sugerencias? Escribinos por correo",
    "home.footer.ou_whatsapp": "o por WhatsApp",
    "home.footer.area_gestor": "🔑 Área del gestor — ir al panel",
    "home.lightbox.fechar": "Tocá fuera de la imagen para cerrar",

    "cardtime.oficial": "⭐ Oficial",
    "cardtime.fundado": "Fundado en",
    "cardtime.marca_jogos": "Organiza partidos:",

    "aval.titulo": "Lo que dicen los gestores",
    "aval.count": "reseñas",
    "aval.count_gestores": "reseñas de gestores",
    "aval.ver_todas": "Ver todas las",
    "aval.gestor": "Gestor",
    "aval.gestor_amador": "Gestor de equipo amateur",
    "aval.identidade_oculta": "identidad no revelada",
    "aval.hoje": "hoy",
    "aval.ha_1_dia": "hace 1 día",
    "aval.ha_dias": "hace {n} días",

    "manut.titulo": "Sistema en Mantenimiento",
    "manut.texto": "Estamos haciendo mejoras en Nerd do Campo. Volvé en un rato — ¡ya volvemos! ⚽",

    "login.acessar_conta": "Acceder a mi cuenta",
    "login.email": "Correo electrónico",
    "login.senha": "Contraseña",
    "login.entrar": "Entrar",
    "login.entrando": "Entrando...",
    "login.esqueci_senha": "Olvidé mi contraseña",
    "login.demo_titulo": "🧪 ¿Querés probar antes de crear tu equipo?",
    "login.demo_texto": "Entrá con la cuenta de demostración y explorá libremente — hay dos equipos listos, con partidos, jugadores y finanzas para que pruebes.",
    "login.demo_botao": "Entrar a la demo",
    "login.demo_aviso": "Es una cuenta pública de pruebas: desordená sin miedo, pero no guardes datos reales ahí.",
    "login.copiar_erro": "No se pudo copiar — mantené presionado el texto para seleccionarlo.",
    "login.erro_credenciais": "Correo o contraseña incorrectos.",
    "login.email_invalido": "Ingresá un correo válido.",
    "login.recuperacao_enviada": "Si este correo está registrado, vas a recibir un link para restablecer la contraseña. Revisá la bandeja de entrada y el spam.",
    "login.recuperacao_erro": "No se pudo enviar en este momento. Probá de nuevo en unos instantes.",
    "login.painel_admin": "Panel Admin",
    "login.ocultar_senha": "Ocultar contraseña",
    "login.mostrar_senha": "Mostrar contraseña",
    "login.ver_times_publico": "🌐 Ver los equipos en la app pública",
    "login.recuperar_senha": "Recuperar contraseña",
    "login.recuperar_instrucao": "Ingresá el correo registrado. Te vamos a enviar un link para crear una nueva contraseña.",
    "login.fechar": "Cerrar",
    "login.enviando": "Enviando...",
    "login.enviar_link": "Enviar link",

    // conheça (página de ventas)
    "conheca.titulo": "Todo lo que Nerd do Campo hace por tu equipo",
    "conheca.subtitulo": "Del calendario a la caja, del asado a la tabla de goleadores. Mirá todo lo que te espera — y fijate el precio ahí abajo.",
    "conheca.aviso.titulo": "No hace falta que uses todo esto",
    "conheca.aviso.texto": "La lista es larga porque el sistema es completo — pero tu equipo usa solo lo que tenga sentido. Empezá por lo básico y activá el resto cuando quieras.",
    "conheca.preco.pergunta": "¿Y cuánto cuesta todo esto?",
    "conheca.preco.zero_reais": "CERO pesos.",
    "conheca.preco.legenda": "Así es — esa pelota ahí en el lugar del número. Todo lo que viste arriba, sin costo para tu equipo.",
    "conheca.selo.titulo": "Y no hace falta usarlo todo de una vez",
    "conheca.selo.texto": "Activá un módulo a la vez, a tu ritmo. La mayoría de los equipos arranca solo con el calendario y las alineaciones — el resto viene después.",
    "conheca.manual.titulo": "¿Querés ver todo en detalle?",
    "conheca.manual.sub": "Abrí el manual completo del usuario (PDF)",
    "conheca.faq.titulo": "Preguntas frecuentes",
    "conheca.cta.titulo": "¿Ponemos tu equipo en el mapa?",
    "conheca.cta.sub": "Es rápido para empezar, y te acompañamos en el camino.",
    "conheca.demo.titulo": "🧪 ¿Preferís verlo por dentro primero?",
    "conheca.demo.texto_antes": "Usá la ",
    "conheca.demo.texto_depois": " y navegá el panel como si el equipo fuera tuyo: armá la alineación, cargá el resultado, probá las finanzas. Nada de lo que hagas ahí afecta a nadie más.",
    "conheca.demo.rodape": "Cuenta pública de pruebas — podés tocar todo sin problema.",

    "menu.grupo.configurar": "Configurar",
    "menu.grupo.cadastros": "Registros",
    "menu.grupo.jogos": "Partidos",
    "menu.grupo.financeiro": "Finanzas",
    "menu.grupo.acompanhar": "Seguimiento",
    "menu.inicio": "Inicio",
    "menu.meutime": "Mi Equipo",
    "menu.temporadas": "Temporadas",
    "menu.campos": "Canchas",
    "menu.posicoes": "Posiciones",
    "menu.adversarios": "Rivales",
    "menu.jogadores": "Jugadores",
    "menu.premiacao": "Premiación",
    "menu.partidas": "Partidos",
    "menu.caixa": "Caja",
    "menu.mensalidades": "Cuotas",
    "menu.eventos": "Eventos",
    "menu.relatorio": "Informe",
    "menu.visaoapp": "Vista Pública",
    "menu.dicas": "Consejos",
    "menu.tiposmov": "Tipos de Mov.",
    "menu.indique": "Recomendá la app",
    "menu.avaliar": "Calificá la app",
    "menu.ajuda": "Ayuda",
    "menu.sair": "Salir",
  },
};

// ── Contexto ─────────────────────────────────────────────────────
const IdiomaContext = createContext(null);

export function IdiomaProvider({ children }) {
  const [idioma, setIdiomaState] = useState(() => {
    try { return localStorage.getItem(CHAVE_STORAGE) || IDIOMA_PADRAO; } catch (e) { return IDIOMA_PADRAO; }
  });

  const setIdioma = useCallback((novo) => {
    setIdiomaState(novo);
    try { localStorage.setItem(CHAVE_STORAGE, novo); } catch (e) { /* localStorage indisponível: segue só na memória */ }
  }, []);

  // t(chave, vars?) — busca no idioma atual; se faltar, cai no português;
  // se nem no português existir, mostra a própria chave (fácil de notar no teste).
  // vars permite interpolar {n} etc: t("aval.ha_dias", {n: 5}) -> "há 5 dias"
  const t = useCallback((chave, vars) => {
    let texto = (DICT[idioma] && DICT[idioma][chave]) ?? DICT[IDIOMA_PADRAO][chave] ?? chave;
    if (vars) Object.keys(vars).forEach(k => { texto = texto.replace(`{${k}}`, vars[k]); });
    return texto;
  }, [idioma]);

  const value = useMemo(() => ({ idioma, setIdioma, t }), [idioma, setIdioma, t]);
  return <IdiomaContext.Provider value={value}>{children}</IdiomaContext.Provider>;
}

export function useIdioma() {
  const ctx = useContext(IdiomaContext);
  if (!ctx) throw new Error("useIdioma precisa ser usado dentro de <IdiomaProvider>");
  return ctx;
}

// ── Seletor visual (bandeiras) ────────────────────────────────────
// C = paleta de cores do arquivo que está chamando (cada app tem a sua,
// mas todas usam os mesmos nomes: gold, dim, border, cream, surf2).
export function SeletorIdioma({ C, tamanho = 15 }) {
  const { idioma, setIdioma } = useIdioma();
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {IDIOMAS.map(i => (
        <button key={i.codigo} onClick={() => setIdioma(i.codigo)} title={i.nome} aria-label={i.nome}
          style={{
            fontSize: tamanho + 3, lineHeight: 1, background: idioma === i.codigo ? `${C.gold}22` : "transparent",
            border: `1px solid ${idioma === i.codigo ? C.gold : "transparent"}`, borderRadius: 7,
            padding: "4px 6px", cursor: "pointer", opacity: idioma === i.codigo ? 1 : 0.5,
          }}>
          {i.bandeira}
        </button>
      ))}
    </div>
  );
}

// ── PENDÊNCIAS (próximas versões) ─────────────────────────────────
// Ainda 100% em português, não migrado nesta rodada:
//  - App.jsx: ModalSolicitacao (formulário de autocadastro de time, 3 passos)
//  - App.jsx: VisaoGeral/Calendario/Elenco/Estatisticas/Gols/FichaPartidaPublica
//    (abas de estatística de um time já selecionado)
//  - Admin.jsx: todo o restante do painel (Cadastros, Financeiro, Jogos,
//    Turma Fechada, Premiação etc.) — só Login e o rótulo dos itens do
//    menu principal foram migrados. As TELAS de cada módulo continuam
//    em português.
//  - Super.jsx: não migrado.
