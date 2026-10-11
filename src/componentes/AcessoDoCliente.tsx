"use client";

import { useActionState, useState } from "react";
import { acaoGerente, type EstadoSimples } from "@/app/(painel)/acoes";

type Props = { id: number; usuario: string | null; enderecoDeLogin: string; senhaMinima: number };

// Sem caracteres que se confundem ao ditar ou copiar à mão (0/O, 1/l/I).
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function senhaAleatoria(tamanho = 12): string {
  const sorteio = crypto.getRandomValues(new Uint32Array(tamanho));
  return Array.from(sorteio, (n) => ALFABETO[n % ALFABETO.length]).join("");
}

export function AcessoDoCliente({ id, usuario: atual, enderecoDeLogin, senhaMinima }: Props) {
  const [estado, acao, enviando] = useActionState<EstadoSimples, FormData>(acaoGerente, {});
  const [usuario, setUsuario] = useState(atual ?? "");
  const [senha, setSenha] = useState("");
  // O que foi enviado por último: é o que se mostra para repassar ao cliente.
  const [enviado, setEnviado] = useState<{ usuario: string; senha: string } | null>(null);

  return (
    <>
      <p className="suave">
        {atual
          ? <>Gerenciado por <strong>{atual}</strong>, que entra em <span className="mono">{enderecoDeLogin}</span> e edita só este conteúdo.</>
          : "Nenhum. Crie um usuário para o cliente editar os links e a aparência deste QR."}
      </p>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.ok && (
        <div className="aviso sucesso" role="status">
          <span>{estado.ok}</span>
          {enviado?.senha && atual === enviado.usuario && (
            <dl className="dados">
              <dt>Endereço</dt><dd className="mono quebra">{enderecoDeLogin}</dd>
              <dt>Usuário</dt><dd className="mono">{enviado.usuario}</dd>
              <dt>Senha</dt><dd className="mono quebra">{enviado.senha}</dd>
            </dl>
          )}
          {enviado?.senha && atual === enviado.usuario && <span>Anote agora: a senha não aparece de novo.</span>}
        </div>
      )}
      <form action={acao} className="linha-form" onSubmit={() => setEnviado({ usuario: usuario.trim().toLowerCase(), senha })}>
        <input type="hidden" name="id" value={id} />
        <label className="campo cresce">
          <span>Usuário</span>
          <input type="text" name="usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)}
            maxLength={40} required autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="padaria-do-ze" />
        </label>
        <label className="campo cresce">
          <span>{atual ? "Nova senha" : "Senha"}</span>
          <input type="text" name="senha" value={senha} onChange={(e) => setSenha(e.target.value)}
            minLength={senhaMinima} maxLength={200} required={!atual} autoComplete="off" spellCheck={false}
            placeholder={atual ? "Em branco mantém a atual" : `Mínimo de ${senhaMinima} caracteres`} />
        </label>
        <button type="button" className="botao" onClick={() => setSenha(senhaAleatoria())}>Gerar senha</button>
        <button className="botao primario" disabled={enviando}>{enviando ? "Salvando…" : "Salvar acesso"}</button>
      </form>
      {atual && (
        <form action={acao} onSubmit={() => setEnviado(null)}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="remover" value="1" />
          <button className="botao pequeno perigo" disabled={enviando}>Remover acesso</button>
        </form>
      )}
    </>
  );
}
