import { notFound } from "next/navigation";
import { acaoConfigurarCliente, acaoImagemCliente } from "@/app/(cliente)/acoes";
import { FormConfiguracao } from "@/componentes/FormConfiguracao";
import { ImagensDaPagina } from "@/componentes/ImagensDaPagina";
import { exigirGerente } from "@/lib/auth";
import { obterCodigo } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { inteiroPositivo } from "@/lib/formato";
import { ICONES } from "@/lib/icones";
import { LIMITES_PAGINA, obterPagina, PADRAO_PAGINA, TAMANHO_MAXIMO_IMAGEM, versoesDasImagens } from "@/lib/pagina";
import { formatarNumero, urlPublica } from "@/lib/token";

export default async function MeuCodigo({ params }: { params: Promise<{ id: string }> }) {
  const gerente = await exigirGerente();
  const id = inteiroPositivo((await params).id);
  const db = getDb();
  const codigo = id ? await obterCodigo(db, id) : null;
  // Código de outro cliente responde igual a código que não existe.
  if (!codigo || codigo.gerente_id !== gerente.id || codigo.status === "ARQUIVADO") notFound();
  const [pagina, versoes] = await Promise.all([obterPagina(db, codigo.id), versoesDasImagens(db, codigo.id)]);

  let publica: string | null = null;
  try {
    publica = urlPublica(baseUrl(), codigo.token);
  } catch {}
  const png = `/api/codigos/${codigo.id}/png`;

  return (
    <>
      <div className="titulo-pagina"><h1>QR Code {formatarNumero(codigo.numero)}</h1></div>

      <section className="resumo-codigo">
        <div className="qr">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada por rota autenticada */}
          {publica && <img src={`${png}?previa=1`} alt={`QR Code ${formatarNumero(codigo.numero)}`} width={180} />}
          {publica && <a className="botao pequeno" href={png}>Baixar PNG</a>}
        </div>
        <div className="pilha">
          <p>O QR impresso não muda. O que você salvar aqui passa a valer na próxima leitura.</p>
          {publica && <p><a href={publica} target="_blank" rel="noopener noreferrer">Abrir como quem lê o QR</a></p>}
          {codigo.status === "DESATIVADO" && (
            <p className="aviso atencao">Este QR Code está desativado. Dá para editar, mas ele só volta a funcionar quando a Infuse reativar.</p>
          )}
        </div>
      </section>

      <section className="secao">
        <h2>Conteúdo</h2>
        <div>
          <FormConfiguracao
            id={codigo.id} urlPublica={publica} modo={codigo.modo} destino={codigo.destino ?? ""} cliente="" notas=""
            pagina={{
              titulo: pagina?.titulo ?? "", subtitulo: pagina?.subtitulo ?? "",
              subtitulo_url: pagina?.subtitulo_url ?? "", rodape: pagina?.rodape ?? "",
              cor_fundo: pagina?.cor_fundo ?? PADRAO_PAGINA.cor_fundo,
              cor_destaque: pagina?.cor_destaque ?? PADRAO_PAGINA.cor_destaque,
              links: pagina?.links ?? [{ rotulo: "", url: "", icone: "link" }],
            }}
            icones={Object.entries(ICONES).map(([chave, i]) => ({ chave, rotulo: i.rotulo }))}
            maximoDeLinks={LIMITES_PAGINA.links}
            acao={acaoConfigurarCliente} areaDoCliente
          />
        </div>
      </section>

      {(codigo.modo === "PAGINA" || pagina) && (
        <section className="secao">
          <h2>Imagens da página</h2>
          <div>
            <ImagensDaPagina
              id={codigo.id} versoes={versoes} acao={acaoImagemCliente}
              limitesKb={{ logo: TAMANHO_MAXIMO_IMAGEM.logo / 1024, fundo: TAMANHO_MAXIMO_IMAGEM.fundo / 1024 }}
            />
          </div>
        </section>
      )}
    </>
  );
}
