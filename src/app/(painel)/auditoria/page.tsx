import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { autorDe, listarAuditoria, ROTULO_ACAO } from "@/lib/auditoria";
import { getDb } from "@/lib/db";
import { formatarData, inteiroPositivo } from "@/lib/formato";
import { formatarNumero } from "@/lib/token";

export const metadata: Metadata = { title: "Logs" };
const POR_PAGINA = 50;

export default async function Auditoria({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await exigirAdmin();
  const pagina = inteiroPositivo((await searchParams).pagina) ?? 1;
  const { itens, total } = await listarAuditoria(getDb(), pagina, POR_PAGINA);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="titulo-pagina"><h1>Logs</h1></div>
      <div className="tabela-rolagem">
        <table>
          <thead><tr><th>Quando</th><th>Ação</th><th>Alvo</th><th>Detalhes</th><th>Quem</th></tr></thead>
          <tbody>
            {itens.map((h) => (
              <tr key={h.id}>
                <td className="suave">{formatarData(h.em)}</td>
                <td data-rotulo="Ação">{ROTULO_ACAO[h.acao] ?? h.acao}</td>
                <td data-rotulo="Alvo" className="mono">
                  {h.codigo_id && h.numero ? <Link href={`/codigos/${h.codigo_id}`}>{formatarNumero(h.numero)}</Link>
                    : h.lote_id ? <Link href={`/lotes/${h.lote_id}`}>Lote #{h.lote_id}</Link> : "—"}
                </td>
                <td data-rotulo="Detalhes" className="mono quebra">
                  {Object.entries(h.meta).map(([k, v]) => `${k}: ${v ?? "—"}`).join(" · ")}
                </td>
                <td data-rotulo="Quem">{autorDe(h)}</td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={5} className="vazio">Nenhum evento registrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="paginacao">
        <span className="suave">{total} evento(s), página {Math.min(pagina, paginas)} de {paginas}</span>
        <span className="acoes-linha">
          {pagina > 1 && <Link className="botao pequeno" href={`/auditoria?pagina=${pagina - 1}`}>Anterior</Link>}
          {pagina < paginas && <Link className="botao pequeno" href={`/auditoria?pagina=${pagina + 1}`}>Próxima</Link>}
        </span>
      </nav>
    </>
  );
}
