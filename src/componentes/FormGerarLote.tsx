"use client";

import { useActionState } from "react";
import { acaoGerarLote, type EstadoSimples } from "@/app/(painel)/acoes";

export function FormGerarLote({ limite, bloqueado }: { limite: number; bloqueado: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoSimples, FormData>(acaoGerarLote, {});
  return (
    <form action={acao} className="linha-form">
      <label className="campo">
        <span>Quantidade</span>
        <input type="number" name="quantidade" min={1} max={limite} defaultValue={10} required />
      </label>
      <label className="campo cresce">
        <span>Nome do lote (opcional)</span>
        <input type="text" name="nome" maxLength={40} placeholder="Ex.: Plaquinhas outubro" />
      </label>
      <button className="botao primario" disabled={enviando || bloqueado}>
        {enviando ? "Gerando e conferindo…" : "Gerar QR Codes"}
      </button>
      {estado.erro && <p className="aviso erro largura-total" role="alert">{estado.erro}</p>}
    </form>
  );
}
