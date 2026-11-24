"use client";

import { useState } from "react";
import type { Chamado } from "../lib/types";
import { EQUIPE, parseFuncionarios } from "../lib/equipe";
import {
  formatarReais,
  lerValoresHora,
  totalServico,
  VALOR_MINIMO,
} from "../lib/parse-chamado";

function nomesDo(c: Chamado): string[] {
  const extras = [
    ...parseFuncionarios(c.funcionarios || ""),
    ...(c.assumido_por ? [c.assumido_por] : []),
    ...Object.keys(lerValoresHora(c.valores_hora)),
  ].filter((nome) => nome && !(EQUIPE as readonly string[]).includes(nome));
  return [...EQUIPE, ...new Set(extras)];
}

function lerNumero(texto: string): number | null | "invalid" {
  const t = texto.trim();
  if (!t) return null;
  const n = t.includes(",")
    ? Number(t.replace(/\./g, "").replace(",", "."))
    : Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return "invalid";
  return Math.round(n * 100) / 100;
}

function textoDe(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function ValoresServico({
  chamado,
  onSalvar,
}: {
  chamado: Chamado;
  onSalvar: (campos: Record<string, unknown>) => Promise<boolean>;
}) {
  const nomes = nomesDo(chamado);
  const gravados = lerValoresHora(chamado.valores_hora);
  const [horas, setHoras] = useState(textoDe(chamado.horas_extra));
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const ini: Record<string, string> = {};
    for (const nome of nomesDo(chamado)) ini[nome] = textoDe(gravados[nome]);
    return ini;
  });
  const [deslocamento, setDeslocamento] = useState(Boolean(chamado.deslocamento));
  const [km, setKm] = useState(textoDe(chamado.deslocamento_km));
  const [valorDesloc, setValorDesloc] = useState(textoDe(chamado.deslocamento_valor));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const mapa: Record<string, number | null> = {};
  for (const nome of nomes) {
    const n = lerNumero(valores[nome] ?? "");
    mapa[nome] = n === "invalid" ? null : n;
  }
  const deslocLido = lerNumero(valorDesloc);
  const total = totalServico({
    valores_hora: mapa,
    deslocamento,
    deslocamento_valor: deslocLido === "invalid" ? null : deslocLido,
    produtos_total: chamado.produtos_total,
  });

  async function salvar() {
    const horasN = lerNumero(horas);
    if (horasN === "invalid") {
      setErro("Horas inválidas. Use algo como 1,5.");
      return;
    }
    const payload: Record<string, number | null> = {};
    for (const nome of nomes) {
      const n = lerNumero(valores[nome] ?? "");
      if (n === "invalid") {
        setErro("Valor das horas inválido. Use algo como 80,00.");
        return;
      }
      if (n != null) payload[nome] = n;
    }
    let kmN: number | null = null;
    let valorN: number | null = null;
    if (deslocamento) {
      const kmLido = lerNumero(km);
      const valorLido = lerNumero(valorDesloc);
      if (kmLido === "invalid") {
        setErro("Km inválido.");
        return;
      }
      if (valorLido === "invalid") {
        setErro("Valor do deslocamento inválido. Use algo como 50,00.");
        return;
      }
      kmN = kmLido;
      valorN = valorLido;
    }
    setErro("");
    setSalvando(true);
    const ok = await onSalvar({
      horas_extra: horasN,
      valores_hora: payload,
      deslocamento,
      deslocamento_km: deslocamento ? kmN : null,
      deslocamento_valor: deslocamento ? valorN : null,
    });
    setSalvando(false);
    if (!ok) setErro("Não foi possível salvar os valores.");
  }

  return (
    <section className="valores">
      <p className="valores-titulo">Valores do serviço</p>
      <p className="valores-minimo">
        Mínimo do chamado: <strong>{formatarReais(VALOR_MINIMO)}</strong>
      </p>
      <label className="field">
        Horas adicionais
        <input
          inputMode="decimal"
          placeholder="em aberto"
          value={horas}
          onChange={(e) => setHoras(e.target.value)}
        />
      </label>
      {nomes.map((nome) => (
        <label className="field" key={nome || "geral"}>
          {nome ? `Valor das horas de ${nome}` : "Valor das horas"}
          <input
            inputMode="decimal"
            placeholder="definir"
            value={valores[nome] ?? ""}
            onChange={(e) =>
              setValores((prev) => ({ ...prev, [nome]: e.target.value }))
            }
          />
        </label>
      ))}
      <label className="check-row">
        <input
          type="checkbox"
          checked={deslocamento}
          onChange={(e) => setDeslocamento(e.target.checked)}
        />
        Deslocamento
      </label>
      {deslocamento && (
        <div className="grid-2">
          <label className="field">
            Km
            <input
              inputMode="decimal"
              placeholder="0"
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          </label>
          <label className="field">
            Valor do deslocamento
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={valorDesloc}
              onChange={(e) => setValorDesloc(e.target.value)}
            />
          </label>
        </div>
      )}
      <p className="valores-total">Total: {formatarReais(total)}</p>
      {erro && <p className="erro">{erro}</p>}
      <button type="button" className="btn" disabled={salvando} onClick={salvar}>
        {salvando ? "Salvando…" : "Salvar valores"}
      </button>
    </section>
  );
}
