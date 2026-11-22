"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { VoiceCapture } from "./VoiceCapture";
import { EquipePicker } from "./EquipePicker";
import { HoraField } from "./HoraField";
import { HistoricoAviso } from "./HistoricoCliente";
import { enviar, novoId } from "../lib/outbox";
import { EQUIPE } from "../lib/equipe";
import { parseChamadoFromSpeech } from "../lib/parse-chamado";
import type { Chamado, ChamadoInput, Urgencia } from "../lib/types";
import type { CamposIA } from "../lib/estruturar";
import { SERVICOS } from "../lib/types";

type Props = {
  onCreated: (chamado?: Chamado) => void;
  modo?: "campo" | "escritorio";
};

const empty: ChamadoInput = {
  cliente: "",
  quem_chamou: "",
  telefone: "",
  endereco: "",
  servico: "Outro",
  defeito: "",
  urgencia: "normal",
  descricao: "",
  transcricao: "",
  audio_base64: "",
  funcionarios: "",
  horario: "",
  inicio: "",
  termino: "",
  marcado: false,
};

function mergeParsed(prev: ChamadoInput, transcript: string): ChamadoInput {
  const parsed = parseChamadoFromSpeech(transcript);
  return {
    ...prev,
    transcricao: transcript,
    descricao: transcript,
    cliente: parsed.cliente || prev.cliente,
    quem_chamou: parsed.quem_chamou || prev.quem_chamou,
    defeito: parsed.defeito || prev.defeito,
    telefone: parsed.telefone || prev.telefone,
    endereco: parsed.endereco || prev.endereco,
    servico:
      parsed.servico !== "Outro" ? parsed.servico : prev.servico || "Outro",
    urgencia:
      parsed.urgencia !== "normal" ? parsed.urgencia : prev.urgencia,
    funcionarios: parsed.funcionarios || prev.funcionarios,
    horario: parsed.horario || prev.horario,
  };
}

function aplicarIA(prev: ChamadoInput, c: CamposIA): ChamadoInput {
  const equipe = c.funcionarios.filter((n) => (EQUIPE as readonly string[]).includes(n));
  return {
    ...prev,
    cliente: c.cliente || prev.cliente,
    quem_chamou: c.quem_chamou || prev.quem_chamou,
    telefone: c.telefone || prev.telefone,
    endereco: c.endereco || prev.endereco,
    servico: c.servico && c.servico !== "Outro" ? c.servico : prev.servico,
    defeito: c.defeitos.length ? c.defeitos.join("\n") : prev.defeito,
    urgencia: c.urgencia || prev.urgencia,
    funcionarios: equipe.length ? equipe.join(", ") : prev.funcionarios,
    horario: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(c.horario) ? c.horario : prev.horario,
    descricao: c.resumo || prev.descricao,
  };
}

