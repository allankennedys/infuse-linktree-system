import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { acaoSair } from "@/app/(painel)/acoes";
import { Navegacao } from "@/componentes/Navegacao";
import { exigirGerente } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meus QR Codes" };

const MENU = [
  { href: "/cliente", rotulo: "Meus QR Codes" },
  { href: "/cliente/senha", rotulo: "Senha" },
];

export default async function AreaDoCliente({ children }: { children: React.ReactNode }) {
  const gerente = await exigirGerente();
  return (
    <>
      <div className="faixa-topo">
        <header className="topo">
          <Link href="/cliente" className="marca">
            <Image src="/infuse-symbol.webp" alt="" width={24} height={24} />
            <span>Infuse QR</span>
          </Link>
          <Navegacao itens={MENU} />
          <form action={acaoSair} className="sessao">
            <span className="suave">{gerente.usuario}</span>
            <button className="botao texto">Sair</button>
          </form>
        </header>
      </div>
      <main className="conteudo">{children}</main>
    </>
  );
}
