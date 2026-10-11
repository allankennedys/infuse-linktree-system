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
  const link = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (loteId) params.set("lote", String(loteId));
    if (p > 1) params.set("pagina", String(p));
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <div className="titulo-pagina">
        <h1>Códigos</h1>
        <Link className="botao primario" href="/lotes">Gerar QR Codes</Link>
      </div>

      <section className="resumo">
        {STATUS.map((s) => (
          <Link key={s} href={`/?status=${s}`} className={`numero ${s.toLowerCase()}`}>
            <span>{ROTULO_STATUS[s]}</span>
            <strong>{totais[s]}</strong>
          </Link>
        ))}
        <Link href="/lotes" className={`numero ${totais.lotesComErro ? "com-erro" : ""}`}>
          <span>Lotes com erro</span>
          <strong>{totais.lotesComErro}</strong>
        </Link>
      </section>

      <form className="filtros" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nº de inventário, cliente ou lote" maxLength={80} />
        <select name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">Todos os status</option>
          {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
        </select>
        <select name="lote" defaultValue={loteId ?? ""} aria-label="Lote">
          <option value="">Todos os lotes</option>
          {lotes.filter((l) => l.status === "PRONTO").map((l) => <option key={l.id} value={l.id}>{l.nome} (#{l.id})</option>)}
        </select>
        <button className="botao">Filtrar</button>
        {(q || status || loteId) && <Link href="/" className="suave">Limpar</Link>}
      </form>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Nº</th><th>Lote</th><th>Status</th><th>Cliente</th><th>Destino atual</th>
              <th>Criado em</th><th>Última alteração</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lista.itens.map((c) => (
              <tr key={c.id}>
                <td className="mono"><Link href={`/codigos/${c.id}`}>{formatarNumero(c.numero)}</Link></td>
                <td>{c.lote_nome}</td>
                <td><Etiqueta status={c.status} /></td>
                <td>{c.cliente ?? "—"}</td>
                <td className="mono quebra">{c.modo === "PAGINA" ? `Página: ${c.pagina_titulo ?? "não preenchida"}` : resumirDestino(c.destino)}</td>
                <td>{formatarData(c.criado_em)}</td>
                <td>{formatarData(c.atualizado_em)}</td>
                <td><Link className="botao pequeno" href={`/codigos/${c.id}`}>Abrir</Link></td>
              </tr>
            ))}
            {lista.itens.length === 0 && (
              <tr><td colSpan={8} className="vazio">
                {lista.total === 0 && !q && !status && !loteId
                  ? "Nenhum código ainda. Gere o primeiro lote."
                  : "Nenhum código corresponde aos filtros."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="paginacao">
        <span className="suave">{lista.total} código(s) · página {Math.min(pagina, paginas)} de {paginas}</span>
        {pagina > 1 && <Link className="botao pequeno" href={link(pagina - 1)}>Anterior</Link>}
        {pagina < paginas && <Link className="botao pequeno" href={link(pagina + 1)}>Próxima</Link>}
      </nav>
    </>
  );
}
