import Image from "next/image";
import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { acaoSair } from "./acoes";

export const dynamic = "force-dynamic";

export default async function Painel({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin();
  return (
    <>
      <header className="topo">
        <Link href="/" className="marca">
          <Image src="/infuse-symbol.webp" alt="" width={28} height={28} />
          <span>Infuse QR</span>
        </Link>
        <nav>
          <Link href="/">Códigos</Link>
          <Link href="/lotes">Lotes</Link>
          <Link href="/auditoria">Auditoria</Link>
        </nav>
        <form action={acaoSair} className="sessao">
          <span className="suave">{admin.usuario}</span>
          <button className="botao pequeno">Sair</button>
        </form>
      </header>
      <main className="conteudo">{children}</main>
    </>
  );
}