export function ChamadoComposer({ onCreated, modo = "campo" }: Props) {
  const [form, setForm] = useState<ChamadoInput>(empty);
  const [aberto, setAberto] = useState(modo === "escritorio");
  const [interim, setInterim] = useState("");
  const [message, setMessage] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [ia, setIa] = useState<"idle" | "loading">("idle");
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  async function organizarComIA(texto: string, automatico = false) {
    if (texto.trim().length < 10 || !navigator.onLine) return;
    setIa("loading");
    try {
      const res = await fetch("/api/estruturar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        campos?: CamposIA;
        needs_key?: boolean;
        error?: string;
      };
      if (data.campos) {
        setForm((prev) => aplicarIA(prev, data.campos!));
        setMessage("A IA organizou o chamado. Confira os campos antes de enviar.");
      } else if (!automatico) {
        setMessage(
          data.needs_key
            ? "A IA precisa da chave OpenAI nas Secrets do app. Os campos foram preenchidos pelas palavras-chave."
            : data.error || "A IA não respondeu agora.",
        );
      }
    } catch {
      if (!automatico) setMessage("A IA não respondeu agora.");
    } finally {
      setIa("idle");
    }
  }

  function onTranscript(text: string, isFinal: boolean) {
    if (isFinal) {
      setInterim("");
      setForm((prev) => {
        const nextTranscript = `${prev.transcricao} ${text}`.trim();
        return mergeParsed(prev, nextTranscript);
      });
    } else {
      setInterim(text);
    }
  }

  async function onAudio(dataUrl: string) {
    setForm((prev) => ({ ...prev, audio_base64: dataUrl }));
    setTranscribing(true);
    setMessage("Passando o áudio para texto…");
    let iaChamada = false;
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio_base64: dataUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        source?: string;
        hint?: string;
        error?: string;
        needs_key?: boolean;
      };
      if (data.text?.trim()) {
        setForm((prev) => {
          const merged = mergeParsed(prev, data.text!.trim());
          return { ...merged, audio_base64: dataUrl };
        });
        setMessage("Áudio convertido em texto. Revise e envie.");
        iaChamada = true;
        void organizarComIA(data.text.trim(), true);
      } else if (data.needs_key || data.source === "none") {
        setMessage(
          data.hint ||
            "Digite o texto do áudio abaixo. A transcrição automática precisa da chave OpenAI nas Secrets.",
        );
      } else if (data.error) {
        setMessage(data.error);
      }
    } catch {
      setMessage("Não deu para transcrever agora. Digite o texto do áudio.");
    } finally {
      setTranscribing(false);
    }
    if (!iaChamada && formRef.current.transcricao) {
      void organizarComIA(formRef.current.transcricao, true);
    }
  }

  function update<K extends keyof ChamadoInput>(key: K, value: ChamadoInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onTranscricaoEdit(value: string) {
    setForm((prev) => mergeParsed(prev, value));
  }

  function salvar() {
    setMessage("");
    startTransition(async () => {
      const result = await enviar<{ chamado: Chamado }>(
        "/api/chamados",
        "POST",
        { ...form, aberto, id: novoId() },
        `Chamado ${form.cliente || "sem cliente"}`,
      );
      if ("ok" in result && !result.ok) {
        setMessage(result.error);
        return;
      }
      onCreated("ok" in result ? result.data.chamado : undefined);
      setForm(empty);
      setInterim("");
      if ("queued" in result) {
        setMessage(
          "Sem internet: o chamado ficou guardado no celular e será enviado sozinho quando o sinal voltar.",
        );
        return;
      }
      setMessage(
        aberto
          ? "Chamado aberto. Os técnicos recebem o aviso para pegar."
          : "Chamado anotado. O escritório já pode fazer a nota.",
      );
    });
  }

  const canSend =
    Boolean(form.descricao || form.cliente || form.defeito || form.audio_base64);

  return (
    <section className="composer">
      <VoiceCapture
        onTranscript={onTranscript}
        onAudio={(dataUrl) => void onAudio(dataUrl)}
        disabled={pending || transcribing}
      />

      {form.audio_base64 && (
        <audio controls src={form.audio_base64} className="audio-preview" />
      )}

      <label className="field">
        <span className="field-head">
          Texto do áudio
          <button
            type="button"
            className="chip chip--ia"
            disabled={ia === "loading" || form.transcricao.trim().length < 10}
            onClick={() => void organizarComIA(form.transcricao)}
          >
            {ia === "loading" ? "Organizando…" : "Organizar com IA"}
          </button>
        </span>
        <textarea
          rows={4}
          value={interim ? `${form.transcricao} ${interim}`.trimStart() : form.transcricao}
          onChange={(e) => onTranscricaoEdit(e.target.value)}
          placeholder="O que foi falado aparece aqui…"
        />
      </label>

      <div className="grid-2">
        <label className="field">
          <span>Cliente</span>
          <input
            value={form.cliente}
            onChange={(e) => update("cliente", e.target.value)}
            placeholder="Empresa ou nome"
          />
        </label>
        <label className="field">
          <span>Quem chamou</span>
          <input
            value={form.quem_chamou}
            onChange={(e) => update("quem_chamou", e.target.value)}
            placeholder="Pessoa que ligou"
          />
        </label>
      </div>

      <HistoricoAviso cliente={form.cliente} />

      <label className="field">
        <span>Defeito informado pelo cliente</span>
        <textarea
          rows={3}
          value={form.defeito}
          onChange={(e) => update("defeito", e.target.value)}
          placeholder={"Um defeito por linha, ex.:\nCâmera da garagem sem imagem\nAlarme disparando sozinho"}
        />
      </label>

      <div className="grid-2">
        <label className="field">
          <span>Telefone</span>
          <input
            value={form.telefone}
            onChange={(e) => update("telefone", e.target.value)}
            placeholder="WhatsApp"
            inputMode="tel"
          />
        </label>
        <label className="field">
          <span>Horário marcado</span>
          <input
            type="datetime-local"
            value={form.horario}
            onChange={(e) => update("horario", e.target.value)}
          />
        </label>
      </div>

      {!aberto && (
        <div className="grid-2">
          <HoraField
            label="Início do serviço"
            value={form.inicio}
            onChange={(v) => update("inicio", v)}
          />
          <HoraField
            label="Término do serviço"
            value={form.termino}
            onChange={(v) => update("termino", v)}
          />
        </div>
      )}

      <label className="field">
        <span>Endereço</span>
        <input
          value={form.endereco}
          onChange={(e) => update("endereco", e.target.value)}
          placeholder="Rua, número, bairro"
        />
      </label>

      <label className="check-row check-row--solo" htmlFor="aberto-novo">
        <input
          id="aberto-novo"
          type="checkbox"
          checked={aberto}
          disabled={pending || transcribing}
          onChange={(e) => setAberto(e.target.checked)}
        />
        <span>Deixar em aberto para o técnico disponível</span>
      </label>

      {!aberto && (
        <EquipePicker
          value={form.funcionarios}
          onChange={(v) => update("funcionarios", v)}
          disabled={pending || transcribing}
        />
      )}

      <label className="check-row check-row--solo" htmlFor="marcado-novo">
        <input
          id="marcado-novo"
          type="checkbox"
          checked={form.marcado}
          disabled={pending || transcribing}
          onChange={(e) => update("marcado", e.target.checked)}
        />
        <span>Marcado / confirmado</span>
      </label>

      <div className="grid-2">
        <label className="field">
          <span>Serviço</span>
          <select
            value={form.servico}
            onChange={(e) => update("servico", e.target.value)}
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
            value={form.urgencia}
            onChange={(e) => update("urgencia", e.target.value as Urgencia)}
          >
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        className="primary"
        disabled={pending || transcribing || !canSend}
        onClick={salvar}
      >
        {pending
          ? "Salvando…"
          : transcribing
            ? "Transcrevendo…"
            : aberto
              ? "Abrir chamado para os técnicos"
              : "Enviar para o escritório"}
      </button>
      {message && <p className="toast">{message}</p>}
    </section>
  );
}
