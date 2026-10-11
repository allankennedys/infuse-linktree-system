"use client";

import { useActionState } from "react";
import { acaoImagem, type EstadoSimples } from "@/app/(painel)/acoes";

type Props = { id: number; versoes: { logo?: number; fundo?: number }; limitesKb: { logo: number; fundo: number } };

const TEXTOS = {
  logo: { titulo: "Logo", dica: "Aparece no topo. PNG com fundo transparente fica melhor." },
  fundo: { titulo: "Imagem de fundo", dica: "Opcional. Quando existe, cobre a cor de fundo e recebe uma película escura para o texto continuar legível." },
} as const;

export function ImagensDaPagina({ id, versoes, limitesKb }: Props) {
  const [estado, acao, enviando] = useActionState<EstadoSimples, FormData>(acaoImagem, {});
  return (
    <>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="aviso sucesso" role="status">{estado.ok}</p>}
      <div className="grade-2">
        {(["logo", "fundo"] as const).map((tipo) => (
          <div className="imagem-da-pagina" key={tipo}>
            <strong>{TEXTOS[tipo].titulo}</strong>
            <p className="suave">{TEXTOS[tipo].dica} PNG, JPG ou WebP, até {limitesKb[tipo]} KB.</p>
            {versoes[tipo] ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem servida por rota autenticada
              <img className={`miniatura ${tipo}`} src={`/api/codigos/${id}/imagem/${tipo}?v=${versoes[tipo]}`} alt={`${TEXTOS[tipo].titulo} atual`} />
            ) : (
              <p className="suave">Nenhuma imagem enviada.</p>
            )}
            <form action={acao} className="linha-form">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="tipo" value={tipo} />
              <input type="file" name="arquivo" accept="image/png,image/jpeg,image/webp" required aria-label={`Arquivo: ${TEXTOS[tipo].titulo}`} />
              <button className="botao pequeno" disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button>
            </form>
            {versoes[tipo] && (
              <form action={acao}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="tipo" value={tipo} />
                <input type="hidden" name="remover" value="1" />
                <button className="botao pequeno perigo" disabled={enviando}>Remover</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
