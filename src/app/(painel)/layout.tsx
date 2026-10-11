import Image from "next/image";
import Link from "next/link";
import { Navegacao } from "@/componentes/Navegacao";
import { exigirAdmin } from "@/lib/auth";
import { acaoSair } from "./acoes";

export const dynamic = "force-dynamic";

export default async function Painel({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin();
  return (
    <>
      <div className="faixa-topo">
        <header className="topo">
          <Link href="/" className="marca">
            <Image src="/infuse-symbol.webp" alt="" width={24} height={24} />
            <span>Infuse QR</span>
          </Link>
          <Navegacao />
          <form action={acaoSair} className="sessao">
            <span className="suave">{admin.usuario}</span>
            <button className="botao texto">Sair</button>
          </form>
        </header>
      </div>
      <main className="conteudo">{children}</main>
    </>
  );
}
