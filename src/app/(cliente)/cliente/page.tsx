import Link from "next/link";
import { redirect } from "next/navigation";
import { Etiqueta } from "@/componentes/Etiqueta";
import { exigirGerente } from "@/lib/auth";
import { codigosDoGerente } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { resumirDestino } from "@/lib/formato";
import { formatarNumero } from "@/lib/token";

export default async function MeusCodigos() {
  const gerente = await exigirGerente();
  const codigos = await codigosDoGerente(getDb(), gerente.id);
  // Quem tem uma plaquinha só vai direto para ela.
  if (codigos.length === 1) redirect(`/cliente/${codigos[0]!.id}`);

  return (
    <>
      <div className="titulo-pagina"><h1>Meus QR Codes</h1></div>
      <div className="tabela-rolagem">
        <table>
          <thead><tr><th>Nº</th><th>Situação</th><th>Abre</th><th></th></tr></thead>
          <tbody>
            {codigos.map((c) => (
              <tr key={c.id}>
                <td className="mono"><Link href={`/cliente/${c.id}`}>{formatarNumero(c.numero)}</Link></td>
                <td><Etiqueta status={c.status} /></td>
                <td className="quebra">{c.modo === "PAGINA" ? `Página “${c.pagina_titulo ?? "sem nome"}”` : resumirDestino(c.destino)}</td>
                <td className="direita"><Link className="botao pequeno" href={`/cliente/${c.id}`}>Editar</Link></td>
              </tr>
            ))}
            {codigos.length === 0 && (
              <tr><td colSpan={4} className="vazio">Nenhum QR Code ligado a este usuário. Fale com a Infuse.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
