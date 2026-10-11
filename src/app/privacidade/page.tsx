import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso de privacidade" };

// Texto-base. Antes de publicar, a Infuse precisa revisar e completar os dados
// do controlador e o canal de contato (ver README, seção LGPD).
export default function Privacidade() {
  return (
    <main className="documento">
      <h1>Aviso de privacidade — Infuse QR</h1>
      <p>
        O Infuse QR é o serviço de QR Codes dinâmicos da Infuse Software. Este aviso explica quais dados o serviço
        trata e por quê.
      </p>
      <h2>Quem lê um QR Code</h2>
      <p>
        Ao ler um QR Code, você passa por um endereço da Infuse que redireciona para o destino definido pelo
        estabelecimento. Nesse passo não usamos cookies, pixels de publicidade nem ferramentas de analytics. Guardamos
        apenas uma contagem agregada de leituras por código e por hora, sem endereço IP, sem identificação do aparelho e
        sem perfil de quem leu. Para evitar abuso, o endereço IP é usado em memória por cerca de um minuto, de forma
        anonimizada, e não é armazenado.
      </p>
      <h2>Estabelecimentos clientes</h2>
      <p>
        Guardamos o nome do estabelecimento (opcional), o endereço de destino configurado e observações internas de
        atendimento. Não pedimos CPF, documentos nem endereço residencial. Esses dados servem só para operar o
        redirecionamento e podem ser corrigidos ou removidos a pedido.
      </p>
      <h2>Administradores</h2>
      <p>
        O painel registra quais administradores criaram, alteraram, desativaram ou exportaram códigos, com data e hora,
        por segurança e auditoria. Tentativas de login são limitadas usando identificadores anonimizados.
      </p>
      <h2>Retenção</h2>
      <p>
        Contagens de leitura por hora são apagadas após 90 dias e registros de auditoria após 24 meses, salvo
        configuração diferente informada pela Infuse. Sessões expiram em 12 horas.
      </p>
      <h2>Compartilhamento</h2>
      <p>
        Não vendemos nem compartilhamos dados para publicidade. Os dados ficam nos provedores de hospedagem e banco de
        dados contratados pela Infuse para operar o serviço.
      </p>
      <h2>Contato</h2>
      <p>Pedidos de acesso, correção ou remoção de dados podem ser feitos pelos canais oficiais da Infuse Software.</p>
    </main>
  );
}
