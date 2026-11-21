"use client";

import { useState } from "react";
import { checklistDo, lerChecklist } from "../lib/checklists";
import { enviar } from "../lib/outbox";

type Props = {
  chamadoId: string;
  servico: string;
  raw?: string;
  onSaved: () => void;
};

export function ChecklistPanel({ chamadoId, servico, raw, onSaved }: Props) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>(() => lerChecklist(raw));
  const [msg, setMsg] = useState("");
  const itens = checklistDo(servico);
  const feitos = itens.filter((i) => marcados[i.texto]).length;

  async function alternar(texto: string, valor: boolean) {
    const next = { ...marcados, [texto]: valor };
    setMarcados(next);
    const r = await enviar(
      `/api/chamados/${chamadoId}`,
      "PATCH",
      { checklist: next },
      "Checklist",
    );
    if ("ok" in r && !r.ok) setMsg(r.error);
    else if ("queued" in r) setMsg("Sem internet: checklist guardado no celular.");
    else {
      setMsg("");
      onSaved();
    }
  }

  return (
    <fieldset className="checklist">
      <legend>
        Checklist · {servico} ({feitos}/{itens.length})
      </legend>
      {itens.map((item) => (
        <label key={item.texto} className="check-row">
          <input
            type="checkbox"
            checked={Boolean(marcados[item.texto])}
            onChange={(e) => void alternar(item.texto, e.target.checked)}
          />
          <span>
            {item.texto}
            {item.obrigatorio && <em className="obrig"> obrigatório</em>}
          </span>
        </label>
      ))}
      {msg && <p className="muted">{msg}</p>}
    </fieldset>
  );
}
