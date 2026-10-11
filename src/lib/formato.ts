const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
});

export const formatarData = (d: Date | string | null | undefined) => (d ? dataHora.format(new Date(d)) : "—");

/** Destino resumido para listas: host + início do caminho, sempre como texto. */
export function resumirDestino(destino: string | null): string {
  if (!destino) return "—";
  try {
    const u = new URL(destino);
    const resto = u.pathname + u.search;
    return u.hostname + (resto.length > 24 ? `${resto.slice(0, 24)}…` : resto === "/" ? "" : resto);
  } catch {
    return "destino inválido";
  }
}

export function inteiroPositivo(valor: string | string[] | undefined | null): number | undefined {
  const n = Number.parseInt(Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? ""), 10);
  return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : undefined;
}
