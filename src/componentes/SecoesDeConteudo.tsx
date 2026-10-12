"use client";

import { useActionState, useId } from "react";
import { acaoImagem, type EstadoSimples } from "@/app/(painel)/acoes";
import { FormConfiguracao, type PropsDaConfiguracao } from "./FormConfiguracao";
import { FormulariosDeImagem, ImagensDaPagina, type PropsDasImagens } from "./ImagensDaPagina";

type Props = { titulo: string; aviso?: React.ReactNode; configuracao: PropsDaConfiguracao; imagens: PropsDasImagens };

/**
 * Seção de configuração de um código. Logo e imagem de fundo ficam dentro do editor da página
 * de links, ao lado da prévia, e podem ser enviados antes de salvar: ficam ligados ao código.
 */
export function SecoesDeConteudo({ titulo, aviso, configuracao, imagens }: Props) {
  const [estado, acao, enviando] = useActionState<EstadoSimples, FormData>(imagens.acao ?? acaoImagem, {});
  const prefixo = useId();
  const imagem = (tipo: "logo" | "fundo") =>
    imagens.versoes[tipo] ? `/api/codigos/${imagens.id}/imagem/${tipo}?v=${imagens.versoes[tipo]}` : undefined;
  return (
    <section className="secao">
      <h2>{titulo}</h2>
      <div>
        {aviso}
        <FormConfiguracao
          {...configuracao}
          imagensDaPrevia={{ logo: imagem("logo"), fundo: imagem("fundo") }}
          camposDeImagem={<ImagensDaPagina id={imagens.id} versoes={imagens.versoes} limitesKb={imagens.limitesKb} estado={estado} enviando={enviando} prefixo={prefixo} />}
        />
        <FormulariosDeImagem id={imagens.id} acao={acao} prefixo={prefixo} />
      </div>
    </section>
  );
}
