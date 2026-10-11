import { ROTULO_STATUS, type Status } from "@/lib/codigos";

export function Etiqueta({ status }: { status: Status }) {
  return <span className={`etiqueta ${status.toLowerCase()}`}>{ROTULO_STATUS[status]}</span>;
}
