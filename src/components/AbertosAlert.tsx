"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Chamado } from "../lib/types";

const POLL_MS = 20_000;
const BASE_TITLE = "Eleva Chamados";

type Props = {
  onVerAbertos: () => void;
  onChange: () => void;
  tecnico: string;
};

function base64ParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Inscreve este aparelho para receber aviso mesmo com o app fechado. */
async function inscreverPush(nome: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch("/api/push");
      if (!res.ok) return false;
      const { publicKey } = (await res.json()) as { publicKey: string };
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaBytes(publicKey),
      });
    }
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sub.toJSON(), nome }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function iphoneSemTelaInicial(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

type Permissao = NotificationPermission | "indisponivel";

function permissaoAtual(): Permissao {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "indisponivel";
  }
  return Notification.permission;
}

async function registrarSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

async function avisar(chamado: Chamado, total: number) {
  if (permissaoAtual() !== "granted") return;
  const titulo = "Chamado técnico em aberto";
  const corpo = [chamado.cliente || "Cliente não informado", chamado.servico, chamado.endereco]
    .filter(Boolean)
    .join(" · ");
  const opcoes: NotificationOptions = {
    body: total > 1 ? `${corpo}\n${total} chamados aguardando técnico` : corpo,
    tag: `chamado-${chamado.id}`,
    icon: "/icons/192",
  };
  const reg = await registrarSW();
  if (reg) {
    await reg.showNotification(titulo, opcoes);
  } else {
    new Notification(titulo, opcoes);
  }
}

export function AbertosAlert({ onVerAbertos, onChange, tecnico }: Props) {
  const [abertos, setAbertos] = useState<Chamado[]>([]);
  const [permissao, setPermissao] = useState<Permissao>("default");
  const [push, setPush] = useState(false);
  const [dicaIphone, setDicaIphone] = useState(false);

  useEffect(() => {
    setDicaIphone(iphoneSemTelaInicial());
    if (permissaoAtual() === "granted") {
      void inscreverPush(tecnico).then(setPush);
    }
  }, [tecnico]);
  const conhecidos = useRef<Set<string> | null>(null);

  const verificar = useCallback(async () => {
    try {
      const res = await fetch("/api/chamados?status=aberto&resumo=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { chamados: Chamado[] };
      const lista = data.chamados ?? [];
      const ids = new Set(lista.map((c) => c.id));
      const antes = conhecidos.current;
      if (antes) {
        const novos = lista.filter((c) => !antes.has(c.id));
        for (const c of novos) void avisar(c, lista.length);
        const mudou = novos.length > 0 || [...antes].some((id) => !ids.has(id));
        if (mudou) onChange();
      }
      conhecidos.current = ids;
      setAbertos(lista);
    } catch {
      // sem rede: tenta de novo no próximo ciclo
    }
  }, [onChange]);

  useEffect(() => {
    setPermissao(permissaoAtual());
    if (permissaoAtual() === "granted") void registrarSW();
    void verificar();
    const timer = window.setInterval(() => void verificar(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void verificar();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "abrir-abertos") onVerAbertos();
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [verificar, onVerAbertos]);

  useEffect(() => {
    document.title = abertos.length ? `(${abertos.length}) ${BASE_TITLE}` : BASE_TITLE;
  }, [abertos.length]);

  async function ativar() {
    if (permissaoAtual() === "indisponivel") return;
    const result = await Notification.requestPermission();
    setPermissao(result);
    if (result === "granted") {
      setPush(await inscreverPush(tecnico));
      const reg = await registrarSW();
      const opcoes = { body: "Você vai receber um aviso quando abrirem um chamado técnico." };
      if (reg) await reg.showNotification("Avisos ativados", opcoes);
      else new Notification("Avisos ativados", opcoes);
    }
  }

  const n = abertos.length;

  return (
    <div className={n ? "alerta alerta--on" : "alerta"} role="status">
      <p className="alerta-texto">
        {n === 0
          ? "Nenhum chamado técnico em aberto."
          : n === 1
            ? "1 chamado técnico em aberto esperando técnico."
            : `${n} chamados técnicos em aberto esperando técnico.`}
      </p>
      <div className="alerta-acoes">
        {n > 0 && (
          <button type="button" className="chip" onClick={onVerAbertos}>
            Ver e pegar
          </button>
        )}
        {permissao === "default" && (
          <button type="button" className="chip" onClick={() => void ativar()}>
            Ativar avisos no celular
          </button>
        )}
        {permissao === "granted" && (
          <span className="alerta-nota">
            {push ? "Avisos ativos, mesmo com o app fechado." : "Avisos ativos com o app aberto."}
          </span>
        )}
        {dicaIphone && permissao !== "granted" && (
          <span className="alerta-nota">
            No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”. Abra pelo
            ícone e ative os avisos.
          </span>
        )}
        {permissao === "denied" && (
          <span className="alerta-nota">
            Avisos bloqueados no navegador. Libere nas configurações do site.
          </span>
        )}
      </div>
    </div>
  );
}
