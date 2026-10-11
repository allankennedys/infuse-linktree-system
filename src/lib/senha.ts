import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 32768, R = 8, P = 1, TAMANHO = 64;
export const SENHA_MINIMA = 12;

function derivar(senha: string, sal: Buffer, n: number, r: number, p: number, tamanho: number): Promise<Buffer> {
  return new Promise((ok, falha) =>
    scrypt(senha.normalize("NFKC"), sal, tamanho, { N: n, r, p, maxmem: 256 * n * r }, (e, chave) =>
      e ? falha(e) : ok(chave),
    ),
  );
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await derivar(senha, sal, N, R, P, TAMANHO);
  return ["scrypt", N, R, P, sal.toString("base64"), chave.toString("base64")].join("$");
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  const [algoritmo, n, r, p, sal, chave] = hash.split("$");
  if (algoritmo !== "scrypt" || !n || !r || !p || !sal || !chave) return false;
  const esperado = Buffer.from(chave, "base64");
  const obtido = await derivar(senha, Buffer.from(sal, "base64"), Number(n), Number(r), Number(p), esperado.length);
  return timingSafeEqual(esperado, obtido);
}

// Hash de uma senha descartada, para gastar o mesmo tempo quando o usuário não existe.
let falso: Promise<string> | undefined;
export const hashFalso = () => (falso ??= gerarHash(randomBytes(24).toString("hex")));
