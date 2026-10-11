# Infuse QR

QR Codes dinâmicos para plaquinhas físicas. O QR impresso aponta para uma URL fixa da Infuse
(`APP_BASE_URL/q/<token aleatório>`); o destino final fica no banco e é trocado pelo painel, sem reimprimir.

O QR não é "editável" por si só, nem é um QR Pix EMV: ele é um link para este servidor, que redireciona.
Se este servidor ou o domínio saírem do ar, as plaquinhas param de funcionar.

## Stack

- Next.js 16 (App Router, Server Actions) + React 19 + TypeScript
- Postgres (driver `pg`, SQL puro, migrations em `migrations/`)
- `qrcode` (matriz do QR), `pngjs` (PNG), `pdf-lib` (PDF A4), `fflate` (ZIP), `jsqr` (leitura de conferência)
- Vitest + PGlite (Postgres real em memória) nos testes

App separado do site institucional (`infuse-site` é um SPA estático, sem backend).

## Rodando localmente

```bash
npm install
docker compose up -d                 # Postgres local em 127.0.0.1:54329
cp .env.example .env                 # preencha (veja abaixo)
npm run db:migrate
npm run admin:criar -- seu-usuario "Seu Nome"   # pede a senha (mín. 12 caracteres)
npm run dev
```

`.env` para desenvolvimento:

```
APP_BASE_URL=http://localhost:3000
DATABASE_URL=postgres://infuseqr:infuseqr_dev@127.0.0.1:54329/infuseqr
SESSION_SECRET=<openssl rand -base64 48>
ALLOW_INSECURE_LOCAL_DESTINATIONS=true
```

Códigos gerados em desenvolvimento apontam para `localhost` e não servem para imprimir.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Testes unitários e de integração (não precisa de banco externo) |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run admin:criar -- usuario "Nome"` | Cria admin ou troca a senha (derruba as sessões dele) |
| `npm run retencao` | Aplica a política de retenção manualmente |

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `APP_BASE_URL` | sim | Origem pública codificada nos QR Codes. `https` em produção, sem caminho. **Definitiva depois de imprimir.** |
| `DATABASE_URL` | sim | Postgres. Em serverless, use a string do pooler. |
| `SESSION_SECRET` | sim | ≥ 32 caracteres aleatórios. Anonimiza IPs/usuários no rate limiting. |
| `CRON_SECRET` | para o cron | ≥ 16 caracteres. Protege `/api/cron/retencao`. |
| `DESTINATION_ALLOWED_HOSTS` | não | Lista de hosts de destino permitidos (`wa.me,*.exemplo.com`). Vazio = qualquer HTTPS. |
| `SCAN_RETENTION_DAYS` / `AUDIT_RETENTION_DAYS` | não | Padrão 90 / 730. |
| `DATABASE_POOL_MAX` | não | Padrão 3. |
| `ALLOW_INSECURE_LOCAL_DESTINATIONS` | não | Só desenvolvimento: aceita destino `http://localhost`. Ignorada em produção. |

Nenhum segredo fica no repositório; `.env` está no `.gitignore`.

## Como funciona

- **Token público**: 12 caracteres aleatórios (CSPRNG, ~70 bits), com índice único. O número de inventário
  (`IQ-000123`) é sequencial e serve só para controle interno; não dá acesso a nada.
- **`GET /q/<token>`**: lê o destino no banco a cada acesso e responde `302` com `Cache-Control: no-store`.
  Código ainda não configurado mostra a página de links da Infuse com o nº de inventário no rodapé (é assim que
  se identifica a plaquinha, já que o QR é impresso sem legenda). Código inexistente, desativado ou arquivado
  recebe a mesma página genérica (404), sem revelar nada.
  Banco fora do ar → 503 genérico.
- **Estados**: `DISPONIVEL` → `CONFIGURADO` (tem destino) → `DESATIVADO` (reversível, guarda o destino) →
  `ARQUIVADO` (fora de circulação; desarquivar volta como desativado). Nada é apagado.
- **Geração de lote** (até 500): uma transação cria o lote e os códigos, relê o que foi salvo, gera o QR de cada
  URL e lê de volta. Se algo falhar, nenhum código é criado e fica um registro "lote com erro".
- **Exportação**: PNG individual (1000+ px, com ou sem legenda), ZIP de PNGs, CSV (número, lote, URL pública,
  status) e PDF A4 em três layouts, com folha de conferência. QR preto puro no branco, zona silenciosa de 4
  módulos, correção de erro Q, nada dentro da área de leitura.
- **Destinos**: só `https://`, sem credenciais, sem IP/localhost, até 2048 caracteres. O servidor nunca acessa o
  destino (sem SSRF). Domínio novo, parecido com um conhecido ou em punycode exige confirmação.
- **Reassociação**: trocar o cliente de um código já associado exige confirmação e gera evento no histórico.
  "Remover dados do cliente" apaga nome, observações e destino e limpa os hosts dos eventos antigos.

## Segurança

- Senhas com scrypt; sessão por cookie `HttpOnly`, `SameSite=Lax`, `Secure` e prefixo `__Host-` em produção;
  no banco fica só o SHA-256 do token; expira em 12 h.
