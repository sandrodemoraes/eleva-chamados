"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aoSairDaTela } from "../lib/ao-sair";
import { formatarReais } from "../lib/parse-chamado";
import { enviar, novoId } from "../lib/outbox";
import type { Produto } from "../lib/types";

type Props = {
  chamadoId: string;
  onChange: () => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

const LADO_MAX = 1280;
const MAX_AUDIO = 900_000;

function lerValor(raw: string): number | null | "invalid" {
  const t = raw.trim();
  if (!t) return null;
  const limpo = t.replace(/[^\d,.-]/g, "");
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  const normal =
    ultimaVirgula > ultimoPonto
      ? limpo.replace(/\./g, "").replace(",", ".")
      : limpo.replace(/,/g, "");
  const n = Number(normal);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return "invalid";
  return Math.round(n * 100) / 100;
}

function juntar(base: string, extra: string) {
  const b = base.trim();
  const e = extra.trim();
  if (!b) return e;
  if (!e) return b;
  return `${b}\n${e}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function comprimir(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let qualidade = 0.72;
  let url = canvas.toDataURL("image/jpeg", qualidade);
  while (url.length > 650_000 && qualidade > 0.35) {
    qualidade -= 0.12;
    url = canvas.toDataURL("image/jpeg", qualidade);
  }
  return url;
}

export function ProdutosPanel({ chamadoId, onChange }: Props) {
  const [itens, setItens] = useState<Produto[]>([]);
  const [locais, setLocais] = useState<Produto[]>([]);
  const [texto, setTexto] = useState("");
  const [valor, setValor] = useState("");
  const [interim, setInterim] = useState("");
  const [foto, setFoto] = useState("");
  const [msg, setMsg] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const baseRef = useRef("");
  const finaisRef = useRef("");
  const wantRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/chamados/${chamadoId}/produtos`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { produtos: Produto[] };
      setItens(data.produtos);
      setLocais((prev) => prev.filter((l) => !data.produtos.some((p) => p.id === l.id)));
    } catch {
      // offline: mostra o que ficou neste aparelho
    }
  }, [chamadoId]);

  useEffect(() => {
    void carregar();
    const onSync = () => void carregar();
    window.addEventListener("eleva-sincronizado", onSync);
    return () => window.removeEventListener("eleva-sincronizado", onSync);
  }, [carregar]);

  useEffect(() => {
    function encerrar() {
      wantRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setOuvindo(false);
      setInterim("");
    }
    const sair = aoSairDaTela(encerrar);
    return () => {
      sair();
      encerrar();
    };
  }, []);

  async function transcrever(dataUrl: string, base: string) {
    setTranscrevendo(true);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio_base64: dataUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        needs_key?: boolean;
        hint?: string;
        error?: string;
      };
      if (data.text?.trim()) {
        setTexto(juntar(base, data.text.trim()));
        setMsg("");
        return;
      }
      if (!finaisRef.current.trim()) {
        setMsg(
          data.needs_key
            ? "A transcrição automática precisa da chave OpenAI. Digite o produto."
            : data.hint || data.error || "Não entendi o áudio. Digite o produto.",
        );
      }
    } catch {
      if (!finaisRef.current.trim()) setMsg("Não deu para transcrever. Digite o produto.");
    } finally {
      setTranscrevendo(false);
    }
  }

  async function falar() {
    if (ouvindo) {
      wantRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
      setOuvindo(false);
      setInterim("");
      return;
    }

    setMsg("");
    baseRef.current = texto.trim();
    finaisRef.current = "";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMsg("Permita o microfone para falar o produto.");
      return;
    }
    streamRef.current = stream;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const base = baseRef.current;
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (streamRef.current === stream) streamRef.current = null;
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size === 0) return;
      void blobToDataUrl(blob).then((dataUrl) => {
        if (dataUrl.startsWith("data:audio/") && dataUrl.length <= MAX_AUDIO) {
          void transcrever(dataUrl, base);
        }
      });
    };
    recorderRef.current = recorder;
    recorder.start();

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Ctor) {
      const recognition = new Ctor();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) finaisRef.current += piece;
          else interimText += piece;
        }
        setInterim(interimText);
        if (finaisRef.current.trim()) setTexto(juntar(base, finaisRef.current));
      };
      recognition.onend = () => {
        /* não chama start de novo: o ditado não fica recomeçando */
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        /* a gravação segue para a transcrição */
      }
    }

    wantRef.current = true;
    setOuvindo(true);
  }

  async function onFoto(file: File | undefined) {
    if (!file) return;
    setMsg("");
    try {
      setFoto(await comprimir(file));
    } catch {
      setMsg("Não foi possível ler a foto.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function adicionar() {
    const nome = texto.trim();
    const preco = lerValor(valor);
    if (preco === "invalid") {
      setMsg("Valor inválido. Use algo como 150,00.");
      return;
    }
    if (!nome && !foto) {
      setMsg("Fale, digite ou fotografe o produto.");
      return;
    }
    setSalvando(true);
    setMsg("");
    const item: Produto = {
      id: novoId(),
      chamado_id: chamadoId,
      texto: nome,
      valor: preco,
      imagem_base64: foto,
      criado_em: new Date().toISOString(),
      criado_por_nome: "",
    };
    const r = await enviar(`/api/chamados/${chamadoId}/produtos`, "POST", item, "Produto");
    setSalvando(false);
    if ("ok" in r && !r.ok) {
      setMsg(r.error);
      return;
    }
    setLocais((prev) => [...prev, item]);
    setTexto("");
    setValor("");
    setFoto("");
    setInterim("");
    finaisRef.current = "";
    if ("queued" in r) setMsg("Sem internet: produto guardado no celular, envia quando o sinal voltar.");
    await carregar();
    onChange();
  }

  async function apagar(id: string) {
    const r = await enviar(`/api/chamados/${chamadoId}/produtos/${id}`, "DELETE", {}, "Apagar produto");
    if ("ok" in r && !r.ok) {
      setMsg(r.error);
      return;
    }
    setItens((prev) => prev.filter((p) => p.id !== id));
    setLocais((prev) => prev.filter((p) => p.id !== id));
    onChange();
  }

  const lista = [...itens, ...locais.filter((l) => !itens.some((p) => p.id === l.id))];

  return (
    <div className="produtos">
      <div className="produto-campos">
        <label className="field" htmlFor={`produto-${chamadoId}`}>
          <span>Produto usado neste serviço</span>
          <textarea
            id={`produto-${chamadoId}`}
            rows={2}
            value={texto}
            placeholder="Ex.: câmera 2 MP, fonte 12V, cabo coaxial"
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <label className="field" htmlFor={`valor-${chamadoId}`}>
          <span>Valor (R$)</span>
          <input
            id={`valor-${chamadoId}`}
            inputMode="decimal"
            value={valor}
            placeholder="0,00"
            onChange={(e) => setValor(e.target.value)}
          />
        </label>
      </div>
      {interim && <p className="hint hint--live">Ouvindo: {interim}</p>}
      <div className="produto-acoes">
        <button
          type="button"
          className={ouvindo ? "primary" : "ghost"}
          onClick={() => void falar()}
          disabled={transcrevendo}
          aria-pressed={ouvindo}
        >
          {ouvindo ? "Parar" : "Falar"}
        </button>
        <label className="ghost file-btn">
          Foto
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void onFoto(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          className="primary"
          disabled={salvando || transcrevendo}
          onClick={() => void adicionar()}
        >
          {salvando ? "Salvando…" : transcrevendo ? "Transcrevendo…" : "Adicionar"}
        </button>
      </div>
      {foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="produto-preview" src={foto} alt="Foto do produto ainda não salva" />
      )}
      {msg && <p className="muted">{msg}</p>}
      {lista.length > 0 && (
        <ul className="produto-lista">
          {lista.map((p) => (
            <li key={p.id} className="produto-item">
              {p.imagem_base64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagem_base64} alt="" />
              ) : null}
              <div className="produto-texto">
                <p>
                  {p.texto || "Foto do produto"}
                  {formatarReais(p.valor) ? ` — ${formatarReais(p.valor)}` : ""}
                </p>
                <button type="button" className="link-btn" onClick={() => void apagar(p.id)}>
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
