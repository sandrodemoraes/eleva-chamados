"use client";

import { useState } from "react";
import { AudioPlayer } from "./AudioPlayer";

/** Só baixa o áudio quando alguém toca para ouvir. */
export function AudioSob({ chamadoId }: { chamadoId: string }) {
  const [src, setSrc] = useState("");
  const [estado, setEstado] = useState<"idle" | "loading" | "erro">("idle");

  async function carregar() {
    setEstado("loading");
    try {
      const res = await fetch(`/api/chamados/${chamadoId}/audio`);
      const data = (await res.json()) as { audio_base64?: string };
      if (!res.ok || !data.audio_base64) throw new Error();
      setSrc(data.audio_base64);
      setEstado("idle");
    } catch {
      setEstado("erro");
    }
  }

  if (src) {
    return (
      <div className="audio-linha">
        <AudioPlayer src={src} autoPlay onParou={() => setSrc("")} />
        <button type="button" className="chip" onClick={() => setSrc("")}>
          Parar
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="chip"
      disabled={estado === "loading"}
      onClick={() => void carregar()}
    >
      {estado === "loading"
        ? "Carregando áudio…"
        : estado === "erro"
          ? "Tentar ouvir de novo"
          : "▶ Ouvir áudio"}
    </button>
  );
}
