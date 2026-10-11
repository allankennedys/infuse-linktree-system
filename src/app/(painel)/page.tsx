import Link from "next/link";
import { Etiqueta } from "@/componentes/Etiqueta";
import { exigirAdmin } from "@/lib/auth";
import { contagens, listarCodigos, ROTULO_STATUS, STATUS, type Status } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { formatarData, inteiroPositivo, resumirDestino } from "@/lib/formato";
import { listarLotes } from "@/lib/lotes";
import { formatarNumero } from "@/lib/token";

const POR_PAGINA = 25;
type Busca = { q?: string; status?: string; lote?: string; pagina?: string };

export default async function Codigos({ searchParams }: { searchParams: Promise<Busca> }) {
  await exigirAdmin();
  const busca = await searchParams;
  const db = getDb();
  const status = STATUS.includes(busca.status as Status) ? (busca.status as Status) : undefined;
  const loteId = inteiroPositivo(busca.lote);
  const pagina = inteiroPositivo(busca.pagina) ?? 1;
  const q = (busca.q ?? "").slice(0, 80);

  const [totais, lista, lotes] = await Promise.all([
    contagens(db),
    listarCodigos(db, { q, status, loteId, pagina, porPagina: POR_PAGINA }),
    listarLotes(db),
  ]);
  const paginas = Math.max(1, Math.ceil(lista.total / POR_PAGINA));
  const link = (p: number, s: Status | null = status ?? null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (s) params.set("status", s);
    if (loteId) params.set("lote", String(loteId));
    if (p > 1) params.set("pagina", String(p));
    const texto = params.toString();
    return texto ? `/?${texto}` : "/";
  };
  const todos = STATUS.reduce((soma, s) => soma + totais[s], 0);

  return (
    <>
      <div className="titulo-pagina">
        <h1>Códigos</h1>
        <Link className="botao primario" href="/lotes">Gerar QR Codes</Link>
      </div>

      {totais.lotesComErro > 0 && (
        <p className="aviso erro">
          {totais.lotesComErro} lote(s) falharam na geração e não criaram códigos. <Link href="/lotes">Ver lotes</Link>
        </p>
      )}

      <nav className="abas" aria-label="Filtrar por status">
        <Link href={link(1, null)} aria-current={status ? undefined : "true"}>Todos <strong>{todos}</strong></Link>
        {STATUS.map((s) => (
          <Link key={s} href={link(1, s)} aria-current={status === s ? "true" : undefined}>
            {ROTULO_STATUS[s]} <strong>{totais[s]}</strong>
          </Link>
        ))}
      </nav>

      <form className="filtros" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <input type="search" name="q" defaultValue={q} placeholder="Nº de inventário, cliente ou lote" maxLength={80} aria-label="Buscar" />
        <select name="lote" defaultValue={loteId ?? ""} aria-label="Lote">
          <option value="">Todos os lotes</option>
          {lotes.filter((l) => l.status === "PRONTO").map((l) => <option key={l.id} value={l.id}>{l.nome} (#{l.id})</option>)}
        </select>
        <button className="botao">Buscar</button>
        {(q || loteId) && <Link href={status ? `/?status=${status}` : "/"} className="suave">Limpar</Link>}
      </form>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Nº</th><th>Status</th><th>Cliente</th><th>Destino</th><th>Lote</th>
              <th>Criado</th><th>Alterado</th>
            </tr>
          </thead>
          <tbody>
            {lista.itens.map((c) => (
              <tr key={c.id}>
                <td className="mono"><Link href={`/codigos/${c.id}`}>{formatarNumero(c.numero)}</Link></td>
                <td><Etiqueta status={c.status} /></td>
                <td>{c.cliente ?? "—"}</td>
                <td className="mono quebra">{c.modo === "PAGINA" ? `Página: ${c.pagina_titulo ?? "não preenchida"}` : resumirDestino(c.destino)}</td>
                <td>{c.lote_nome}</td>
                <td className="suave">{formatarData(c.criado_em)}</td>
                <td className="suave">{formatarData(c.atualizado_em)}</td>
              </tr>
            ))}
            {lista.itens.length === 0 && (
              <tr><td colSpan={7} className="vazio">
                {lista.total === 0 && !q && !status && !loteId
                  ? "Nenhum código ainda. Gere o primeiro lote."
                  : "Nenhum código corresponde aos filtros."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="paginacao">
        <span className="suave">{lista.total} código(s), página {Math.min(pagina, paginas)} de {paginas}</span>
        <span className="acoes-linha">
          {pagina > 1 && <Link className="botao pequeno" href={link(pagina - 1)}>Anterior</Link>}
          {pagina < paginas && <Link className="botao pequeno" href={link(pagina + 1)}>Próxima</Link>}
        </span>
      </nav>
    </>
  );
}
