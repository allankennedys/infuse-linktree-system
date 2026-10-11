"use client";

export default function Erro({ reset }: { reset: () => void }) {
  return (
    <div className="pilha">
      <h1>Algo deu errado</h1>
      <p className="suave">Não foi possível carregar esta página. Verifique a conexão com o banco de dados.</p>
      <div><button className="botao" onClick={reset}>Tentar de novo</button></div>
    </div>
  );
}
