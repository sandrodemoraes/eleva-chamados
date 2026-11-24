"use client";

import { useState } from "react";
import { EQUIPE, ESCRITORIO } from "../lib/equipe";

export function Entrar({ onEntrou }: { onEntrou: (nome: string) => void }) {
  const [nome, setNome] = useState("");
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
        body: JSON.stringify({ nome, senha }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error || "Não foi possível entrar.");
        return;
      }
      onEntrou(nome);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="main entrar">
      <h1 className="headline headline--sm">Eleva Chamados</h1>
      <p className="lede">Cada pessoa entra com o próprio nome e a própria senha.</p>
      <form className="entrar-form" onSubmit={enviar}>
        <label className="field" htmlFor="usuario-nome">
          Usuário
          <select
            id="usuario-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          >
            <option value="">Escolha seu nome</option>
            <optgroup label="Escritório">
              {ESCRITORIO.map((pessoa) => (
                <option key={pessoa} value={pessoa}>
                  {pessoa}
                </option>
              ))}
            </optgroup>
            <optgroup label="Campo">
              {EQUIPE.map((pessoa) => (
                <option key={pessoa} value={pessoa}>
                  {pessoa}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="field" htmlFor="usuario-senha">
          Senha
          <input
            id="usuario-senha"
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
        <button type="submit" className="primary" disabled={enviando || !nome || !senha}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
