import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormLogin } from "@/componentes/FormLogin";
import { adminAtual, gerenteAtual } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function Login() {
  if (await adminAtual().catch(() => null)) redirect("/");
  if (await gerenteAtual().catch(() => null)) redirect("/cliente");
  return (
    <main className="tela-login">
      <div className="login">
        <div className="marca">
          <Image src="/infuse-symbol.webp" alt="" width={28} height={28} />
          <span>Infuse QR</span>
        </div>
        <h1>Entrar</h1>
        <FormLogin />
        <p className="suave"><Link href="/privacidade">Aviso de privacidade</Link></p>
      </div>
    </main>
  );
}
