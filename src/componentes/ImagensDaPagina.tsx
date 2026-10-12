"use client";

import type { acaoImagem, EstadoSimples } from "@/app/(painel)/acoes";

export type PropsDasImagens = {
  id: number; versoes: { logo?: number; fundo?: number }; limitesKb: { logo: number; fundo: number };
  /** Área do cliente: usa a action do gerente. */
  acao?: typeof acaoImagem;
};

const TIPOS = ["logo", "fundo"] as const;
const TEXTOS = {
  logo: { titulo: "Logo", dica: "PNG com fundo transparente fica melhor." },
  fundo: { titulo: "Imagem de fundo", dica: "Cobre a cor de fundo e fica escurecida para o texto continuar legível." },
} as const;

type Envio = { estado: EstadoSimples; enviando: boolean; prefixo: string };

/**
 * Campos de logo e imagem de fundo. Ficam dentro do editor da página (que é outro formulário),
 * então cada campo aponta, pelo atributo `form`, para um dos formulários de <FormulariosDeImagem>.
 */
export function ImagensDaPagina({ id, versoes, limitesKb, estado, enviando, prefixo }: Omit<PropsDasImagens, "acao"> & Envio) {
  return (
    <div className="pilha">
      <strong>Imagens</strong>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="aviso sucesso" role="status">{estado.ok}</p>}
      <div className="grade-2">
        {TIPOS.map((tipo) => (
          <div className="imagem-da-pagina" key={tipo}>
            <span className="rotulo-campo">{TEXTOS[tipo].titulo}</span>
            {versoes[tipo] && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem servida por rota autenticada
              <img className={`miniatura ${tipo}`} src={`/api/codigos/${id}/imagem/${tipo}?v=${versoes[tipo]}`} alt={`${TEXTOS[tipo].titulo} atual`} />
            )}
            <div className="linha-form">
              <input type="file" name="arquivo" form={`${prefixo}-${tipo}`} accept="image/png,image/jpeg,image/webp" required aria-label={`Arquivo: ${TEXTOS[tipo].titulo}`} />
              <button className="botao pequeno" form={`${prefixo}-${tipo}`} disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button>
              {versoes[tipo] && (
                <button className="botao pequeno perigo" form={`${prefixo}-${tipo}-remover`} disabled={enviando}>Remover</button>
              )}
            </div>
            <small className="suave">{TEXTOS[tipo].dica} PNG, JPG ou WebP, até {limitesKb[tipo]} KB.</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Os formulários de envio e remoção das imagens, fora do formulário do editor (formulário dentro de formulário não existe). */
export function FormulariosDeImagem({ id, acao, prefixo }: { id: number; acao: (dados: FormData) => void; prefixo: string }) {
  return (
    <>
      {TIPOS.map((tipo) => (
        <form id={`${prefixo}-${tipo}`} action={acao} key={tipo} hidden>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tipo" value={tipo} />
        </form>
      ))}
      {TIPOS.map((tipo) => (
        <form id={`${prefixo}-${tipo}-remover`} action={acao} key={tipo} hidden>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="remover" value="1" />
        </form>
      ))}
    </>
  );
}
