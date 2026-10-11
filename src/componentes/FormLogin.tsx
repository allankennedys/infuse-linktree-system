"use client";

import { useActionState } from "react";
import { acaoEntrar, type EstadoLogin } from "@/app/login/acoes";

export function FormLogin() {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(acaoEntrar, {});
  return (
    <form action={acao} className="pilha">
      <label className="campo">
        <span>Usuário</span>
        <input type="text" name="usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={200} />
      </label>
      <label className="campo">
        <span>Senha</span>
        <input type="password" name="senha" autoComplete="current-password" required maxLength={500} />
      </label>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <button className="botao primario" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
