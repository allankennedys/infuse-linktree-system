import { hostDe } from "./destino";
import { ICONES } from "./icones";
import type { Pagina } from "./pagina";

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

const SETA = '<svg class="seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export type ImagensDaPagina = { logo?: string; fundo?: string };

/**
 * HTML completo da página de links, no visual do infuse-links. Sem JavaScript e sem
 * recursos de terceiros. Todo texto vindo do banco é escapado; cores e URLs já foram
 * validadas na gravação e são conferidas de novo aqui. `codigo` é o nº de inventário,
 * mostrado no fim da página enquanto o código ainda não foi configurado.
 */
export function renderizarPagina(p: Pagina, imagens: ImagensDaPagina = {}, codigo?: string): string {
  const cor = (v: string, padrao: string) => (/^#[0-9a-f]{6}$/.test(v) ? v : padrao);
  const fundo = cor(p.cor_fundo, "#030305");
  const destaque = cor(p.cor_destaque, "#2f7bff");
  // Com imagem de fundo há sempre uma película escura por cima, então o texto é claro.
  const escuro = !!imagens.fundo || luminancia(fundo) < 0.4;
  const t = escuro
    ? { texto: "#f5f7fa", suave: "#a3aeb8", cartao: "rgba(20,22,27,.72)", ativo: "rgba(30,33,40,.9)", borda: "rgba(215,226,234,.12)" }
    : { texto: "#12151f", suave: "#5b6472", cartao: "rgba(255,255,255,.82)", ativo: "rgba(255,255,255,.96)", borda: "rgba(18,21,31,.1)" };
  const seguro = (url: string | null) => (url && hostDe(url) && /^https:\/\//.test(url) ? url : null);

  const links = p.links
    .filter((l) => seguro(l.url))
    .map((l) => {
      const icone = ICONES[l.icone] ?? ICONES.link!;
      return `<a class="link" href="${escapar(l.url)}" target="_blank" rel="noopener noreferrer"><span class="icone${icone.semFundo ? " sem-fundo" : ""}">${icone.svg}</span><span class="rotulo">${escapar(l.rotulo)}</span>${SETA}</a>`;
    })
    .join("\n      ");
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
.fundo{position:fixed;inset:0;z-index:0;pointer-events:none;background:${fundo}}
.fundo img{width:100%;height:100%;object-fit:cover;display:block}
.fundo.com-imagem::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,3,5,.72) 0%,rgba(3,3,5,.55) 45%,rgba(3,3,5,.88) 100%)}
.fundo.sem-imagem::after{content:"";position:absolute;inset:0;background:radial-gradient(55% 30% at 50% 16%,${destaque}2e,${destaque}00 70%)}
.wrap{position:relative;z-index:1;width:100%;max-width:440px;min-height:100vh;min-height:100dvh;margin:0 auto;padding:max(24px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center}
.topo{margin-top:auto;display:flex;flex-direction:column;align-items:center;text-align:center}
.logo{display:block;width:auto;max-width:200px;height:clamp(64px,11vh,96px);object-fit:contain;filter:drop-shadow(0 12px 32px ${destaque}66)}
.nome{margin-top:clamp(12px,2vh,18px);font-size:1.3rem;font-weight:500;letter-spacing:.01em;line-height:1.2;overflow-wrap:anywhere}
.arroba{margin-top:2px;color:${t.suave};font-size:.95rem;text-decoration:none;overflow-wrap:anywhere}
.links{width:100%;margin-top:clamp(28px,4.5vh,40px);display:flex;flex-direction:column;gap:14px}
.link{display:flex;align-items:center;gap:16px;width:100%;min-height:82px;padding:12px 18px 12px 12px;border:1px solid ${t.borda};border-radius:20px;background:${t.cartao};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:inherit;text-decoration:none;touch-action:manipulation;transition:background .15s ease,border-color .15s ease,transform .15s ease}
.link:active{background:${t.ativo};transform:scale(.985)}
.link:focus-visible{outline:2px solid ${destaque};outline-offset:2px}
.link:first-child{border-color:${destaque}59}
@media (hover:hover){.link:hover{background:${t.ativo};border-color:${destaque}66}.link:hover .seta{color:${t.texto};transform:translateX(2px)}}
.icone{flex:none;display:grid;place-items:center;width:58px;height:58px;border-radius:15px;background:#fff;color:${destaque}}
.icone svg{width:32px;height:32px}
.icone.sem-fundo{background:transparent}
.icone.sem-fundo svg{width:58px;height:58px}
.rotulo{flex:1;font-size:1.18rem;font-weight:500;overflow-wrap:anywhere;min-width:0}
.seta{flex:none;width:22px;height:22px;color:${t.suave};transition:color .15s ease,transform .15s ease}
.rodape{margin-top:auto;padding-top:32px;font-size:1.05rem;text-align:center;overflow-wrap:anywhere}
.codigo{margin-top:10px;color:${t.suave};font-size:.85rem;letter-spacing:.08em;text-align:center}
@media (max-height:640px){.link{min-height:70px;border-radius:18px}.icone{width:50px;height:50px;border-radius:13px}.icone svg{width:28px;height:28px}.icone.sem-fundo svg{width:50px;height:50px}.links{gap:12px}.nome{font-size:1.2rem}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
  <div class="fundo ${imagens.fundo ? "com-imagem" : "sem-imagem"}" aria-hidden="true">${imagens.fundo ? `<img src="${escapar(imagens.fundo)}" alt="">` : ""}</div>
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
  </main>
</body>
</html>`;
}
