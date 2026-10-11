import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormLogin } from "@/componentes/FormLogin";
import { adminAtual } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function Login() {
  if (await adminAtual().catch(() => null)) redirect("/");
  return (
    <main className="tela-login">
      <div className="cartao login">
        <div className="marca">
          <Image src="/infuse-symbol.webp" alt="" width={36} height={36} />
          <span>Infuse QR</span>
        </div>
        <h1>Entrar no painel</h1>
        <FormLogin />
        <p className="suave centro"><Link href="/privacidade">Aviso de privacidade</Link></p>
      </div>
    </main>
  );
}
