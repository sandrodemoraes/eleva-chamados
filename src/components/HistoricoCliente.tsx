"use client";

import { useEffect, useState } from "react";
import { listaDefeitos } from "../lib/parse-chamado";
import { STATUS_LABEL, type Chamado } from "../lib/types";

function dataCurta(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function useHistorico(cliente: string, ativo: boolean, atraso = 0) {
  const [itens, setItens] = useState<Chamado[] | null>(null);
  const nome = cliente.trim();

  useEffect(() => {
    if (!ativo || nome.length < 3) {
      setItens(null);
      return;
    }
    let cancelado = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/chamados?cliente=${encodeURIComponent(nome)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { chamados: Chamado[] };
        if (!cancelado) setItens(data.chamados);
      } catch {
        // sem rede: sem histórico
      }
    }, atraso);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [nome, ativo, atraso]);

  return itens;
}

/** Aviso no formulário quando o cliente digitado já foi atendido. */
export function HistoricoAviso({ cliente }: { cliente: string }) {
  const itens = useHistorico(cliente, true, 700);
  if (!itens || itens.length === 0) return null;
  const ultimo = itens[0];
  const defeito = listaDefeitos(ultimo.defeito)[0];
  return (
    <p className="historico-aviso">
      Cliente já atendido {itens.length === 1 ? "1 vez" : `${itens.length} vezes`}. Último:{" "}
      {dataCurta(ultimo.criado_em)} · {ultimo.servico}
      {defeito ? ` · ${defeito}` : ""}
    </p>
  );
}

/** Lista dos atendimentos anteriores do mesmo cliente, dentro do card. */
export function HistoricoCliente({
  cliente,
  excluirId,
}: {
  cliente: string;
  excluirId: string;
}) {
  const [aberto, setAberto] = useState(false);
  const itens = useHistorico(cliente, aberto);
  if (cliente.trim().length < 3) return null;
  const lista = (itens ?? []).filter((c) => c.id !== excluirId);

  return (
    <div className="historico">
      <button type="button" className="link-btn" onClick={() => setAberto(!aberto)}>
        {aberto ? "Esconder histórico do cliente" : "Ver histórico do cliente"}
      </button>
      {aberto && itens === null && <p className="muted">Carregando…</p>}
      {aberto && itens !== null && lista.length === 0 && (
        <p className="muted">Primeiro atendimento deste cliente.</p>
      )}
      {aberto && lista.length > 0 && (
        <ul className="historico-lista">
          {lista.map((c) => (
            <li key={c.id}>
              <strong>{dataCurta(c.criado_em)}</strong> · {c.servico} ·{" "}
              {STATUS_LABEL[c.status] ?? c.status}
              {c.funcionarios ? ` · ${c.funcionarios}` : ""}
              {listaDefeitos(c.defeito).length > 0 && (
                <span className="historico-defeito">
                  {" "}
                  — {listaDefeitos(c.defeito).join("; ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
