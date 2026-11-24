"use client";

import { useState } from "react";

export function MinhaSenha() {
  const [aberta, setAberta] = useState(false);
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");

  async function salvar() {
    setMsg("");
    const res = await fetch("/api/minha-senha", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMsg(data.error || "Não foi possível trocar a senha.");
      return;
    }
    setSenha("");
    setAberta(false);
    setMsg("Senha trocada.");
  }

  return (
    <div className="minha-senha">
      <button type="button" className="link-btn" onClick={() => setAberta((v) => !v)}>
        {aberta ? "Cancelar" : "Trocar minha senha"}
      </button>
      {aberta && (
        <span className="minha-senha-form">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Nova senha"
            aria-label="Nova senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button type="button" className="ghost" onClick={() => void salvar()}>
            Salvar
          </button>
        </span>
      )}
      {msg && <span className="muted">{msg}</span>}
    </div>
  );
}
