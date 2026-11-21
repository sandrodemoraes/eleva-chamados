"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { Chamado, ChamadoStatus, Urgencia } from "../lib/types";
import { SERVICOS, STATUS_LABEL } from "../lib/types";
import {
  agoraLocal,
  duracaoLabel,
  formatHorarioLabel,
  listaDefeitos,
  textoParaNota,
} from "../lib/parse-chamado";
import { EquipePicker } from "./EquipePicker";
import { HoraField } from "./HoraField";

const FILTERS: { id: string; label: string; status?: ChamadoStatus }[] = [
  { id: "todos", label: "Todos" },
  { id: "aberto", label: "Em aberto", status: "aberto" },
  { id: "em_andamento", label: "Em andamento", status: "em_andamento" },
  { id: "aguardando_nota", label: "Aguardando nota", status: "aguardando_nota" },
  { id: "nota_feita", label: "Nota feita", status: "nota_feita" },
  { id: "concluido", label: "Concluídos", status: "concluido" },
];

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type EditState = {
  cliente: string;
  quem_chamou: string;
  telefone: string;
  endereco: string;
  servico: string;
  defeito: string;
  urgencia: Urgencia;
  descricao: string;
  funcionarios: string;
  horario: string;
  inicio: string;
  termino: string;
  marcado: boolean;
};

function toEdit(c: Chamado): EditState {
  return {
    cliente: c.cliente || "",
    quem_chamou: c.quem_chamou || "",
    telefone: c.telefone || "",
    endereco: c.endereco || "",
    servico: c.servico || "Outro",
    defeito: c.defeito || "",
    urgencia: c.urgencia || "normal",
    descricao: c.descricao || "",
    funcionarios: c.funcionarios || "",
    horario: c.horario || "",
    inicio: c.inicio || "",
    termino: c.termino || "",
    marcado: Boolean(c.marcado),
  };
}

type Props = {
  refreshToken: number;
  tecnico: string;
  initialFilter?: string;
};

