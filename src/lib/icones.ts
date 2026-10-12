// Ícones disponíveis para os links da página. SVG inline, sem dependência externa.
// Instagram e Google vêm do projeto infuse-links.

const traco = (d: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONES: Record<string, { rotulo: string; svg: string; semFundo?: boolean }> = {
  link: { rotulo: "Link", svg: traco('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>') },
  site: { rotulo: "Site", svg: traco('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.500 18.400 12 21c-2.500-2.600-3.800-5.600-3.800-9S9.500 5.600 12 3z"/>') },
  instagram: {
    rotulo: "Instagram", semFundo: true,
    svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#fdf497"/><stop offset=".05" stop-color="#fdf497"/><stop offset=".45" stop-color="#fd5949"/><stop offset=".6" stop-color="#d6249f"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs><rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#ig)"/><rect x="5.5" y="5.5" width="13" height="13" rx="3.8" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="15.9" cy="8.1" r=".95" fill="#fff"/></svg>',
  },
  google: {
    rotulo: "Google",
    svg: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.650-.389-3.917z"/></svg>',
  },
  conversa: { rotulo: "WhatsApp / conversa", svg: traco('<path d="M20.500 11.500a8.500 8.500 0 0 1-12.600 7.400L3.500 20.500l1.600-4.300A8.500 8.500 0 1 1 20.500 11.500z"/><path d="M9 9.500c0 3 2.500 5.500 5.500 5.500"/>') },
  telefone: { rotulo: "Telefone", svg: traco('<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>') },
  mapa: { rotulo: "Endereço / mapa", svg: traco('<path d="M12 21s-7-6.200-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11z"/><circle cx="12" cy="10" r="2.500"/>') },
  estrela: { rotulo: "Avaliação", svg: traco('<path d="m12 3 2.700 5.600 6.100.900-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.900z"/>') },
  cardapio: { rotulo: "Cardápio", svg: traco('<path d="M6 3v7a2 2 0 0 0 4 0V3M8 12v9M17 3c-1.700 1.500-2.500 3.500-2.500 6v3H17m0-9v18"/>') },
  sacola: { rotulo: "Loja / compras", svg: traco('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>') },
  // Escolher este ícone transforma o botão em Pix: em vez de endereço, ele abre o QR Code e a chave.
  pix: { rotulo: "Pix (QR Code e chave)", svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#32BCAD" d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"/></svg>' },
  pagamento: { rotulo: "Pagamento", svg: traco('<rect x="3" y="6" width="18" height="12" rx="2.500"/><path d="M3 10h18M7 15h3"/>') },
  agenda: { rotulo: "Agendamento", svg: traco('<rect x="4" y="5" width="16" height="15" rx="2.500"/><path d="M4 10h16M8 3v4M16 3v4"/>') },
  email: { rotulo: "E-mail", svg: traco('<rect x="3" y="5" width="18" height="14" rx="2.500"/><path d="m4 7 8 6 8-6"/>') },
  video: { rotulo: "Vídeo", svg: traco('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>') },
};

export const ehIcone = (nome: string): boolean => Object.hasOwn(ICONES, nome);
