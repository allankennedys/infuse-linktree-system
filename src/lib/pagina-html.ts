// Este módulo também roda no navegador (prévia ao vivo do formulário): nada de APIs do Node aqui.
import { ICONES } from "./icones";
import type { Pagina } from "./pagina";
import { exibirChavePix, payloadPix } from "./pix";
import { gerarSvg } from "./qr-svg";

function hostDe(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Luminância relativa (WCAG) de uma cor #rrggbb. */
function luminancia(cor: string): number {
  const canal = (i: number) => {
    const v = Number.parseInt(cor.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Contraste WCAG entre duas cores #rrggbb (de 1 a 21). */
export function contraste(a: string, b: string): number {
  const [clara, escura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (clara + 0.05) / (escura + 0.05);
}

/** Mistura duas cores #rrggbb: `t` = 0 devolve `a`, 1 devolve `b`. */
function misturar(a: string, b: string, t: number): string {
  const canal = (i: number) =>
    Math.round(Number.parseInt(a.slice(i, i + 2), 16) * (1 - t) + Number.parseInt(b.slice(i, i + 2), 16) * t)
      .toString(16).padStart(2, "0");
  return `#${canal(1)}${canal(3)}${canal(5)}`;
}

/** Contraste mínimo de texto (WCAG AA) e de elemento gráfico, como o desenho do ícone. */
const MINIMO_TEXTO = 4.5, MINIMO_ICONE = 3;

/**
 * Cores de texto, cartão e ícone calculadas a partir do fundo e do destaque escolhidos, para
 * qualquer combinação continuar legível: o texto é claro ou escuro conforme o que contrasta
 * mais com o fundo, e vai a branco ou preto puro nos tons médios, onde o tom suave não basta.
 */
export function temaDaPagina(fundo: string, destaque: string, comImagem = false) {
  // Com imagem de fundo há sempre uma película escura por cima, então o texto é claro.
  const escuro = comImagem || contraste("#ffffff", fundo) >= contraste("#000000", fundo);
  const atras = comImagem ? "#030305" : fundo;
  let texto = escuro ? "#f5f7fa" : "#12151f";
  if (contraste(texto, atras) < MINIMO_TEXTO) texto = escuro ? "#ffffff" : "#000000";
  // Subtítulo e nº de inventário: um tom mais apagado, se ainda der para ler; senão, a cor do texto.
  let suave = misturar(texto, atras, 0.3);
  if (contraste(suave, atras) < MINIMO_TEXTO) suave = texto;
  // O desenho do ícone fica sobre um quadrado branco: destaque claro demais é escurecido só ali.
  let icone = destaque;
  for (let t = 0.1; contraste(icone, "#ffffff") < MINIMO_ICONE && t <= 1; t += 0.1) icone = misturar(destaque, "#000000", t);
  return escuro
    ? { texto, suave, icone, suaveNoCartao: "#a3aeb8", cartao: "rgba(20,22,27,.72)", ativo: "rgba(30,33,40,.9)", borda: "rgba(215,226,234,.12)" }
    : { texto, suave, icone, suaveNoCartao: "#5b6472", cartao: "rgba(255,255,255,.82)", ativo: "rgba(255,255,255,.96)", borda: "rgba(18,21,31,.1)" };
}

const SETA = '<svg class="seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Só os botões de copiar dependem de script; o modal abre e fecha com :target.
const SCRIPT_COPIAR = `(function(){var t=document.getElementById("toast"),r;function avisar(m){t.textContent=m;t.classList.add("on");clearTimeout(r);r=setTimeout(function(){t.classList.remove("on")},2200)}function copiar(x,m){function reserva(){var e=document.createElement("textarea");e.value=x;e.style.position="fixed";e.style.opacity="0";document.body.appendChild(e);e.select();document.execCommand("copy");e.remove();avisar(m)}if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(x).then(function(){avisar(m)},reserva);else reserva()}document.querySelectorAll("[data-copiar]").forEach(function(b){b.hidden=false;b.addEventListener("click",function(){copiar(b.getAttribute("data-copiar"),b.getAttribute("data-aviso"))})})})();`;

export type ImagensDaPagina = { logo?: string; fundo?: string };

export type ExtrasDaPagina = {
  /** Nº de inventário, mostrado no fim da página enquanto o código ainda não foi configurado. */
  codigo?: string;
  /** Escurece a imagem de fundo e puxa o tom para o azul, como no infuse-links. */
  fundoAzulado?: boolean;
  /** Favicon guardado de cada host (host → endereço da imagem). Vale para os botões com o ícone "Link". */
  favicons?: Record<string, string>;
  /** Prévia do formulário: botão com texto mas ainda sem endereço válido aparece, sem link. */
  previa?: boolean;
};

/**
 * HTML completo da página de links, no visual do infuse-links. Sem recursos de terceiros
 * e sem JavaScript, exceto os botões de copiar do Pix. Todo texto vindo do banco é escapado;
 * cores e URLs já foram validadas na gravação e são conferidas de novo aqui.
 */
export function renderizarPagina(p: Pagina, imagens: ImagensDaPagina = {}, extras: ExtrasDaPagina = {}): string {
  const { codigo } = extras;
  // O botão Pix abre um painel com o QR do copia e cola, gerado aqui a partir da chave.
  const chavePix = p.links.find((l) => l.pix)?.pix;
  const payload = chavePix ? payloadPix(chavePix) : "";
  const pix = chavePix && { chave: chavePix.chave, exibir: exibirChavePix(chavePix.chave), payload, qrSvg: gerarSvg(payload) };
  const cor = (v: string, padrao: string) => (/^#[0-9a-f]{6}$/.test(v) ? v : padrao);
  const fundo = cor(p.cor_fundo, "#030305");
  const destaque = cor(p.cor_destaque, "#2f7bff");
  const t = temaDaPagina(fundo, destaque, !!imagens.fundo);
  // Abaixo de 100%, a imagem esmaece sobre a cor de fundo (se for escura) ou sobre preto; a película escura continua por cima.
  // Cor clara por trás de uma imagem esmaecida deixaria o texto (sempre claro, com imagem) sem contraste.
  const atrasDaImagem = !imagens.fundo || contraste("#ffffff", fundo) >= contraste("#000000", fundo) ? fundo : "#030305";
  const opacidade = Number.isInteger(p.fundo_opacidade) ? Math.min(100, Math.max(0, p.fundo_opacidade!)) : 100;
  const seguro = (url: string | null) => (url && hostDe(url) && /^https:\/\//.test(url) ? url : null);

  const links = p.links
    .filter((l) => l.pix || seguro(l.url) || (extras.previa && l.rotulo.trim()))
    .map((l) => {
      const icone = ICONES[l.icone] ?? ICONES.link!;
      const favicon = l.icone === "link" ? extras.favicons?.[hostDe(l.url)?.toLowerCase() ?? ""] : undefined;
      const desenho = favicon ? `<img src="${escapar(favicon)}" alt="" width="36" height="36">` : icone.svg;
      const miolo = `<span class="icone${icone.semFundo ? " sem-fundo" : ""}">${desenho}</span><span class="rotulo">${escapar(l.rotulo)}</span>${SETA}`;
      if (l.pix) return `<a class="link" href="#pix">${miolo}</a>`;
      return seguro(l.url)
        ? `<a class="link" href="${escapar(l.url)}" target="_blank" rel="noopener noreferrer">${miolo}</a>`
        : `<span class="link">${miolo}</span>`;
    })
    .join("\n      ");
  const modalPix = pix
    ? `
  <div class="modal" id="pix" role="dialog" aria-modal="true" aria-labelledby="pix-titulo">
    <a class="modal-fundo" href="#" aria-label="Fechar" tabindex="-1"></a>
    <div class="modal-caixa">
      <span class="alca" aria-hidden="true"></span>
      <a class="fechar" href="#" aria-label="Fechar">×</a>
      <h2 id="pix-titulo">Pague via Pix</h2>
      <p class="sub">Abra o app do seu banco e escaneie o código.</p>
      <div class="qr" aria-label="QR Code Pix">${pix.qrSvg}</div>
      <div class="chave"><span>Chave Pix</span><strong>${escapar(pix.exibir)}</strong></div>
      <button class="btn" type="button" data-copiar="${escapar(pix.payload)}" data-aviso="Pix copia e cola copiado!" hidden>Copiar Pix copia e cola</button>
      <button class="btn btn-sec" type="button" data-copiar="${escapar(pix.chave)}" data-aviso="Chave Pix copiada!" hidden>Copiar só a chave</button>
      <noscript><p class="sub">Pix copia e cola:</p><p class="payload">${escapar(pix.payload)}</p></noscript>
    </div>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script>${SCRIPT_COPIAR}</script>`
    : "";
  const sub = p.subtitulo
    ? seguro(p.subtitulo_url)
      ? `<a class="arroba" href="${escapar(p.subtitulo_url!)}" target="_blank" rel="noopener noreferrer">${escapar(p.subtitulo)}</a>`
      : `<p class="arroba">${escapar(p.subtitulo)}</p>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${fundo}">
<title>${escapar(p.titulo)}</title>
<style>
@font-face{font-family:Kanit;font-weight:400;font-display:swap;src:url(/fontes/kanit-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:Kanit;font-weight:500;font-display:swap;src:url(/fontes/kanit-latin-500-normal.woff2) format("woff2")}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%}
body{background:${fundo};color:${t.texto};font-family:Kanit,system-ui,sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;overflow-x:hidden}
.fundo{position:fixed;inset:0;z-index:0;pointer-events:none;background:${atrasDaImagem}}
.fundo img{width:100%;height:100%;object-fit:cover;display:block${opacidade < 100 ? `;opacity:${opacidade / 100}` : ""}}
.fundo.com-imagem::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,3,5,.72) 0%,rgba(3,3,5,.55) 45%,rgba(3,3,5,.88) 100%)}
.fundo.azulado img{opacity:.45;filter:brightness(.62) contrast(1.12) saturate(1.05) hue-rotate(-65deg)}
.fundo.azulado::after{background:radial-gradient(55% 30% at 50% 16%,${destaque}2e,${destaque}00 70%),linear-gradient(180deg,rgba(3,3,5,.82) 0%,rgba(3,3,5,.62) 45%,rgba(3,3,5,.93) 100%)}
.fundo.sem-imagem::after{content:"";position:absolute;inset:0;background:radial-gradient(55% 30% at 50% 16%,${destaque}2e,${destaque}00 70%)}
.wrap{position:relative;z-index:1;width:100%;max-width:440px;min-height:100vh;min-height:100dvh;margin:0 auto;padding:max(24px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center}
.topo{margin-top:auto;display:flex;flex-direction:column;align-items:center;text-align:center}
.logo{display:block;width:auto;max-width:200px;height:clamp(64px,11vh,96px);object-fit:contain;filter:drop-shadow(0 12px 32px ${destaque}66)}
.nome{margin-top:clamp(12px,2vh,18px);font-size:1.3rem;font-weight:500;letter-spacing:.01em;line-height:1.2;overflow-wrap:anywhere}
.arroba{margin-top:2px;color:${t.suave};font-size:.95rem;text-decoration:none;overflow-wrap:anywhere}
.links{width:100%;margin-top:clamp(28px,4.5vh,40px);display:flex;flex-direction:column;gap:14px}
.link{display:flex;align-items:center;gap:16px;width:100%;min-height:82px;padding:12px 18px 12px 12px;border:1px solid ${t.borda};border-radius:20px;background:${t.cartao};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:inherit;text-decoration:none;touch-action:manipulation;transition:background .15s ease,border-color .15s ease,transform .15s ease}
.link:active{background:${t.ativo};transform:scale(.985)}
.link:focus-visible{outline:2px solid ${t.texto};outline-offset:2px}
.link:first-child{border-color:${destaque}59}
@media (hover:hover){.link:hover{background:${t.ativo};border-color:${destaque}66}.link:hover .seta{color:${t.texto};transform:translateX(2px)}}
.icone{flex:none;display:grid;place-items:center;width:58px;height:58px;border-radius:15px;background:#fff;color:${t.icone}}
.icone svg{width:32px;height:32px}
.icone img{display:block;width:36px;height:36px;object-fit:contain;border-radius:8px}
.icone.sem-fundo{background:transparent}
.icone.sem-fundo svg{width:58px;height:58px}
.rotulo{flex:1;font-size:1.18rem;font-weight:500;overflow-wrap:anywhere;min-width:0}
.seta{flex:none;width:22px;height:22px;color:${t.suaveNoCartao};transition:color .15s ease,transform .15s ease}
.rodape{margin-top:auto;padding-top:32px;font-size:1.05rem;text-align:center;overflow-wrap:anywhere}
.codigo{margin-top:10px;color:${t.suave};font-size:.85rem;letter-spacing:.08em;text-align:center}
${pix ? `.modal{position:fixed;inset:0;z-index:10;display:none;align-items:flex-end;justify-content:center}
.modal:target{display:flex}
.modal-fundo{position:absolute;inset:0;background:rgba(0,0,0,.65);animation:aparece .2s ease both}
.modal-caixa{position:relative;width:100%;max-width:440px;max-height:92dvh;overflow-y:auto;padding:12px 20px max(20px,env(safe-area-inset-bottom));border:1px solid ${t.borda};border-bottom:0;border-radius:24px 24px 0 0;background:#14161a;color:#f5f7fa;text-align:center;animation:sobe .28s cubic-bezier(.2,.8,.2,1) both}
.alca{display:block;width:40px;height:4px;margin:0 auto 18px;border-radius:4px;background:rgba(255,255,255,.18)}
.modal-caixa h2{font-weight:500;font-size:1.3rem}
.sub{color:#a3aeb8;font-size:.92rem;margin-top:4px}
.fechar{position:absolute;top:12px;right:12px;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.06);color:#f5f7fa;font-size:1.5rem;line-height:1;text-decoration:none}
.qr{width:min(220px,60vw,32dvh);aspect-ratio:1;margin:18px auto 0;padding:12px;border-radius:14px;background:#fff}
.qr svg{display:block;width:100%;height:100%}
.chave{margin-top:14px}
.chave span{display:block;color:#a3aeb8;font-size:.85rem}
.chave strong{font-weight:500;font-size:1.1rem}
.btn{width:100%;min-height:52px;margin-top:16px;border:0;border-radius:14px;background:${destaque};color:#fff;font:inherit;font-size:1rem;font-weight:500;cursor:pointer;touch-action:manipulation}
.btn:active{filter:brightness(.9)}
.btn-sec{margin-top:8px;background:transparent;border:1px solid rgba(215,226,234,.12);color:#f5f7fa}
.btn[hidden]{display:none}
.payload{margin-top:8px;padding:10px;border:1px solid rgba(215,226,234,.12);border-radius:10px;font-size:.8rem;overflow-wrap:anywhere;user-select:all;-webkit-user-select:all}
.toast{position:fixed;left:50%;bottom:max(24px,calc(env(safe-area-inset-bottom) + 12px));z-index:20;transform:translate(-50%,20px);padding:10px 18px;border-radius:999px;background:#f5f7fa;color:#0c0c0c;font-size:.92rem;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease}
.toast.on{opacity:1;transform:translate(-50%,0)}
@keyframes aparece{from{opacity:0}to{opacity:1}}
@keyframes sobe{from{transform:translateY(100%)}to{transform:translateY(0)}}
@media (min-width:600px){.modal{align-items:center;padding:20px}.modal-caixa{max-width:380px;border-radius:22px;border-bottom:1px solid ${t.borda};padding-bottom:22px}.alca{display:none}.modal-caixa h2{margin-top:14px}}
` : ""}@media (max-height:640px){.link{min-height:70px;border-radius:18px}.icone{width:50px;height:50px;border-radius:13px}.icone svg{width:28px;height:28px}.icone img{width:32px;height:32px}.icone.sem-fundo svg{width:50px;height:50px}.links{gap:12px}.nome{font-size:1.2rem}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
  <div class="fundo ${imagens.fundo ? "com-imagem" : "sem-imagem"}${imagens.fundo && extras.fundoAzulado ? " azulado" : ""}" aria-hidden="true">${imagens.fundo ? `<img src="${escapar(imagens.fundo)}" alt="">` : ""}</div>
  <main class="wrap">
    <header class="topo">
      ${imagens.logo ? `<img class="logo" src="${escapar(imagens.logo)}" alt="" draggable="false">` : ""}
      <h1 class="nome">${escapar(p.titulo)}</h1>
      ${sub}
    </header>
    <nav class="links">
      ${links}
    </nav>
    ${p.rodape ? `<p class="rodape">${escapar(p.rodape)}</p>` : '<p class="rodape"></p>'}
    ${codigo ? `<p class="codigo">${escapar(codigo)}</p>` : ""}
  </main>${modalPix}
</body>
</html>`;
}
