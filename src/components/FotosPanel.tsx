"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { enviar, novoId } from "../lib/outbox";
import type { Foto } from "../lib/types";

type Props = {
  chamadoId: string;
  onChange: () => void;
};

const LADO_MAX = 1280;

/** Reduz a foto no próprio celular: ~150 KB em vez de vários MB. */
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

function posicao(): Promise<{ latitude: number; longitude: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 },
    );
  });
}

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

export function FotosPanel({ chamadoId, onChange }: Props) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [locais, setLocais] = useState<Foto[]>([]);
  const [tipo, setTipo] = useState<"antes" | "depois">("antes");
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/chamados/${chamadoId}/fotos`);
      if (!res.ok) return;
      const data = (await res.json()) as { fotos: Foto[] };
      setFotos(data.fotos);
      setLocais((prev) => prev.filter((l) => !data.fotos.some((f) => f.id === l.id)));
    } catch {
      // offline: mostra só as fotos guardadas neste aparelho
    }
  }, [chamadoId]);

  useEffect(() => {
    void carregar();
    const onSync = () => void carregar();
    window.addEventListener("eleva-sincronizado", onSync);
    return () => window.removeEventListener("eleva-sincronizado", onSync);
  }, [carregar]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setEnviando(true);
    setMsg("");
    const pos = await posicao();
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        const imagem = await comprimir(file);
        const foto: Foto = {
          id: novoId(),
          chamado_id: chamadoId,
          tipo,
          imagem_base64: imagem,
          legenda: "",
          latitude: pos?.latitude ?? null,
          longitude: pos?.longitude ?? null,
          tirada_em: new Date().toISOString(),
          criado_por_nome: "",
        };
        const r = await enviar(`/api/chamados/${chamadoId}/fotos`, "POST", foto, "Foto");
        if ("ok" in r && !r.ok) {
          setMsg(r.error);
        } else {
          setLocais((prev) => [...prev, foto]);
          if ("queued" in r) setMsg("Sem internet: fotos guardadas no celular, enviam quando o sinal voltar.");
        }
      } catch {
        setMsg("Não foi possível ler a foto.");
      }
    }
    setEnviando(false);
    if (input.current) input.current.value = "";
    await carregar();
    onChange();
  }

  async function apagar(id: string) {
    const r = await enviar(`/api/chamados/${chamadoId}/fotos/${id}`, "DELETE", {}, "Apagar foto");
    if ("ok" in r && !r.ok) {
      setMsg(r.error);
      return;
    }
    setFotos((prev) => prev.filter((f) => f.id !== id));
    setLocais((prev) => prev.filter((f) => f.id !== id));
    onChange();
  }

  const todas = [...fotos, ...locais];

  return (
    <div className="fotos">
      <div className="fotos-head">
        <div className="seg" role="radiogroup" aria-label="Tipo da foto">
          {(["antes", "depois"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              className={tipo === t ? "chip chip--on" : "chip"}
              onClick={() => setTipo(t)}
            >
              {t === "antes" ? "Antes" : "Depois"}
            </button>
          ))}
        </div>
        <label className={`primary file-btn${enviando ? " is-busy" : ""}`}>
          {enviando ? "Enviando…" : "Tirar foto"}
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={enviando}
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
      </div>
      {msg && <p className="muted">{msg}</p>}
      {todas.length > 0 && (
        <ul className="fotos-grid">
          {todas.map((f) => (
            <li key={f.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.imagem_base64} alt={`Foto ${f.tipo}`} loading="lazy" />
              <span className={`foto-tag foto-tag--${f.tipo}`}>{f.tipo}</span>
              <span className="foto-meta">
                {hora(f.tirada_em)}
                {f.latitude !== null && f.longitude !== null && (
                  <>
                    {" · "}
                    <a
                      href={`https://www.google.com/maps?q=${f.latitude},${f.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      local
                    </a>
                  </>
                )}
              </span>
              <button type="button" className="foto-x" onClick={() => void apagar(f.id)} aria-label="Apagar foto">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
