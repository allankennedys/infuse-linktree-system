"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { acaoConfigurar, type EstadoConfiguracao } from "@/app/(painel)/acoes";
import { PreviaDaPagina } from "./PreviaDaPagina";

type Link = { rotulo: string; url: string; icone: string };
export type DadosDaPagina = {
  titulo: string; subtitulo: string; subtitulo_url: string; rodape: string;
  cor_fundo: string; cor_destaque: string; links: Link[];
};
export type PropsDaConfiguracao = {
  id: number; urlPublica: string | null; modo: "LINK" | "PAGINA";
  destino: string; cliente: string; notas: string; pagina: DadosDaPagina;
  icones: { chave: string; rotulo: string }[]; maximoDeLinks: number;
  /** Área do cliente: usa a action do gerente e esconde os campos internos (cliente e observações). */
  acao?: typeof acaoConfigurar; areaDoCliente?: boolean;
  /** Logo e fundo já enviados, para a prévia ao vivo da página de links. */
  imagensDaPrevia?: { logo?: string; fundo?: string };
  /** Avisa qual modo está selecionado no formulário, mesmo antes de salvar. */
  aoMudarModo?: (modo: "LINK" | "PAGINA") => void;
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
  const { aoMudarModo } = props;
  useEffect(() => aoMudarModo?.(modo), [aoMudarModo, modo]);
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

          <div className="pilha">
            <strong>Botões</strong>
            {pagina.links.map((l, i) => (
              <div className="linha-link" key={i}>
                <select name="link_icone" value={l.icone} onChange={(e) => mudarLink(i, { icone: e.target.value })} aria-label={`Ícone do botão ${i + 1}`}>
                  {props.icones.map((ic) => <option key={ic.chave} value={ic.chave}>{ic.rotulo}</option>)}
                </select>
                <input type="text" name="link_rotulo" value={l.rotulo} onChange={(e) => mudarLink(i, { rotulo: e.target.value })}
                  placeholder="Texto do botão" maxLength={40} aria-label={`Texto do botão ${i + 1}`} autoComplete="off" />
                <input type="url" name="link_url" value={l.url} onChange={(e) => mudarLink(i, { url: e.target.value })}
                  placeholder="https://…" maxLength={2048} aria-label={`Endereço do botão ${i + 1}`} autoComplete="off" spellCheck={false} />
                <span className="acoes-linha">
                  <button type="button" className="botao pequeno" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                  <button type="button" className="botao pequeno" onClick={() => mover(i, 1)} disabled={i === pagina.links.length - 1} aria-label="Descer">↓</button>
                  <button type="button" className="botao pequeno perigo" aria-label="Remover botão"
                    onClick={() => setPagina({ ...pagina, links: pagina.links.filter((_, k) => k !== i) })}>✕</button>
                </span>
              </div>
            ))}
            <div>
              <button type="button" className="botao pequeno" disabled={pagina.links.length >= props.maximoDeLinks}
                onClick={() => setPagina({ ...pagina, links: [...pagina.links, { rotulo: "", url: "", icone: "link" }] })}>
                Adicionar botão
              </button>
            </div>
            <small className="suave">
              Só endereços https://. WhatsApp: https://wa.me/55DDDNUMERO.
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
              links: pagina.links.map((l) => ({ ...l, url: l.url.trim() })),
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
