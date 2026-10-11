"use client";

import { useActionState, useState } from "react";
import { acaoConfigurar, type EstadoConfiguracao } from "@/app/(painel)/acoes";

type Link = { rotulo: string; url: string; icone: string };
export type DadosDaPagina = {
  titulo: string; subtitulo: string; subtitulo_url: string; rodape: string;
  cor_fundo: string; cor_destaque: string; links: Link[];
};
type Props = {
  id: number; urlPublica: string | null; modo: "LINK" | "PAGINA";
  destino: string; cliente: string; notas: string; pagina: DadosDaPagina;
  icones: { chave: string; rotulo: string }[]; maximoDeLinks: number;
};

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

export function FormConfiguracao(props: Props) {
  const [estado, acao, enviando] = useActionState<EstadoConfiguracao, FormData>(acaoConfigurar, { tipo: "inicial" });
  // Campos controlados: o React limpa formulários não controlados depois de cada action.
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
    <form action={acao} className="pilha" onSubmit={() => setEnviado(digitado)}>
      <input type="hidden" name="id" value={props.id} />

      <fieldset className="modos">
        <legend>O que acontece quando alguém lê este QR?</legend>
        <label className={modo === "LINK" ? "ativo" : ""}>
          <input type="radio" name="modo" value="LINK" checked={modo === "LINK"} onChange={() => setModo("LINK")} />
          <span><strong>A — Link direto</strong><small>Redireciona na hora para um endereço que você define.</small></span>
        </label>
        <label className={modo === "PAGINA" ? "ativo" : ""}>
          <input type="radio" name="modo" value="PAGINA" checked={modo === "PAGINA"} onChange={() => setModo("PAGINA")} />
          <span><strong>B — Página de links</strong><small>Abre uma página com logo, cores e vários botões.</small></span>
        </label>
      </fieldset>

      {modo === "LINK" ? (
        <label className="campo">
          <span>Destino final (para onde o QR leva)</span>
          <input
            type="url" name="destino" value={destino} onChange={(e) => setDestino(e.target.value)}
            placeholder="https://…" maxLength={2048} inputMode="url" autoComplete="off" spellCheck={false}
          />
          <small className={previa.problema ? "texto-erro" : "suave"}>
            {previa.host ? <>Domínio de destino: <strong className="mono">{previa.host}</strong></>
              : previa.problema ?? "Vazio = código sem destino (mostra a página de “ainda não disponível”)."}
          </small>
        </label>
      ) : (
        <div className="pilha editor-pagina">
          <div className="grade-2">
            <label className="campo">
              <span>Nome no topo da página</span>
              <input type="text" name="p_titulo" {...campo("titulo")} maxLength={60} required autoComplete="off" />
            </label>
            <label className="campo">
              <span>Subtítulo (opcional, ex.: @loja)</span>
              <input type="text" name="p_subtitulo" {...campo("subtitulo")} maxLength={60} autoComplete="off" />
            </label>
            <label className="campo">
              <span>Link do subtítulo (opcional)</span>
              <input type="url" name="p_subtitulo_url" {...campo("subtitulo_url")} maxLength={2048} placeholder="https://…" autoComplete="off" spellCheck={false} />
            </label>
            <label className="campo">
              <span>Frase do rodapé (opcional)</span>
              <input type="text" name="p_rodape" {...campo("rodape")} maxLength={80} autoComplete="off" />
            </label>
            <label className="campo cor">
              <span>Cor de fundo</span>
              <input type="color" name="p_cor_fundo" {...campo("cor_fundo")} />
            </label>
            <label className="campo cor">
              <span>Cor de destaque (ícones e bordas)</span>
              <input type="color" name="p_cor_destaque" {...campo("cor_destaque")} />
            </label>
          </div>

          <div className="pilha">
            <strong>Botões da página</strong>
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
                + Adicionar botão
              </button>
            </div>
            <small className="suave">
              Só endereços https://. Para WhatsApp use https://wa.me/55DDDNUMERO. Logo e imagem de fundo ficam na
              seção “Imagens da página”, logo abaixo.
            </small>
          </div>
        </div>
      )}

      <label className="campo">
        <span>Cliente / loja (opcional, uso interno)</span>
        <input type="text" name="cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={120} autoComplete="off" />
      </label>
      <label className="campo">
        <span>Observações internas (nunca aparecem em página pública)</span>
        <textarea name="notas" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={1000} rows={3} />
      </label>

      {estado.tipo === "confirmar" && enviado === digitado && (
        <div className="aviso atencao" role="alert">
          <strong>Confirme antes de salvar. Nada foi alterado ainda.</strong>
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
              <a className="botao pequeno" href={props.urlPublica} target="_blank" rel="noopener noreferrer">Testar pelo QR (URL pública)</a>
            )}
            {estado.modo === "LINK" && estado.destino && (
              <a className="botao pequeno" href={estado.destino} target="_blank" rel="noopener noreferrer nofollow">Abrir destino direto</a>
            )}
            {estado.modo === "PAGINA" && (
              <a className="botao pequeno" href={`/api/codigos/${props.id}/previa`} target="_blank" rel="noopener noreferrer">Ver prévia da página</a>
            )}
          </p>
        </div>
      )}
      <div><button className="botao primario" disabled={enviando}>{enviando ? "Salvando…" : "Salvar configuração"}</button></div>
    </form>
  );
}
