"use client";

import { useState } from "react";
import { FormConfiguracao, type PropsDaConfiguracao } from "./FormConfiguracao";
import { ImagensDaPagina, type PropsDasImagens } from "./ImagensDaPagina";

type Props = {
  titulo: string; aviso?: React.ReactNode;
  configuracao: PropsDaConfiguracao; imagens: PropsDasImagens;
  /** Já existe página de links salva: as imagens aparecem mesmo com o código em link direto. */
  temPagina: boolean;
};

/**
 * Seções "configuração" e "imagens da página" de um código. As imagens aparecem assim que
 * "Página de links" é escolhida, sem precisar salvar antes: elas ficam ligadas ao código.
 */
export function SecoesDeConteudo({ titulo, aviso, configuracao, imagens, temPagina }: Props) {
  const [modo, setModo] = useState(configuracao.modo);
  const imagem = (tipo: "logo" | "fundo") =>
    imagens.versoes[tipo] ? `/api/codigos/${imagens.id}/imagem/${tipo}?v=${imagens.versoes[tipo]}` : undefined;
  return (
    <>
      <section className="secao">
        <h2>{titulo}</h2>
        <div>
          {aviso}
          <FormConfiguracao {...configuracao} aoMudarModo={setModo} imagensDaPrevia={{ logo: imagem("logo"), fundo: imagem("fundo") }} />
        </div>
      </section>
      {(modo === "PAGINA" || temPagina) && (
        <section className="secao">
          <h2>Imagens da página</h2>
          <div><ImagensDaPagina {...imagens} /></div>
        </section>
      )}
    </>
  );
}
