"use client";

import { useEffect, useRef } from "react";
import { aoSairDaTela } from "../lib/ao-sair";

/** Toca uma vez. Áudio gravado no celular não tem fim marcado e o navegador voltava ao início. */
export function AudioPlayer({
  src,
  autoPlay = false,
  onParou,
}: {
  src: string;
  autoPlay?: boolean;
  onParou?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const onParouRef = useRef(onParou);
  onParouRef.current = onParou;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const player: HTMLAudioElement = node;
    player.loop = false;

    let cancelado = false;
    let ultimo = 0;
    let ajustando = false;

    function aoTempo() {
      if (ajustando || cancelado) return;
      if (ultimo > 0.4 && player.currentTime + 0.25 < ultimo) {
        cancelado = true;
        player.pause();
        return;
      }
      ultimo = player.currentTime;
    }

    function aoFim() {
      cancelado = true;
      player.pause();
    }

    async function tocarUmaVez() {
      if (player.duration === Number.POSITIVE_INFINITY) {
        ajustando = true;
        player.pause();
        await new Promise<void>((resolve) => {
          const pronto = () => {
            player.removeEventListener("timeupdate", pronto);
            resolve();
          };
          player.addEventListener("timeupdate", pronto);
          try {
            player.currentTime = 1e101;
          } catch {
            player.removeEventListener("timeupdate", pronto);
            resolve();
          }
        });
        ajustando = false;
        ultimo = 0;
        if (cancelado) return;
        try {
          player.currentTime = 0;
        } catch {
          /* segue do ponto em que o navegador deixou */
        }
      }
      if (cancelado || !autoPlay) return;
      try {
        await player.play();
      } catch {
        /* o navegador pediu um toque na tela */
      }
    }

    player.addEventListener("timeupdate", aoTempo);
    player.addEventListener("ended", aoFim);
    const aoMeta = () => void tocarUmaVez();
    if (player.readyState >= 1) void tocarUmaVez();
    else player.addEventListener("loadedmetadata", aoMeta);

    const sair = aoSairDaTela(() => {
      cancelado = true;
      player.pause();
      onParouRef.current?.();
    });

    return () => {
      cancelado = true;
      player.removeEventListener("timeupdate", aoTempo);
      player.removeEventListener("ended", aoFim);
      player.removeEventListener("loadedmetadata", aoMeta);
      sair();
      player.pause();
    };
  }, [src, autoPlay]);

  return <audio ref={ref} className="audio-preview" controls preload="auto" src={src} />;
}
