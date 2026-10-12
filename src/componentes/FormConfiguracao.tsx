"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { acaoConfigurar, type EstadoConfiguracao } from "@/app/(painel)/acoes";
import { exibirChavePix, lerChavePix, validarPix, type ChavePix, type TipoDeChavePix } from "@/lib/pix";
import { PreviaDaPagina } from "./PreviaDaPagina";

/** Com o ícone "pix" o botão é Pix: `pix` guarda o que está digitado (chave, quem recebe e cidade). */
type Link = { rotulo: string; url: string; icone: string; pix?: ChavePix };
const PIX_VAZIO: ChavePix = { chave: "", nome: "", cidade: "" };
const TIPOS_DE_CHAVE: Record<TipoDeChavePix, string> = {
  celular: "celular", cpf: "CPF", cnpj: "CNPJ", email: "e-mail", aleatoria: "chave aleatória",
};

/** O que o painel entendeu da chave digitada, para o admin conferir antes de salvar. */
function dicaDaChave(valor: string): { texto: string; problema?: boolean } {
  if (!valor.trim()) return { texto: "CPF, CNPJ, celular com DDD, e-mail ou chave aleatória." };
  const lida = lerChavePix(valor);
  return lida
    ? { texto: `Chave reconhecida: ${TIPOS_DE_CHAVE[lida.tipo]} ${exibirChavePix(lida.chave)}` }
    : { texto: "Ainda não é uma chave Pix.", problema: true };
}
export type DadosDaPagina = {
  titulo: string; subtitulo: string; subtitulo_url: string; rodape: string;
  cor_fundo: string; cor_destaque: string; links: Link[];
  /** Opacidade da imagem de fundo, "0" a "100". */
  fundo_opacidade: string;
};
export type PropsDaConfiguracao = {
  id: number; urlPublica: string | null; modo: "LINK" | "PAGINA";
  destino: string; cliente: string; notas: string; pagina: DadosDaPagina;
  icones: { chave: string; rotulo: string }[]; maximoDeLinks: number;
  /** Área do cliente: usa a action do gerente e esconde os campos internos (cliente e observações). */
  acao?: typeof acaoConfigurar; areaDoCliente?: boolean;
  /** Logo e fundo já enviados, para a prévia ao vivo da página de links. */
  imagensDaPrevia?: { logo?: string; fundo?: string };
  /** Campos de logo e imagem de fundo, mostrados dentro do editor da página, antes dos botões. */
  camposDeImagem?: React.ReactNode;
};

