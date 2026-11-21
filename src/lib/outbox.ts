"use client";

import { useEffect, useState } from "react";

const DB_NAME = "eleva-chamados";
const STORE = "fila";
const EVENT = "eleva-fila";

type Item = {
  id?: number;
  url: string;
  method: string;
  body: string;
  descricao: string;
  criadoEm: number;
};

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }
  | { queued: true };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
  });
}

function avisarMudanca() {
  window.dispatchEvent(new Event(EVENT));
}

async function guardar(item: Omit<Item, "id" | "criadoEm">) {
  await tx("readwrite", (s) => s.add({ ...item, criadoEm: Date.now() }));
  avisarMudanca();
}

export async function pendentes(): Promise<Item[]> {
  if (typeof indexedDB === "undefined") return [];
  return tx("readonly", (s) => s.getAll() as IDBRequest<Item[]>);
}

/** Falha de rede ou servidor fora do ar: vale guardar e tentar de novo. */
function deveGuardar(status: number) {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

/**
 * Envia para a API. Sem internet, guarda no aparelho e devolve `queued`;
 * a fila é reenviada na ordem quando a conexão volta.
 */
export async function enviar<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  descricao: string,
): Promise<Resultado<T>> {
  const payload = JSON.stringify(body ?? {});
  const fila = await pendentes().catch(() => []);
  // Mantém a ordem: se já há itens esperando, este entra atrás deles.
  if (!navigator.onLine || fila.length > 0) {
    await guardar({ url, method, body: payload, descricao });
    void sincronizar();
    return { queued: true };
  }
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: payload,
    });
    if (deveGuardar(res.status)) {
      await guardar({ url, method, body: payload, descricao });
      return { queued: true };
    }
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error || "Não foi possível salvar", status: res.status };
    }
    return { ok: true, data };
  } catch {
    await guardar({ url, method, body: payload, descricao });
    return { queued: true };
  }
}

let sincronizando: Promise<void> | null = null;

export function sincronizar(): Promise<void> {
  sincronizando ??= rodarFila().finally(() => {
    sincronizando = null;
  });
  return sincronizando;
}

async function rodarFila() {
  if (typeof indexedDB === "undefined" || !navigator.onLine) return;
  const itens = await pendentes();
  for (const item of itens) {
    let status = 0;
    let erro = "";
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { "content-type": "application/json" },
        body: item.body,
      });
      status = res.status;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        erro = data.error ?? "";
      }
    } catch {
      status = 0;
    }
    if (deveGuardar(status) || status === 401) break;
    await tx("readwrite", (s) => s.delete(item.id as number));
    if (status >= 400) {
      window.dispatchEvent(
        new CustomEvent("eleva-fila-erro", {
          detail: `${item.descricao}: ${erro || `erro ${status}`}`,
        }),
      );
    }
    avisarMudanca();
  }
  avisarMudanca();
  window.dispatchEvent(new Event("eleva-sincronizado"));
}

/** Quantidade de envios guardados no aparelho e último erro da fila. */
export function useFila() {
  const [qtd, setQtd] = useState(0);
  const [online, setOnline] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const atualizar = () => {
      void pendentes()
        .then((p) => setQtd(p.length))
        .catch(() => setQtd(0));
    };
    const onOnline = () => {
      setOnline(true);
      void sincronizar();
    };
    const onOffline = () => setOnline(false);
    const onErro = (e: Event) => setErro((e as CustomEvent<string>).detail);

    setOnline(navigator.onLine);
    atualizar();
    void sincronizar();
    window.addEventListener(EVENT, atualizar);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("eleva-fila-erro", onErro);
    const timer = window.setInterval(() => void sincronizar(), 30_000);
    return () => {
      window.removeEventListener(EVENT, atualizar);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("eleva-fila-erro", onErro);
      window.clearInterval(timer);
    };
  }, []);

  return { qtd, online, erro, limparErro: () => setErro("") };
}

export function novoId(): string {
  return crypto.randomUUID();
}
