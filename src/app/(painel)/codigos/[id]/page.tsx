import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AcessoDoCliente } from "@/componentes/AcessoDoCliente";
import { Etiqueta } from "@/componentes/Etiqueta";
import { FormConfiguracao } from "@/componentes/FormConfiguracao";
import { ImagensDaPagina } from "@/componentes/ImagensDaPagina";
import { PainelDeAcoes } from "@/componentes/PainelDeAcoes";
import { exigirAdmin } from "@/lib/auth";
import { autorDe, historicoDoCodigo, ROTULO_ACAO } from "@/lib/auditoria";
import { obterCodigo } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { formatarData, inteiroPositivo } from "@/lib/formato";
import { SENHA_MINIMA_GERENTE } from "@/lib/gerentes";
import { ICONES } from "@/lib/icones";
import { LIMITES_PAGINA, obterPagina, PADRAO_PAGINA, TAMANHO_MAXIMO_IMAGEM, versoesDasImagens } from "@/lib/pagina";
import { formatarNumero, urlPublica } from "@/lib/token";

export const metadata: Metadata = { title: "Código" };

function detalhes(meta: Record<string, unknown>): string {
  const partes: string[] = [];
  if ("para_host" in meta || "de_host" in meta) partes.push(`${meta.de_host ?? "sem destino"} → ${meta.para_host ?? "sem destino"}`);
  if (meta.de && meta.para) partes.push(`${meta.de === "LINK" ? "link direto" : "página de links"} → ${meta.para === "LINK" ? "link direto" : "página de links"}`);
  if (typeof meta.links === "number") partes.push(`${meta.links} botão(ões)`);
  if (meta.tipo) partes.push(`${meta.tipo}${meta.removida ? " removida" : ""}`);
  if (meta.formato) partes.push(String(meta.formato).toUpperCase());
  if (meta.status_anterior) partes.push(`estava ${String(meta.status_anterior).toLowerCase()}`);
  return partes.join(" · ");
}

