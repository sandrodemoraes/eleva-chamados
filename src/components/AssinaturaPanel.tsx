"use client";

import { useEffect, useRef, useState } from "react";
import { enviar } from "../lib/outbox";

type Props = {
  chamadoId: string;
  assinadoNome?: string;
  assinadoEm?: string | null;
  temAssinatura?: boolean;
  onSaved: () => void;
};

function hora(iso: string) {
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

export function AssinaturaPanel({
  chamadoId,
  assinadoNome,
  assinadoEm,
  temAssinatura,
  onSaved,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazio, setVazio] = useState(true);
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");
  const [salva, setSalva] = useState<string>("");
  const [refazer, setRefazer] = useState(!temAssinatura);

  useEffect(() => {
    if (!temAssinatura) return;
    void fetch(`/api/chamados/${chamadoId}/assinatura`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { assinatura_base64?: string } | null) => setSalva(d?.assinatura_base64 ?? ""))
      .catch(() => undefined);
  }, [chamadoId, temAssinatura]);

  useEffect(() => {
    if (!refazer) return;
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#141816";
  }, [refazer]);

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const ctx = e.currentTarget.getContext("2d");
    const p = ponto(e);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    const p = ponto(e);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
    setVazio(false);
  }

  function up() {
    desenhando.current = false;
  }

  function limpar() {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setVazio(true);
  }

  async function salvar() {
    const c = canvas.current;
    if (!c || vazio) return;
    if (!nome.trim()) {
      setMsg("Escreva o nome de quem está assinando.");
      return;
    }
    const img = c.toDataURL("image/png");
    const r = await enviar(
      `/api/chamados/${chamadoId}/assinatura`,
      "POST",
      { assinatura_base64: img, nome, assinado_em: new Date().toISOString() },
      "Assinatura",
    );
    if ("ok" in r && !r.ok) {
      setMsg(r.error);
      return;
    }
    setSalva(img);
    setRefazer(false);
    setMsg("queued" in r ? "Sem internet: assinatura guardada no celular." : "Assinatura salva.");
    onSaved();
  }

  if (!refazer && (salva || temAssinatura)) {
    return (
      <div className="assinatura">
        {salva && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={salva} alt="Assinatura do cliente" className="assinatura-img" />
        )}
        <p className="muted">
          Assinado por {assinadoNome || nome}
          {assinadoEm ? ` em ${hora(assinadoEm)}` : ""}
        </p>
        {msg && <p className="muted">{msg}</p>}
        <button type="button" className="link-btn" onClick={() => setRefazer(true)}>
          Assinar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="assinatura">
      <p className="muted">Peça para o cliente assinar com o dedo no quadro abaixo.</p>
      <canvas
        ref={canvas}
        className="assinatura-pad"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <label className="field">
        <span>Nome de quem assinou</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente ou responsável" />
      </label>
      <div className="actions">
        <button type="button" className="primary" disabled={vazio} onClick={() => void salvar()}>
          Salvar assinatura
        </button>
        <button type="button" className="ghost" onClick={limpar}>
          Limpar
        </button>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