export function ChamadoBoard({
  refreshToken,
  tecnico,
  initialFilter = "aberto",
}: Props) {
  const [filter, setFilter] = useState(initialFilter);
  const [items, setItems] = useState<Chamado[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError("");
      const q =
        filter === "todos" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/chamados${q}`);
      if (!res.ok) {
        setError("Não foi possível carregar os chamados.");
        return;
      }
      const data = (await res.json()) as { chamados: Chamado[] };
      setItems(data.chamados);
    });
  }, [filter]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  async function setStatus(id: string, status: ChamadoStatus) {
    const res = await fetch(`/api/chamados/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
  }

  async function copyNota(c: Chamado) {
    const text = textoParaNota(c);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(c.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  async function marcarHora(id: string, campo: "inicio" | "termino") {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/chamados/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [campo]: agoraLocal() }),
      });
      if (!res.ok) setError("Não foi possível salvar o horário.");
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function assumir(id: string) {
    if (!tecnico) {
      setError("Escolha seu nome em “Eu sou” no topo para pegar o chamado.");
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/chamados/${id}/assumir`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tecnico }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Não foi possível pegar o chamado.");
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(c: Chamado) {
    setEditingId(c.id);
    setDraft(toEdit(c));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(id: string) {
    if (!draft) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/chamados/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Não foi possível salvar a edição.");
        return;
      }
      cancelEdit();
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function transcribe(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/chamados/${id}/transcribe`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        needs_key?: boolean;
      };
      if (!res.ok) {
        setError(
          data.needs_key
            ? "Para transcrever, adicione a chave OpenAI nas Secrets do app."
            : data.error || "Falha ao transcrever.",
        );
        return;
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="board">
      <div className="filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? "chip chip--on" : "chip"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pending && items.length === 0 && <p className="hint">Carregando…</p>}
      {error && <p className="error">{error}</p>}

      <ul className="chamado-list">
        {items.map((c) => {
          const editing = editingId === c.id && draft;
          return (
            <li key={c.id} className="chamado-item">
              <header className="chamado-head">
                <div>
                  <h3>{c.cliente || "Cliente sem nome"}</h3>
                  <p className="meta">
                    {c.quem_chamou ? `Quem chamou: ${c.quem_chamou} · ` : ""}
                    {c.servico}
                    {c.funcionarios ? ` · ${c.funcionarios}` : ""}
                    {c.horario
                      ? ` · ${formatHorarioLabel(c.horario)}`
                      : ""}
                    {` · ${formatWhen(c.criado_em)} · ${c.criado_por_nome}`}
                  </p>
                </div>
                <div className="badges">
                  <span className={`badge badge--status-${c.status}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                  {c.marcado && <span className="badge badge--ok">Marcado</span>}
                  <span className={`badge badge--${c.urgencia}`}>{c.urgencia}</span>
                </div>
              </header>

              {editing ? (
                <div className="edit-panel">
                  <div className="grid-2">
                    <label className="field">
                      <span>Cliente</span>
                      <input
                        value={draft.cliente}
                        onChange={(e) =>
                          setDraft({ ...draft, cliente: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Quem chamou</span>
                      <input
                        value={draft.quem_chamou}
                        onChange={(e) =>
                          setDraft({ ...draft, quem_chamou: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Defeito informado pelo cliente (um por linha)</span>
                    <textarea
                      rows={3}
                      value={draft.defeito}
                      onChange={(e) =>
                        setDraft({ ...draft, defeito: e.target.value })
                      }
                    />
                  </label>
                  <div className="grid-2">
                    <label className="field">
                      <span>Telefone</span>
                      <input
                        value={draft.telefone}
                        onChange={(e) =>
                          setDraft({ ...draft, telefone: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Horário marcado</span>
                      <input
                        type="datetime-local"
                        value={draft.horario}
                        onChange={(e) =>
                          setDraft({ ...draft, horario: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="grid-2">
                    <HoraField
                      label="Início do serviço"
                      value={draft.inicio}
                      onChange={(v) => setDraft({ ...draft, inicio: v })}
                    />
                    <HoraField
                      label="Término do serviço"
                      value={draft.termino}
                      onChange={(v) => setDraft({ ...draft, termino: v })}
                    />
                  </div>
                  <label className="field">
                    <span>Endereço</span>
                    <input
                      value={draft.endereco}
                      onChange={(e) =>
                        setDraft({ ...draft, endereco: e.target.value })
                      }
                    />
                  </label>
                  <EquipePicker
                    value={draft.funcionarios}
                    onChange={(v) => setDraft({ ...draft, funcionarios: v })}
                    disabled={busyId === c.id}
                  />
                  <label
                    className="check-row check-row--solo"
                    htmlFor={`marcado-${c.id}`}
                  >
                    <input
                      id={`marcado-${c.id}`}
                      type="checkbox"
                      checked={draft.marcado}
                      disabled={busyId === c.id}
                      onChange={(e) =>
                        setDraft({ ...draft, marcado: e.target.checked })
                      }
                    />
                    <span>Marcado / confirmado</span>
                  </label>
                  <div className="grid-2">
                    <label className="field">
                      <span>Serviço</span>
                      <select
                        value={draft.servico}
                        onChange={(e) =>
                          setDraft({ ...draft, servico: e.target.value })
                        }
                      >
                        {SERVICOS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Urgência</span>
                      <select
                        value={draft.urgencia}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            urgencia: e.target.value as Urgencia,
                          })
                        }
                      >
                        <option value="baixa">Baixa</option>
                        <option value="normal">Normal</option>
                        <option value="alta">Alta</option>
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Detalhes / texto</span>
                    <textarea
                      rows={3}
                      value={draft.descricao}
                      onChange={(e) =>
                        setDraft({ ...draft, descricao: e.target.value })
                      }
                    />
                  </label>
                  <div className="actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={busyId === c.id}
                      onClick={() => void saveEdit(c.id)}
                    >
                      {busyId === c.id ? "Salvando…" : "Salvar alterações"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={cancelEdit}
                      disabled={busyId === c.id}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="endereco">{c.endereco || "Sem endereço"}</p>
                  {c.telefone && <p className="fone">{c.telefone}</p>}
                  {(c.inicio || c.termino) && (
                    <p className="tempo">
                      Início: {formatHorarioLabel(c.inicio)} · Término:{" "}
                      {formatHorarioLabel(c.termino)}
                      {duracaoLabel(c.inicio, c.termino)
                        ? ` · ${duracaoLabel(c.inicio, c.termino)}`
                        : ""}
                    </p>
                  )}
                  {listaDefeitos(c.defeito).length > 0 && (
                    <div className="defeitos">
                      <p className="defeitos-titulo">Defeito informado pelo cliente</p>
                      <ul>
                        {listaDefeitos(c.defeito).map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.audio_base64 && (
                    <audio
                      controls
                      src={c.audio_base64}
                      className="audio-preview"
                    />
                  )}
                  <pre className="nota-preview">{textoParaNota(c)}</pre>
                  <div className="actions">
                    {c.status === "aberto" && (
                      <button
                        type="button"
                        className="primary"
                        disabled={busyId === c.id}
                        onClick={() => void assumir(c.id)}
                      >
                        {busyId === c.id
                          ? "Pegando…"
                          : tecnico
                            ? `Pegar chamado (${tecnico})`
                            : "Pegar chamado"}
                      </button>
                    )}
                    {c.status !== "aberto" && !c.inicio && (
                      <button
                        type="button"
                        className="ghost"
                        disabled={busyId === c.id}
                        onClick={() => void marcarHora(c.id, "inicio")}
                      >
                        Iniciar agora
                      </button>
                    )}
                    {c.inicio && !c.termino && (
                      <button
                        type="button"
                        className="ghost"
                        disabled={busyId === c.id}
                        onClick={() => void marcarHora(c.id, "termino")}
                      >
                        Terminar agora
                      </button>
                    )}
                    {c.status === "em_andamento" && (
                      <button
                        type="button"
                        className="primary"
                        disabled={busyId === c.id}
                        onClick={() => setStatus(c.id, "aguardando_nota")}
                      >
                        Serviço feito
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost"
                      disabled={busyId === c.id}
                      onClick={() =>
                        void (async () => {
                          setBusyId(c.id);
                          await fetch(`/api/chamados/${c.id}`, {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ marcado: !c.marcado }),
                          });
                          setBusyId(null);
                          load();
                        })()
                      }
                    >
                      {c.marcado ? "Desmarcar" : "Marcar"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => startEdit(c)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => copyNota(c)}
                    >
                      {copied === c.id ? "Copiado" : "Copiar para nota"}
                    </button>
                    {c.audio_base64 && (
                      <button
                        type="button"
                        className="ghost"
                        disabled={busyId === c.id}
                        onClick={() => void transcribe(c.id)}
                      >
                        {busyId === c.id ? "Transcrevendo…" : "Transcrever áudio"}
                      </button>
                    )}
                    {c.status === "aguardando_nota" && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setStatus(c.id, "nota_feita")}
                      >
                        Marcar nota feita
                      </button>
                    )}
                    {c.status === "nota_feita" && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setStatus(c.id, "concluido")}
                      >
                        Concluir
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {!pending && items.length === 0 && (
        <p className="empty">Nenhum chamado neste filtro.</p>
      )}
    </section>
  );
}
