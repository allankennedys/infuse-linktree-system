"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemDeMenu = { href: string; rotulo: string; prefixos?: string[] };

const PAINEL: ItemDeMenu[] = [
  { href: "/", rotulo: "Códigos", prefixos: ["/codigos"] },
  { href: "/lotes", rotulo: "Lotes", prefixos: ["/lotes"] },
  { href: "/auditoria", rotulo: "Auditoria", prefixos: ["/auditoria"] },
];

export function Navegacao({ itens = PAINEL }: { itens?: ItemDeMenu[] }) {
  const caminho = usePathname();
  // Vale o item mais específico: "/cliente/senha" marca "Senha", não "Meus QR Codes".
  const casa = (i: ItemDeMenu) =>
    [i.href, ...(i.prefixos ?? [])].filter((p) => caminho === p || (p !== "/" && caminho.startsWith(`${p}/`)))
      .reduce((maior, p) => Math.max(maior, p.length), 0);
  const melhor = Math.max(...itens.map(casa));
  return (
    <nav>
      {itens.map((i) => (
        <Link key={i.href} href={i.href} aria-current={melhor > 0 && casa(i) === melhor ? "page" : undefined}>{i.rotulo}</Link>
      ))}
    </nav>
  );
}
