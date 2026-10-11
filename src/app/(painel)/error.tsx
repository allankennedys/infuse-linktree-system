"use client";

export default function Erro({ reset }: { reset: () => void }) {
  return (
    <div className="cartao">
      <h1>Algo deu errado</h1>
      <p className="suave">Não foi possível carregar esta página. Verifique a conexão com o banco de dados e tente de novo.</p>
      <button className="botao" onClick={reset}>Tentar novamente</button>
    </div>
  );
}
