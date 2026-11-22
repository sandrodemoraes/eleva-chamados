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
import { AudioSob } from "./AudioSob";
import { ChecklistPanel } from "./ChecklistPanel";
import { FotosPanel } from "./FotosPanel";
import { ProdutosPanel } from "./ProdutosPanel";
import { AssinaturaPanel } from "./AssinaturaPanel";
import { HistoricoCliente } from "./HistoricoCliente";
import { checklistDo, faltandoObrigatorios, lerChecklist } from "../lib/checklists";
import { ehDoEscritorio } from "../lib/equipe";
import { enviar } from "../lib/outbox";

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

type Painel = "checklist" | "fotos" | "produtos" | "assinatura";

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
  const [painel, setPainel] = useState<Record<string, Painel | undefined>>({});
  const [aviso, setAviso] = useState("");

  function alternarPainel(id: string, p: Painel) {
    setPainel((prev) => ({ ...prev, [id]: prev[id] === p ? undefined : p }));
  }

  function patchLocal(id: string, campos: Partial<Chamado>) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...campos } : c)));
  }

  /** PATCH pela fila offline; sem internet atualiza a tela na hora. */
  async function salvarCampos(id: string, campos: Partial<Chamado> & Record<string, unknown>, descricao: string) {
    const r = await enviar(`/api/chamados/${id}`, "PATCH", campos, descricao);
    if ("ok" in r && !r.ok) {
      setError(r.error);
      return false;
    }
    if ("queued" in r) {
      patchLocal(id, campos as Partial<Chamado>);
      setAviso("Sem internet: alteração guardada no celular, envia quando o sinal voltar.");
      return true;
    }
    load();
    return true;
  }

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

  useEffect(() => {
    const onSync = () => {
      setAviso("");
      load();
    };
    window.addEventListener("eleva-sincronizado", onSync);
    return () => window.removeEventListener("eleva-sincronizado", onSync);
  }, [load]);

  async function setStatus(id: string, status: ChamadoStatus) {
    await salvarCampos(id, { status }, "Status");
  }

  async function servicoFeito(c: Chamado) {
    const faltando = faltandoObrigatorios(c.servico, c.checklist);
    if (faltando.length > 0) {
      setPainel((prev) => ({ ...prev, [c.id]: "checklist" }));
      setError(`Complete o checklist antes de fechar: ${faltando.join("; ")}.`);
      return;
    }
    if (!c.tem_assinatura && !window.confirm("Fechar o serviço sem a assinatura do cliente?")) {
      setPainel((prev) => ({ ...prev, [c.id]: "assinatura" }));
      return;
    }
    setError("");
    const campos: Partial<Chamado> = { status: "aguardando_nota" };
    if (!c.termino) campos.termino = agoraLocal();
    await salvarCampos(c.id, campos, "Serviço feito");
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
      await salvarCampos(id, { [campo]: agoraLocal() }, campo === "inicio" ? "Início" : "Término");
    } finally {
      setBusyId(null);
    }
  }

  async function assumir(id: string) {
    if (!tecnico || ehDoEscritorio(tecnico)) {
      setError(
        ehDoEscritorio(tecnico)
          ? "Esse nome é do escritório. Escolha o técnico de campo que vai pegar o chamado."
          : "Escolha seu nome em “Eu sou” no topo para pegar o chamado.",
      );
      return;
    }
    if (!navigator.onLine) {
      setError("Para pegar um chamado é preciso internet, para não pegarem o mesmo ao mesmo tempo.");
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
      if (await salvarCampos(id, draft, "Edição")) cancelEdit();
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
      {aviso && <p className="hint">{aviso}</p>}

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
                  {painel[c.id] !== "produtos" && c.produtos?.trim() && (
                    <div className="defeitos">
                      <p className="defeitos-titulo">Produtos usados</p>
                      <ul>
                        {c.produtos
                          .split("\n")
                          .map((p) => p.trim())
                          .filter(Boolean)
                          .map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                      </ul>
                    </div>
                  )}
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
                  {(c.tem_audio || c.audio_base64) && <AudioSob chamadoId={c.id} />}
                  <HistoricoCliente cliente={c.cliente} excluirId={c.id} />
                  <div className="paineis-tabs">
                    <button
                      type="button"
                      className={painel[c.id] === "checklist" ? "chip chip--on" : "chip"}
                      onClick={() => alternarPainel(c.id, "checklist")}
                    >
                      Checklist{" "}
                      {checklistDo(c.servico).filter((i) => lerChecklist(c.checklist)[i.texto]).length}/
                      {checklistDo(c.servico).length}
                    </button>
                    <button
                      type="button"
                      className={painel[c.id] === "produtos" ? "chip chip--on" : "chip"}
                      onClick={() => alternarPainel(c.id, "produtos")}
                    >
                      Produtos ({c.produtos_count ?? 0})
                    </button>
                    <button
                      type="button"
                      className={painel[c.id] === "fotos" ? "chip chip--on" : "chip"}
                      onClick={() => alternarPainel(c.id, "fotos")}
                    >
                      Fotos ({c.fotos_count ?? 0})
                    </button>
                    <button
                      type="button"
                      className={painel[c.id] === "assinatura" ? "chip chip--on" : "chip"}
                      onClick={() => alternarPainel(c.id, "assinatura")}
                    >
                      {c.tem_assinatura ? "Assinado ✓" : "Assinatura"}
                    </button>
                  </div>
                  {painel[c.id] === "checklist" && (
                    <ChecklistPanel
                      key={`${c.id}-${c.servico}`}
                      chamadoId={c.id}
                      servico={c.servico}
                      raw={c.checklist}
                      onSaved={load}
                    />
                  )}
                  {painel[c.id] === "produtos" && (
                    <ProdutosPanel chamadoId={c.id} onChange={load} />
                  )}
                  {painel[c.id] === "fotos" && <FotosPanel chamadoId={c.id} onChange={load} />}
                  {painel[c.id] === "assinatura" && (
                    <AssinaturaPanel
                      chamadoId={c.id}
                      assinadoNome={c.assinado_nome}
                      assinadoEm={c.assinado_em}
                      temAssinatura={c.tem_assinatura}
                      onSaved={load}
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
                        onClick={() => void servicoFeito(c)}
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
                          await salvarCampos(c.id, { marcado: !c.marcado }, "Marcado");
                          setBusyId(null);
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
                    {(c.tem_audio || c.audio_base64) && (
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