export default async function PaginaDoCodigo({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const id = inteiroPositivo((await params).id);
  const db = getDb();
  const codigo = id ? await obterCodigo(db, id) : null;
  if (!codigo) notFound();
  const [historico, pagina, versoes] = await Promise.all([
    historicoDoCodigo(db, codigo.id), obterPagina(db, codigo.id), versoesDasImagens(db, codigo.id),
  ]);
  const ehPagina = codigo.modo === "PAGINA";

  let publica: string | null = null;
  try {
    publica = urlPublica(baseUrl(), codigo.token);
  } catch {}
  const png = `/api/codigos/${codigo.id}/png`;
  const cabecalhos = await headers();
  const host = cabecalhos.get("host") ?? "";
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const enderecoDeLogin = `${protocolo}://${host}/login`;
  const ativo = codigo.status === "CONFIGURADO" && (ehPagina ? !!pagina : !!codigo.destino);

  return (
    <>
      <div className="titulo-pagina">
        <h1>{formatarNumero(codigo.numero)} <Etiqueta status={codigo.status} /></h1>
        <Link className="botao" href={`/lotes/${codigo.lote_id}`}>Lote {codigo.lote_nome}</Link>
      </div>

      <section className="resumo-codigo">
        <div className="qr">
          {publica ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem gerada por rota autenticada
            <img src={`${png}?previa=1`} alt={`QR Code ${formatarNumero(codigo.numero)}`} width={180} />
          ) : (
            <p className="aviso erro">APP_BASE_URL não configurada: não é possível gerar o QR.</p>
          )}
          <div className="acoes-linha">
            <a className="botao pequeno" href={png}>PNG</a>
            <a className="botao pequeno" href={`${png}?legenda=1`}>PNG com legenda</a>
          </div>
        </div>

        <dl className="dados">
            <dt>Endereço do QR</dt>
            <dd className="mono quebra">{publica ?? "—"}</dd>
            <dt>Destino</dt>
            <dd className="quebra">
              {ehPagina
                ? pagina
                  ? <>Página de links “{pagina.titulo}”, {pagina.links.length} botão(ões).{" "}
                      <a href={`/api/codigos/${codigo.id}/previa`} target="_blank" rel="noopener noreferrer">Ver prévia</a></>
                  : "Página de links ainda não preenchida"
                : codigo.destino
                  ? <a className="mono" href={codigo.destino} target="_blank" rel="noopener noreferrer nofollow">{codigo.destino}</a>
                  : "Nenhum"}
            </dd>
            <dt>Ao ler o QR agora</dt>
            <dd>
              {codigo.status === "DISPONIVEL"
                ? "Abre a página da Infuse com o nº de inventário."
                : !ativo
                  ? "Mostra a página de código indisponível."
                  : ehPagina
                    ? "Abre a página de links."
                    : "Redireciona para o destino."}
            </dd>
            <dt>Leituras</dt>
            <dd>{codigo.acessos}{codigo.ultimo_acesso_em && <span className="suave"> (última em {formatarData(codigo.ultimo_acesso_em)})</span>}</dd>
            <dt>Criado</dt>
            <dd>{formatarData(codigo.criado_em)}</dd>
            <dt>Configurado</dt>
            <dd>{formatarData(codigo.configurado_em)}</dd>
            <dt>Alterado</dt>
            <dd>{formatarData(codigo.atualizado_em)}</dd>
        </dl>
      </section>

      {codigo.status !== "ARQUIVADO" && (
        <section className="secao">
          <h2>Configuração</h2>
          <div>
          {codigo.status === "DESATIVADO" && (
            <p className="aviso atencao">Código desativado. Dá para editar, mas ele só volta a funcionar depois de reativado.</p>
          )}
          <FormConfiguracao
            id={codigo.id} urlPublica={publica} modo={codigo.modo}
            destino={codigo.destino ?? ""} cliente={codigo.cliente ?? ""} notas={codigo.notas ?? ""}
            pagina={{
              titulo: pagina?.titulo ?? "", subtitulo: pagina?.subtitulo ?? "",
              subtitulo_url: pagina?.subtitulo_url ?? "", rodape: pagina?.rodape ?? "",
              cor_fundo: pagina?.cor_fundo ?? PADRAO_PAGINA.cor_fundo,
              cor_destaque: pagina?.cor_destaque ?? PADRAO_PAGINA.cor_destaque,
              links: pagina?.links ?? [{ rotulo: "", url: "", icone: "link" }],
            }}
            icones={Object.entries(ICONES).map(([chave, i]) => ({ chave, rotulo: i.rotulo }))}
            maximoDeLinks={LIMITES_PAGINA.links}
          />
          </div>
        </section>
      )}

      {codigo.status !== "ARQUIVADO" && (ehPagina || pagina) && (
        <section className="secao">
          <h2>Imagens da página</h2>
          <div>
          <ImagensDaPagina
            id={codigo.id} versoes={versoes}
            limitesKb={{ logo: TAMANHO_MAXIMO_IMAGEM.logo / 1024, fundo: TAMANHO_MAXIMO_IMAGEM.fundo / 1024 }}
          />
          </div>
        </section>
      )}

      {codigo.status !== "ARQUIVADO" && (
        <section className="secao">
          <h2>Acesso do cliente</h2>
          <div>
            <AcessoDoCliente
              id={codigo.id} usuario={codigo.gerente_usuario} enderecoDeLogin={enderecoDeLogin}
              senhaMinima={SENHA_MINIMA_GERENTE}
            />
          </div>
        </section>
      )}

      <section className="secao">
        <h2>Ações</h2>
        <div>
        <PainelDeAcoes
          id={codigo.id} status={codigo.status} temDestino={ehPagina ? !!pagina : !!codigo.destino}
          temDados={!!(codigo.cliente || codigo.notas || codigo.destino || pagina || versoes.logo || versoes.fundo || codigo.gerente_id)}
        />
        </div>
      </section>

      <section className="secao">
        <h2>Histórico</h2>
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Quando</th><th>Ação</th><th>Detalhes</th><th>Quem</th></tr></thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.id}>
                  <td className="suave">{formatarData(h.em)}</td>
                  <td>{ROTULO_ACAO[h.acao] ?? h.acao}</td>
                  <td className="mono quebra">{detalhes(h.meta)}</td>
                  <td>{autorDe(h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
