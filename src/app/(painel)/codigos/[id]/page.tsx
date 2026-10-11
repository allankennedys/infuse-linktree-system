import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Etiqueta } from "@/componentes/Etiqueta";
import { FormConfiguracao } from "@/componentes/FormConfiguracao";
import { ImagensDaPagina } from "@/componentes/ImagensDaPagina";
import { PainelDeAcoes } from "@/componentes/PainelDeAcoes";
import { exigirAdmin } from "@/lib/auth";
import { historicoDoCodigo, ROTULO_ACAO } from "@/lib/auditoria";
import { obterCodigo } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { formatarData, inteiroPositivo } from "@/lib/formato";
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
  const ativo = codigo.status === "CONFIGURADO" && (ehPagina ? !!pagina : !!codigo.destino);

  return (
    <>
      <div className="titulo-pagina">
        <h1><span className="mono">{formatarNumero(codigo.numero)}</span> <Etiqueta status={codigo.status} /></h1>
        <Link className="botao" href={`/lotes/${codigo.lote_id}`}>Lote: {codigo.lote_nome}</Link>
      </div>

      <section className="duas-colunas">
        <div className="cartao qr">
          {publica ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem gerada por rota autenticada
            <img src={`${png}?previa=1&legenda=1`} alt={`QR Code ${formatarNumero(codigo.numero)}`} width={220} />
          ) : (
            <p className="aviso erro">APP_BASE_URL não configurada: não é possível gerar o QR.</p>
          )}
          <div className="acoes-linha">
            <a className="botao pequeno" href={`${png}?legenda=1`}>PNG com legenda</a>
            <a className="botao pequeno" href={png}>PNG sem legenda</a>
          </div>
        </div>

        <div className="cartao">
          <dl className="enderecos">
            <dt>URL pública fixa <small>— é o que está impresso no QR e nunca muda</small></dt>
            <dd className="mono quebra">{publica ?? "—"}</dd>
            <dt>Destino final atual <small>— editável a qualquer momento, sem reimprimir</small></dt>
            <dd className="mono quebra">
              {ehPagina
                ? pagina
                  ? <>Página de links “{pagina.titulo}”, {pagina.links.length} botão(ões) ·{" "}
                      <a href={`/api/codigos/${codigo.id}/previa`} target="_blank" rel="noopener noreferrer">ver prévia</a></>
                  : "Página de links ainda não preenchida"
                : codigo.destino
                  ? <a href={codigo.destino} target="_blank" rel="noopener noreferrer nofollow">{codigo.destino}</a>
                  : "Nenhum destino configurado"}
            </dd>
            <dt>O que acontece ao ler o QR agora</dt>
            <dd>
              {!ativo
                ? "Mostra a página “código ainda não disponível”. Nenhum destino é revelado."
                : ehPagina
                  ? "Abre a página de links, na própria URL pública do QR."
                  : "Redireciona para o destino final atual."}
            </dd>
          </dl>
          <p className="suave">
            Leituras: {codigo.acessos} · última na hora de {formatarData(codigo.ultimo_acesso_em)} · criado em{" "}
            {formatarData(codigo.criado_em)} · configurado em {formatarData(codigo.configurado_em)} · alterado em{" "}
            {formatarData(codigo.atualizado_em)}
          </p>
        </div>
      </section>

      {codigo.status !== "ARQUIVADO" && (
        <section className="cartao">
          <h2>Configuração</h2>
          {codigo.status === "DESATIVADO" && (
            <p className="aviso atencao">Código desativado: você pode editar, mas ele só volta a redirecionar depois de reativado.</p>
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
        </section>
      )}

      {codigo.status !== "ARQUIVADO" && (ehPagina || pagina) && (
        <section className="cartao">
          <h2>Imagens da página de links</h2>
          <ImagensDaPagina
            id={codigo.id} versoes={versoes}
            limitesKb={{ logo: TAMANHO_MAXIMO_IMAGEM.logo / 1024, fundo: TAMANHO_MAXIMO_IMAGEM.fundo / 1024 }}
          />
        </section>
      )}

      <section className="cartao">
        <h2>Ações</h2>
        <PainelDeAcoes
          id={codigo.id} status={codigo.status} temDestino={ehPagina ? !!pagina : !!codigo.destino}
          temDados={!!(codigo.cliente || codigo.notas || codigo.destino || pagina || versoes.logo || versoes.fundo)}
        />
      </section>

      <section>
        <h2>Histórico</h2>
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Quando</th><th>Ação</th><th>Detalhes</th><th>Administrador</th></tr></thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.id}>
                  <td>{formatarData(h.em)}</td>
                  <td>{ROTULO_ACAO[h.acao] ?? h.acao}</td>
                  <td className="mono quebra">{detalhes(h.meta)}</td>
                  <td>{h.admin_usuario ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
