"use client";

import { useState } from "react";

export function Entrar({ onEntrou }: { onEntrou: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch("/api/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error || "Não foi possível entrar.");
        return;
      }
      onEntrou();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="main entrar">
      <h1 className="headline headline--sm">Eleva Chamados</h1>
      <p className="lede">
        A senha é a mesma para o escritório e para o campo. Depois, cada pessoa
        escolhe o próprio nome.
      </p>
      <form className="entrar-form" onSubmit={enviar}>
        <label className="field" htmlFor="senha-escritorio">
          Senha do escritório
          <input
            id="senha-escritorio"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>
        {erro && (
          <p className="error" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className="primary" disabled={enviando || !senha}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
