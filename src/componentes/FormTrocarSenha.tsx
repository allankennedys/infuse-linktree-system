"use client";

import { useActionState } from "react";
import { acaoTrocarSenha } from "@/app/(cliente)/acoes";
import type { EstadoSimples } from "@/app/(painel)/acoes";

export function FormTrocarSenha({ senhaMinima }: { senhaMinima: number }) {
  const [estado, acao, enviando] = useActionState<EstadoSimples, FormData>(acaoTrocarSenha, {});
  return (
    <form action={acao} className="pilha exportar">
      <label className="campo">
        <span>Senha atual</span>
        <input type="password" name="atual" autoComplete="current-password" required maxLength={500} />
      </label>
      <label className="campo">
        <span>Nova senha</span>
        <input type="password" name="nova" autoComplete="new-password" required minLength={senhaMinima} maxLength={200} />
      </label>
      <label className="campo">
        <span>Repita a nova senha</span>
        <input type="password" name="repetir" autoComplete="new-password" required minLength={senhaMinima} maxLength={200} />
      </label>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="aviso sucesso" role="status">{estado.ok}</p>}
      <div><button className="botao primario" disabled={enviando}>{enviando ? "Salvando…" : "Trocar senha"}</button></div>
    </form>
  );
}
