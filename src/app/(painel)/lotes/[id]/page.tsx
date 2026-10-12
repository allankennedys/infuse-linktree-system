import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Etiqueta } from "@/componentes/Etiqueta";
import { exigirAdmin } from "@/lib/auth";
import type { Status } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { LAYOUTS } from "@/lib/exportar";
import { formatarData, inteiroPositivo } from "@/lib/formato";
import { codigosDoLote, obterLote } from "@/lib/lotes";
import { formatarNumero, idCurto } from "@/lib/token";

export const metadata: Metadata = { title: "Lote" };

export default async function Lote({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const id = inteiroPositivo((await params).id);
  const db = getDb();
  const lote = id ? await obterLote(db, id) : null;
  if (!lote || lote.status !== "PRONTO") notFound();
  const codigos = await codigosDoLote(db, lote.id);
  const api = `/api/lotes/${lote.id}`;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>{lote.nome} <span className="suave">#{lote.id}</span></h1>
          <p className="suave">
            {codigos.length} códigos, criado em {formatarData(lote.criado_em)} por {lote.criado_por_usuario ?? "—"}
          </p>
        </div>
        <Link className="botao" href={`/?lote=${lote.id}`}>Ver na lista de códigos</Link>
      </div>

      <section className="secao">
        <h2>Exportar</h2>
        <div>
        <form method="get" className="exportar">
          <label className="campo">
            <span>Layout do PDF</span>
            <select name="layout" defaultValue="grade">
              {Object.entries(LAYOUTS).map(([chave, l]) => <option key={chave} value={chave}>{l.rotulo}</option>)}
            </select>
          </label>
          <label className="confirmacao"><input type="checkbox" name="legenda" value="1" /> <span>Legenda com o nº de inventário</span></label>
          <label className="confirmacao"><input type="checkbox" name="guias" value="1" defaultChecked /> <span>Guias de corte</span></label>
          <div className="acoes-linha">
            <button className="botao primario" formAction={`${api}/pdf`}>Baixar PDF A4</button>
            <button className="botao" formAction={`${api}/pdf`} formTarget="_blank" name="abrir" value="1">Abrir PDF</button>
            <button className="botao" formAction={`${api}/zip`}>ZIP de PNGs</button>
            <button className="botao" formAction={`${api}/csv`}>CSV</button>
          </div>
        </form>
        <p className="suave">
          Imprima em 100%, sem “ajustar à página”. O PDF termina com a folha de conferência interna.
        </p>
        </div>
      </section>

      <section className="secao">
        <h2>Códigos</h2>
        <div className="tabela-rolagem">
        <table>
          <thead><tr><th>Nº</th><th>ID curto</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {codigos.map((c) => (
              <tr key={c.id}>
                <td className="mono"><Link href={`/codigos/${c.id}`}>{formatarNumero(c.numero)}</Link></td>
                <td data-rotulo="ID curto" className="mono">{idCurto(c.token)}</td>
                <td className="ao-lado"><Etiqueta status={c.status as Status} /></td>
                <td className="direita">
                  <div className="acoes-linha">
                    <a className="botao pequeno" href={`/api/codigos/${c.id}/png`}>PNG</a>
                    <Link className="botao pequeno" href={`/codigos/${c.id}`}>Configurar</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </>
  );
}
