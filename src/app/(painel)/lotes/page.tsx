import type { Metadata } from "next";
import Link from "next/link";
import { FormGerarLote } from "@/componentes/FormGerarLote";
import { exigirAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { baseUrl, ErroDeConfiguracao } from "@/lib/env";
import { formatarData } from "@/lib/formato";
import { LIMITE_LOTE, listarLotes } from "@/lib/lotes";

export const metadata: Metadata = { title: "Lotes" };

export default async function Lotes() {
  await exigirAdmin();
  const lotes = await listarLotes(getDb());
  let base: string | null = null;
  let problema: string | null = null;
  try {
    base = baseUrl();
  } catch (e) {
    problema = e instanceof ErroDeConfiguracao ? e.message : "APP_BASE_URL inválida.";
  }

  return (
    <>
      <div className="titulo-pagina"><h1>Lotes</h1></div>

      <section className="cartao">
        <h2>Gerar QR Codes</h2>
        {base ? (
          <p className="suave">
            Cada código aponta para <span className="mono">{base}/q/&lt;token aleatório&gt;</span>. Esse endereço é
            definitivo: depois de impresso, só o destino muda. Confira o domínio antes de imprimir.
          </p>
        ) : (
          <p className="aviso erro" role="alert">{problema}</p>
        )}
        <FormGerarLote limite={LIMITE_LOTE} bloqueado={!base} />
      </section>

      <div className="tabela-rolagem">
        <table>
          <thead><tr><th>Lote</th><th>Códigos</th><th>Situação</th><th>Criado em</th><th>Criado por</th><th></th></tr></thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id}>
                <td>{l.nome} <span className="suave">#{l.id}</span></td>
                <td>{l.status === "PRONTO" ? l.quantidade : `0 de ${l.quantidade}`}</td>
                <td>
                  {l.status === "PRONTO" ? <span className="etiqueta configurado">Pronto</span>
                    : <span className="etiqueta com-erro" title={l.erro ?? undefined}>Falhou — nada criado</span>}
                </td>
                <td>{formatarData(l.criado_em)}</td>
                <td>{l.criado_por_usuario ?? "—"}</td>
                <td>{l.status === "PRONTO" && <Link className="botao pequeno" href={`/lotes/${l.id}`}>Abrir e exportar</Link>}</td>
              </tr>
            ))}
            {lotes.length === 0 && <tr><td colSpan={6} className="vazio">Nenhum lote gerado.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
