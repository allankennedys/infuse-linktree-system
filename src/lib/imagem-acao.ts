import { registrar } from "./auditoria";
import { obterCodigo } from "./codigos";
import type { Db } from "./db";
import { removerImagem, salvarImagem, TIPOS_DE_IMAGEM, validarImagem, type TipoDeImagem } from "./pagina";

type Quem = { adminId: number } | { gerenteId: number };

/**
 * Envia (com arquivo) ou remove (campo "remover") o logo ou o fundo da página de links.
 * Para o gerente, o código precisa ser dele.
 */
export async function trocarImagem(db: Db, id: number | undefined, fd: FormData, quem: Quem): Promise<{ erro?: string; ok?: string }> {
  const tipo = String(fd.get("tipo") ?? "") as TipoDeImagem;
  if (!id || !TIPOS_DE_IMAGEM.includes(tipo)) return { erro: "Pedido inválido." };
  const codigo = await obterCodigo(db, id);
  if (!codigo || ("gerenteId" in quem && codigo.gerente_id !== quem.gerenteId)) return { erro: "Código não encontrado." };
  if (codigo.status === "ARQUIVADO") {
    return { erro: "gerenteId" in quem ? "Este QR Code está fora de uso." : "Código arquivado. Desarquive antes de alterar." };
  }
  const nome = tipo === "logo" ? "Logo" : "Imagem de fundo";
  if (fd.get("remover") === "1") {
    if (await removerImagem(db, id, tipo)) {
      await registrar(db, { ...quem, codigoId: id, acao: "IMAGEM_ALTERADA", meta: { tipo, removida: true } });
    }
    return { ok: `${nome} removida.` };
  }
  const arquivo = fd.get("arquivo");
  if (!(arquivo instanceof File)) return { erro: "Escolha um arquivo de imagem." };
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const v = validarImagem(tipo, dados);
  if (!v.ok) return { erro: v.erro };
  await salvarImagem(db, id, tipo, v.mime, dados);
  await registrar(db, { ...quem, codigoId: id, acao: "IMAGEM_ALTERADA", meta: { tipo } });
  return { ok: `${nome} salva.` };
}
