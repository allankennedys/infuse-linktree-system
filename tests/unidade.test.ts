import { describe, expect, it } from "vitest";
import { avisosDeDominio, validarDestino } from "@/lib/destino";
import { normalizarBaseUrl } from "@/lib/env";
import { gerarCsv } from "@/lib/exportar";
import { LimiteEmMemoria } from "@/lib/limite";
import { decodificarPng, gerarPng, rasterizarQr, ZONA_SILENCIOSA } from "@/lib/qr";
import { conferirSenha, gerarHash } from "@/lib/senha";
import { FORMATO_TOKEN, formatarNumero, gerarToken, gerarTokens, urlPublica } from "@/lib/token";

describe("token público", () => {
  it("é aleatório, no formato esperado e sem repetição em 20 mil amostras", () => {
    const tokens = Array.from({ length: 20_000 }, gerarToken);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens.every((t) => FORMATO_TOKEN.test(t))).toBe(true);
  });
  it("não é derivado do número de inventário", () => {
    const [a, b] = gerarTokens(2);
    expect(a).not.toBe(b);
    expect(urlPublica("https://x.test", a!)).toBe(`https://x.test/q/${a}`);
    expect(formatarNumero(42)).toBe("IQ-000042");
  });
});

describe("validação de destino", () => {
  it("aceita https e normaliza", () => {
    expect(validarDestino("  https://Loja.Exemplo.com/pagar?x=1 ")).toEqual({
      ok: true, url: "https://loja.exemplo.com/pagar?x=1", host: "loja.exemplo.com",
    });
  });
  it.each([
    "javascript:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd", "ftp://exemplo.com/a",
    "http://exemplo.com", "https://usuario:senha@exemplo.com", "https://usuario@exemplo.com", "exemplo.com",
    "//exemplo.com", "https://", "https://exemplo .com", "https://exemplo.com\\@mau.com", "https://127.0.0.1/a",
    "https://[::1]/a", "https://localhost/a", "https://intranet/a", "http://localhost:3000", "",
    `https://exemplo.com/${"a".repeat(2100)}`, "https://exemplo.com/\nLocation: x",
  ])("recusa %s", (entrada) => {
    expect(validarDestino(entrada).ok).toBe(false);
  });
  it("só aceita http://localhost com a exceção de desenvolvimento ligada", () => {
    expect(validarDestino("http://localhost:3000/x", { permitirLocal: true }).ok).toBe(true);
    expect(validarDestino("http://exemplo.com/x", { permitirLocal: true }).ok).toBe(false);
  });
  it("aplica a lista de domínios permitidos", () => {
    const op = { hostsPermitidos: ["wa.me", "*.exemplo.com"] };
    expect(validarDestino("https://wa.me/5511999999999", op).ok).toBe(true);
    expect(validarDestino("https://loja.exemplo.com/a", op).ok).toBe(true);
    expect(validarDestino("https://exemplo.com/a", op).ok).toBe(false);
    expect(validarDestino("https://mauexemplo.com/a", op).ok).toBe(false);
    expect(validarDestino("https://wa.me.mau.com/a", op).ok).toBe(false);
  });
  it("alerta sobre domínio parecido, punycode e domínio novo", () => {
    expect(avisosDeDominio("instagrarn.com", []).join(" ")).toContain("parecido com instagram.com");
    expect(avisosDeDominio("xn--nstagram-abc.com", []).join(" ")).toContain("punycode");
    expect(avisosDeDominio("www.instagram.com", ["instagram.com"])).toEqual([]);
    expect(avisosDeDominio("lojanova.com.br", ["instagram.com"])).toHaveLength(1);
  });
});

describe("QR Code", () => {
  const url = "https://qr.exemplo.test/q/AbC9xK2pQr7Z";
  it("PNG decodifica para a URL exata, com e sem legenda", () => {
    expect(decodificarPng(gerarPng(url))).toBe(url);
    expect(decodificarPng(gerarPng(url, { legenda: "IQ-000001" }))).toBe(url);
    expect(decodificarPng(gerarPng(url, { tamanho: 360 }))).toBe(url);
  });
  it("tem resolução de impressão, zona silenciosa branca e só preto e branco puros", () => {
    const r = rasterizarQr(url, { tamanho: 1024 });
    expect(r.largura).toBeGreaterThanOrEqual(900);
    expect(r.altura).toBe(r.largura);
    const modulo = r.largura / rasterizarQr(url, { tamanho: 1 }).largura;
    const margem = ZONA_SILENCIOSA * modulo;
    let coresInvalidas = 0;
    let margemInvadida = 0;
    for (let y = 0; y < r.altura; y++) {
      for (let x = 0; x < r.largura; x++) {
        const v = r.dados[(y * r.largura + x) * 4]!;
        if (v !== 0 && v !== 255) coresInvalidas++;
        const naMargem = x < margem || y < margem || x >= r.largura - margem || y >= r.altura - margem;
        if (naMargem && v !== 255) margemInvadida++;
      }
    }
    expect(coresInvalidas).toBe(0);
    expect(margemInvadida).toBe(0);
  });
  it("a legenda fica abaixo da zona silenciosa, sem aumentar a largura", () => {
    const sem = rasterizarQr(url);
    const com = rasterizarQr(url, { legenda: "IQ-000001" });
    expect(com.largura).toBe(sem.largura);
    expect(com.altura).toBeGreaterThan(sem.altura);
    // A parte do QR é idêntica byte a byte: a legenda não toca na área de leitura.
    expect(Buffer.from(com.dados.buffer, 0, sem.dados.length).equals(Buffer.from(sem.dados.buffer))).toBe(true);
  });
});

describe("configuração e utilidades", () => {
  it("APP_BASE_URL: exige https em produção e não aceita caminho", () => {
    expect(normalizarBaseUrl("https://qr.exemplo.com/", true)).toBe("https://qr.exemplo.com");
    expect(() => normalizarBaseUrl("", true)).toThrow();
    expect(() => normalizarBaseUrl("http://qr.exemplo.com", true)).toThrow();
    expect(() => normalizarBaseUrl("https://qr.exemplo.com/app", true)).toThrow();
    expect(normalizarBaseUrl("http://localhost:3000", false)).toBe("http://localhost:3000");
  });
  it("senha: hash scrypt confere só com a senha certa", async () => {
    const hash = await gerarHash("uma senha bem longa");
    expect(hash).not.toContain("uma senha");
    expect(await conferirSenha("uma senha bem longa", hash)).toBe(true);
    expect(await conferirSenha("outra senha", hash)).toBe(false);
  });
  it("limite em memória bloqueia acima do teto e libera na janela seguinte", () => {
    const limite = new LimiteEmMemoria(3, 1000);
    expect([1, 2, 3, 4].map(() => limite.permitir("a", 10))).toEqual([true, true, true, false]);
    expect(limite.permitir("b", 10)).toBe(true);
    expect(limite.permitir("a", 1010)).toBe(true);
  });
  it("CSV traz só número, lote, URL pública e status, e neutraliza fórmulas", () => {
    const csv = gerarCsv([{ numero: 1, token: "AbC9xK2pQr7Z", status: "DISPONIVEL" }], "https://x.test", "=lote");
    expect(csv).toContain("numero,lote,url_publica,status");
    expect(csv).toContain(`"IQ-000001","'=lote","https://x.test/q/AbC9xK2pQr7Z","DISPONIVEL"`);
  });
});
