"use client";

import { useActionState } from "react";
import { acaoOperar, type EstadoSimples } from "@/app/(painel)/acoes";
import type { Status } from "@/lib/codigos";

type Props = { id: number; status: Status; temDestino: boolean; temDados: boolean };

type Item = {
  operacao: string;
  rotulo: string;
  descricao: string;
  /** Texto da caixa de confirmação; ausente = operação segura. */
  confirmacao?: string;
};

function operacoesPara({ status, temDestino, temDados }: Props): Item[] {
  const itens: Item[] = [];
  if (status === "DISPONIVEL" || status === "CONFIGURADO") {
    itens.push({
      operacao: "desativar", rotulo: "Desativar",
      descricao: "O QR para de funcionar e passa a mostrar a página de indisponível. O destino ou a página ficam guardados e podem ser reativados.",
      confirmacao: "Entendo que a plaquinha deste código para de funcionar até ser reativada.",
    });
  }
  if (status === "DESATIVADO") {
    itens.push({
      operacao: "reativar", rotulo: "Reativar",
      descricao: temDestino ? "Volta a funcionar com o destino ou a página que está salva." : "Volta a ficar disponível, sem destino.",
    });
  }
  if (status === "ARQUIVADO") {
    itens.push({
      operacao: "desarquivar", rotulo: "Desarquivar",
      descricao: "O código volta como desativado. Para funcionar de novo é preciso reativar.",
    });
  } else {
    itens.push({
      operacao: "arquivar", rotulo: "Arquivar",
      descricao: "Tira o código de circulação: não redireciona e não aceita nova configuração. O registro e o histórico são mantidos.",
      confirmacao: "Entendo que, se esta plaquinha já foi impressa ou vendida, ela deixa de funcionar.",
    });
  }
  if (temDados) {
    itens.push({
      operacao: "limpar-dados", rotulo: "Remover dados do cliente",
      descricao: "Apaga nome do cliente, observações, destino, página de links e imagens deste código (pedido de remoção ou troca de dono). O histórico de auditoria é mantido sem esses dados.",
      confirmacao: "Confirmo a remoção. O código deixa de funcionar e esta ação não pode ser desfeita.",
    });
  }
  return itens;
}

export function PainelDeAcoes(props: Props) {
  // Um estado só para todas as operações: o resultado continua visível depois que
  // a lista de ações muda (ex.: "Desativar" dá lugar a "Reativar").
  const [estado, acao, enviando] = useActionState<EstadoSimples, FormData>(acaoOperar, {});
  return (
    <>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="aviso sucesso" role="status">{estado.ok}</p>}
      {operacoesPara(props).map((item) => (
        <form action={acao} className="operacao" key={item.operacao}>
          <input type="hidden" name="id" value={props.id} />
          <input type="hidden" name="operacao" value={item.operacao} />
          <div>
            <strong>{item.rotulo}</strong>
            <p className="suave">{item.descricao}</p>
            {item.confirmacao && (
              <label className="confirmacao">
                <input type="checkbox" name="confirmar" required /> <span>{item.confirmacao}</span>
              </label>
            )}
          </div>
          <button className={`botao ${item.confirmacao ? "perigo" : ""}`} disabled={enviando}>
            {enviando ? "Aguarde…" : item.rotulo}
          </button>
        </form>
      ))}
    </>
  );
}