- Toda página, server action e rota de download confere a sessão no servidor.
- CSRF: mutações só por Server Actions (o Next recusa `Origin` diferente do host) e cookie `SameSite=Lax`.
- Rate limiting: login com 8 tentativas por usuário e 20 por IP a cada 15 min, persistido no banco.
  `/q` com 60 leituras/min por IP **em memória, por instância** — em serverless isso é melhor esforço;
  para um limite global use o firewall da Vercel ou da Cloudflare.
- Cabeçalhos: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS, `noindex`.
- Auditoria: quem, quando, qual código e ação. Guarda só o host do destino; nunca cliente, notas ou URL completa.

Limitações conhecidas: CSP usa `'unsafe-inline'` em scripts (exigência do Next sem nonce); não há 2FA nem
tela de gestão de administradores (use `npm run admin:criar`); todos os admins têm o mesmo nível de acesso.

## Privacidade e LGPD

- Dados guardados: nome da loja (opcional), destino, observações internas, usuário/nome dos administradores.
- Leituras: total por código e por hora. Sem IP, sem user agent, sem cookies na rota pública.
- Sem analytics, pixels ou terceiros.
- Retenção: leituras por hora 90 dias, auditoria 24 meses, sessões 12 h, contadores de limite 1 dia
  (job diário em `/api/cron/retencao`).
- `/privacidade` traz um texto-base. **Antes de publicar**, a Infuse precisa revisar o texto e incluir a
  identificação do controlador e o canal de contato do titular.

## Acesso do cliente

Na tela de cada código, a seção "Acesso do cliente" cria um usuário e senha para repassar ao cliente. Ele entra
pelo mesmo `/login` e cai em `/cliente`, onde vê só os códigos ligados a ele e edita o destino, a página de links
e as imagens. Não vê nem altera cliente, observações, status, lotes ou auditoria, e pode trocar a própria senha.

- O mesmo usuário pode ser ligado a vários códigos (basta repetir o nome, sem senha).
- Sessão e cookie do cliente são separados dos do administrador; nenhuma rota do painel aceita a sessão do cliente.
- "Remover dados do cliente" também tira o acesso. Conta sem nenhum código é apagada.
- Exige a migration `0005_gerentes.sql`: rode `npm run db:migrate` no banco **antes** de publicar esta versão.

## Deploy

Nada foi publicado por este projeto. Passos para quem for subir (exemplo com Vercel + Postgres gerenciado):

1. **Decidir o host definitivo dos QR Codes.** Hoje `infusesoftware.com` responde `308` para
   `www.infusesoftware.com` e o site é um SPA estático em outro projeto. Recomendado: subdomínio próprio,
   por exemplo `qr.infusesoftware.com`, apontado direto para este app. Não use o apex sem `www`: cada leitura
   passaria por um redirecionamento permanente extra.
2. Criar o banco Postgres (Neon, Supabase, Vercel Postgres…) e copiar a connection string (pooler).
3. Criar o projeto na Vercel a partir deste repositório e definir `APP_BASE_URL`, `DATABASE_URL`,
   `SESSION_SECRET` e `CRON_SECRET`.
4. Rodar as migrations contra o banco de produção: `DATABASE_URL=... npm run db:migrate`.
5. Criar o primeiro admin: `DATABASE_URL=... npm run admin:criar -- usuario "Nome"`.
6. Apontar o DNS do subdomínio para a Vercel (o DNS da Infuse está na Cloudflare) e aguardar o HTTPS.
7. `vercel.json` já agenda o job de retenção diário; a Vercel envia `CRON_SECRET` como Bearer.

Em outra plataforma: `npm run build && npm run start` atrás de um proxy HTTPS que envie `X-Forwarded-For`,
e agende `npm run retencao` uma vez por dia.

## Checklist antes de imprimir

- [ ] O domínio de `APP_BASE_URL` é da Infuse e aponta para o app publicado.
- [ ] HTTPS válido; `curl -I https://DOMINIO/q/AAAAAAAAAAAA` responde `404` com a página genérica.
- [ ] Lote de 10 gerado em produção; CSV conferido: 10 URLs diferentes, todas no domínio certo.
- [ ] Um código configurado: `curl -I` na URL pública responde `302` + `cache-control: no-store` + `location` certo.
- [ ] Destino alterado no painel: o mesmo QR leva ao novo destino.
- [ ] Código desativado mostra a página genérica, sem destino antigo; código ainda não configurado mostra a
      página da Infuse com o nº de inventário.
- [ ] Sem login, `/` redireciona para `/login` e `/api/lotes/1/zip` responde `401`.
- [ ] PNG, ZIP e PDF abertos; PDF impresso em 100% e medido com régua.
- [ ] QR impresso lido em pelo menos dois celulares diferentes (Android e iPhone), no material final da plaquinha.
- [ ] Texto de `/privacidade` revisado.

Os códigos gerados em desenvolvimento ou com outro `APP_BASE_URL` não valem para produção: gere os definitivos
no sistema publicado.
# infuse-linktree-system