/** Host de um endereço https completo, para procurar o favicon; "" enquanto o endereço não está pronto. */
function hostHttps(url: string): string {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && u.hostname.includes(".") ? u.hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

function hostDigitado(valor: string): { host?: string; problema?: string } {
  const v = valor.trim();
  if (!v) return {};
  try {
    const u = new URL(v);
    // Só uma dica: quem decide é o servidor (que aceita http://localhost apenas em desenvolvimento).
    if (u.protocol !== "https:" && !(u.protocol === "http:" && u.hostname === "localhost")) {
      return { problema: "Apenas https:// é aceito." };
    }
    return { host: u.hostname };
  } catch {
    return { problema: "Ainda não é uma URL completa." };
  }
}

export function FormConfiguracao(props: PropsDaConfiguracao) {
  const [estado, acao, enviando] = useActionState<EstadoConfiguracao, FormData>(props.acao ?? acaoConfigurar, { tipo: "inicial" });
  const [, iniciarEnvio] = useTransition();
  const [modo, setModo] = useState(props.modo);
  const [destino, setDestino] = useState(props.destino);
  const [cliente, setCliente] = useState(props.cliente);
  const [notas, setNotas] = useState(props.notas);
  const [pagina, setPagina] = useState(props.pagina);
  // Quando o registro muda no servidor (salvar, remover dados), os campos acompanham.
  const salvo = JSON.stringify([props.modo, props.destino, props.cliente, props.notas, props.pagina]);
  const [base, setBase] = useState(salvo);
  if (base !== salvo) {
    setBase(salvo);
    setModo(props.modo);
    setDestino(props.destino);
    setCliente(props.cliente);
    setNotas(props.notas);
    setPagina(props.pagina);
  }
  // Favicon dos botões "Link", para a prévia: procurado um pouco depois de o endereço parar de mudar.
  // null = já procuramos e o site não tem; fica o ícone genérico.
  const [favicons, setFavicons] = useState<Record<string, string | null>>({});
  const hostsDeLink = modo === "PAGINA"
    ? [...new Set(pagina.links.filter((l) => l.icone === "link").map((l) => hostHttps(l.url)).filter(Boolean))].join(" ")
    : "";
  useEffect(() => {
    const faltam = hostsDeLink.split(" ").filter((h) => h && !(h in favicons));
    if (faltam.length === 0) return;
    const espera = setTimeout(() => {
      for (const host of faltam) {
        const endereco = `/icone/${encodeURIComponent(host)}`;
        fetch(endereco).then((r) => r.status === 200, () => false)
          .then((achou) => setFavicons((antes) => ({ ...antes, [host]: achou ? endereco : null })));
      }
    }, 700);
    return () => clearTimeout(espera);
  }, [hostsDeLink, favicons]);
  // Em tela estreita a prévia não cabe ao lado: abre por cima, num botão fixo.
  const [previaAberta, setPreviaAberta] = useState(false);
  const previa = hostDigitado(destino);
  // A confirmação vale só para o que foi enviado: se o admin editar algo depois do
  // alerta, o servidor avalia de novo e mostra os alertas certos.
  const [enviado, setEnviado] = useState("");
  const digitado = JSON.stringify([modo, destino, cliente, pagina.subtitulo_url, pagina.links.map((l) => l.url)]);

  const campo = (chave: keyof Omit<DadosDaPagina, "links">) => ({
    value: pagina[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPagina({ ...pagina, [chave]: e.target.value }),
  });
  const mudarLink = (i: number, parte: Partial<Link>) =>
    setPagina({ ...pagina, links: pagina.links.map((l, k) => (k === i ? { ...l, ...parte } : l)) });
  const mudarPix = (i: number, parte: Partial<ChavePix>) =>
    mudarLink(i, { pix: { ...PIX_VAZIO, ...pagina.links[i]!.pix, ...parte } });
  const jaTemPix = pagina.links.some((l) => l.icone === "pix");
  const mover = (i: number, passo: number) => {
    const links = [...pagina.links];
    const [item] = links.splice(i, 1);
    links.splice(i + passo, 0, item!);
    setPagina({ ...pagina, links });
  };

  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        // Envio manual, sem <form action>: nesse modo o React devolve o formulário ao estado inicial
        // depois de cada action, e os botões de opção e as listas de ícone passavam a mostrar (e a
        // enviar, na confirmação de domínio) um valor diferente do escolhido.
        e.preventDefault();
        setEnviado(digitado);
        const dados = new FormData(e.currentTarget);
        iniciarEnvio(() => acao(dados));
      }}
    >
      <input type="hidden" name="id" value={props.id} />
      <input type="hidden" name="modo" value={modo} />

      <fieldset className="modos">
        <legend>Ao ler o QR</legend>
        <label className={modo === "LINK" ? "ativo" : ""}>
          <input type="radio" name="modo_escolhido" value="LINK" checked={modo === "LINK"} onChange={() => setModo("LINK")} />
          <span><strong>Link direto</strong><small>Redireciona para um endereço.</small></span>
        </label>
        <label className={modo === "PAGINA" ? "ativo" : ""}>
          <input type="radio" name="modo_escolhido" value="PAGINA" checked={modo === "PAGINA"} onChange={() => setModo("PAGINA")} />
          <span><strong>Página de links</strong><small>Abre uma página com logo e botões.</small></span>
        </label>
      </fieldset>

      {modo === "LINK" ? (
        <label className="campo">
          <span>Destino</span>
          <input
            type="url" name="destino" value={destino} onChange={(e) => setDestino(e.target.value)}
            placeholder="https://…" maxLength={2048} inputMode="url" autoComplete="off" spellCheck={false}
          />
          <small className={previa.problema ? "texto-erro" : "suave"}>
            {previa.host ? <>Domínio: <span className="mono">{previa.host}</span></>
              : previa.problema ?? "Sem destino, o QR abre a página da Infuse."}
          </small>
        </label>
      ) : (
        <div className="com-previa">
        <div className="pilha editor-pagina">
          <div className="grade-2">
            <label className="campo">
              <span>Nome</span>
              <input type="text" name="p_titulo" {...campo("titulo")} maxLength={60} required autoComplete="off" />
            </label>
            <label className="campo">
              <span>Subtítulo</span>
              <input type="text" name="p_subtitulo" {...campo("subtitulo")} maxLength={60} placeholder="@loja" autoComplete="off" />
            </label>
            <label className="campo">
              <span>Link do subtítulo</span>
              <input type="url" name="p_subtitulo_url" {...campo("subtitulo_url")} maxLength={2048} placeholder="https://…" autoComplete="off" spellCheck={false} />
            </label>
            <label className="campo">
              <span>Frase do rodapé</span>
              <input type="text" name="p_rodape" {...campo("rodape")} maxLength={80} autoComplete="off" />
            </label>
            <label className="campo cor">
              <span>Cor de fundo</span>
              <input type="color" name="p_cor_fundo" {...campo("cor_fundo")} />
            </label>
            <label className="campo cor">
              <span>Cor de destaque</span>
              <input type="color" name="p_cor_destaque" {...campo("cor_destaque")} />
            </label>
          </div>

          {props.camposDeImagem}
          {props.imagensDaPrevia?.fundo ? (
            <label className="campo">
              <span>Opacidade da imagem de fundo: {pagina.fundo_opacidade}%</span>
              <input type="range" name="p_fundo_opacidade" min={0} max={100} step={5} {...campo("fundo_opacidade")} />
            </label>
          ) : (
            <input type="hidden" name="p_fundo_opacidade" value={pagina.fundo_opacidade} />
          )}

          <div className="pilha">
            <strong>Botões</strong>
            {pagina.links.map((l, i) => {
              const ehPix = l.icone === "pix";
              const pix = l.pix ?? PIX_VAZIO;
              const dica = dicaDaChave(pix.chave);
              return (
              <div className="linha-link" key={i}>
                <select name="link_icone" value={l.icone} aria-label={`Ícone do botão ${i + 1}`}
                  onChange={(e) => mudarLink(i, e.target.value === "pix" && !l.rotulo.trim() ? { icone: "pix", rotulo: "Pagar via Pix" } : { icone: e.target.value })}>
                  {props.icones.map((ic) => (
                    <option key={ic.chave} value={ic.chave} disabled={ic.chave === "pix" && jaTemPix && !ehPix}>{ic.rotulo}</option>
                  ))}
                </select>
                <input type="text" name="link_rotulo" value={l.rotulo} onChange={(e) => mudarLink(i, { rotulo: e.target.value })}
                  placeholder="Texto do botão" maxLength={40} aria-label={`Texto do botão ${i + 1}`} autoComplete="off" />
                {ehPix ? (
                  <div className="campos-pix">
                    <input type="hidden" name="link_url" value="" />
                    <input type="text" name="link_pix_chave" value={pix.chave} onChange={(e) => mudarPix(i, { chave: e.target.value })}
                      placeholder="Chave Pix" maxLength={77} aria-label={`Chave Pix do botão ${i + 1}`} autoComplete="off" spellCheck={false} />
                    <input type="text" name="link_pix_nome" value={pix.nome} onChange={(e) => mudarPix(i, { nome: e.target.value })}
                      placeholder="Nome de quem recebe" maxLength={60} aria-label={`Nome de quem recebe o Pix do botão ${i + 1}`} autoComplete="off" />
                    <input type="text" name="link_pix_cidade" value={pix.cidade} onChange={(e) => mudarPix(i, { cidade: e.target.value })}
                      placeholder="Cidade" maxLength={40} aria-label={`Cidade de quem recebe o Pix do botão ${i + 1}`} autoComplete="off" />
                    <small className={dica.problema ? "texto-erro" : "suave"}>{dica.texto}</small>
                  </div>
                ) : (
                  <input type="url" name="link_url" value={l.url} onChange={(e) => mudarLink(i, { url: e.target.value })}
                    placeholder="https://…" maxLength={2048} aria-label={`Endereço do botão ${i + 1}`} autoComplete="off" spellCheck={false} />
                )}
                <span className="acoes-linha">
                  {/* Os campos se repetem em todo botão, para o servidor casar cada um pela posição. */}
                  {!ehPix && (
                    <>
                      <input type="hidden" name="link_pix_chave" value="" />
                      <input type="hidden" name="link_pix_nome" value="" />
                      <input type="hidden" name="link_pix_cidade" value="" />
                    </>
                  )}
                  <button type="button" className="botao pequeno" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                  <button type="button" className="botao pequeno" onClick={() => mover(i, 1)} disabled={i === pagina.links.length - 1} aria-label="Descer">↓</button>
                  <button type="button" className="botao pequeno perigo" aria-label="Remover botão"
                    onClick={() => setPagina({ ...pagina, links: pagina.links.filter((_, k) => k !== i) })}>✕</button>
                </span>
              </div>
              );
            })}
            <div>
              <button type="button" className="botao pequeno" disabled={pagina.links.length >= props.maximoDeLinks}
                onClick={() => setPagina({ ...pagina, links: [...pagina.links, { rotulo: "", url: "", icone: "link" }] })}>
                Adicionar botão
              </button>
            </div>
            <small className="suave">
              Só endereços https://. WhatsApp: https://wa.me/55DDDNUMERO. Para receber por Pix, escolha o ícone Pix: o botão mostra o QR Code e a chave.
            </small>
          </div>
        </div>
        <button type="button" className="botao primario abrir-previa" onClick={() => setPreviaAberta(true)}>Ver prévia</button>
        <aside className={`previa ${previaAberta ? "aberta" : ""}`} aria-label="Prévia" onClick={() => setPreviaAberta(false)}>
          <span className="suave">Prévia</span>
          <button type="button" className="botao fechar-previa" onClick={() => setPreviaAberta(false)}>Fechar</button>
          <PreviaDaPagina
            imagens={props.imagensDaPrevia ?? {}}
            favicons={Object.fromEntries(Object.entries(favicons).filter((par): par is [string, string] => !!par[1]))}
            pagina={{
              titulo: pagina.titulo.trim() || "Nome", subtitulo: pagina.subtitulo.trim() || null,
              subtitulo_url: pagina.subtitulo_url.trim() || null, rodape: pagina.rodape.trim() || null,
              cor_fundo: pagina.cor_fundo.toLowerCase(), cor_destaque: pagina.cor_destaque.toLowerCase(),
              fundo_opacidade: Number(pagina.fundo_opacidade),
              // Botão Pix só abre o QR na prévia quando a chave e os dados de quem recebe já valem.
              links: pagina.links.map(({ pix, ...l }) => {
                const v = l.icone === "pix" ? validarPix(pix ?? PIX_VAZIO) : null;
                return v?.ok ? { ...l, url: "", pix: v.pix } : { ...l, url: l.icone === "pix" ? "" : l.url.trim() };
              }),
            }}
          />
        </aside>
        </div>
      )}

      {!props.areaDoCliente && (
        <>
          <label className="campo">
            <span>Cliente ou loja</span>
            <input type="text" name="cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={120} autoComplete="off" />
          </label>
          <label className="campo">
            <span>Observações internas</span>
            <textarea name="notas" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={1000} rows={3} />
          </label>
        </>
      )}

      {estado.tipo === "confirmar" && enviado === digitado && (
        <div className="aviso atencao" role="alert">
          <strong>Confirme antes de salvar. Nada foi alterado.</strong>
          {estado.avisos.map((a) => <p key={a}>{a}</p>)}
          {estado.avisos.length > 0 && (
            <label className="confirmacao">
              <input type="checkbox" name="confirmarAvisos" required /> <span>Conferi os domínios e quero usar estes endereços.</span>
            </label>
          )}
          {estado.reassociacao && (
            <label className="confirmacao">
              <input type="checkbox" name="confirmarReassociacao" required />{" "}
              <span>Este código já está associado a outro cliente. Confirmo a troca; ela fica registrada no histórico.</span>
            </label>
          )}
        </div>
      )}
      {estado.tipo === "erro" && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.tipo === "salvo" && estado.modo === props.modo && (estado.destino ?? "") === props.destino && (
        <div className="aviso sucesso" role="status">
          <span><strong>Salvo.</strong> O QR impresso continua o mesmo.</span>
          <p className="acoes-linha">
            {props.urlPublica && (
              <a className="botao pequeno" href={props.urlPublica} target="_blank" rel="noopener noreferrer">Abrir pelo endereço do QR</a>
            )}
            {estado.modo === "LINK" && estado.destino && (
              <a className="botao pequeno" href={estado.destino} target="_blank" rel="noopener noreferrer nofollow">Abrir destino</a>
            )}
            {estado.modo === "PAGINA" && (
              <a className="botao pequeno" href={`/api/codigos/${props.id}/previa`} target="_blank" rel="noopener noreferrer">Ver prévia</a>
            )}
          </p>
        </div>
      )}
      <div><button className="botao primario" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</button></div>
    </form>
  );
}
