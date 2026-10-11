import type { Metadata } from "next";
import { FormTrocarSenha } from "@/componentes/FormTrocarSenha";
import { exigirGerente } from "@/lib/auth";
import { SENHA_MINIMA_GERENTE } from "@/lib/gerentes";

export const metadata: Metadata = { title: "Senha" };

export default async function Senha() {
  await exigirGerente();
  return (
    <>
      <div className="titulo-pagina"><h1>Senha</h1></div>
      <FormTrocarSenha senhaMinima={SENHA_MINIMA_GERENTE} />
    </>
  );
}
