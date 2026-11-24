"use client";

import { useEffect, useState } from "react";

type Pessoa = { nome: string; papel: "campo" | "escritorio"; temSenha: boolean };

export function SenhasUsuarios() {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [senhas, setSenhas] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/usuarios", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { usuarios?: Pessoa[] } | null) => {
        setPessoas(data?.usuarios ?? []);
      })
      .catch(() => setPessoas([]));
  }, []);

  async function salvar(nome: string) {
    const senha = senhas[nome] ?? "";
    setMsg("");
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome, senha }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMsg(data.error || "Não foi possível salvar a senha.");
      return;
    }
    setSenhas((prev) => ({ ...prev, [nome]: "" }));
    setPessoas((prev) => prev?.map((p) => (p.nome === nome ? { ...p, temSenha: true } : p)) ?? prev);
    setMsg(`Senha de ${nome} salva.`);
  }

  if (!pessoas) return null;

  return (
    <section className="senhas">
      <p className="defeitos-titulo">Senhas da equipe</p>
      <p className="muted">Cada pessoa usa o próprio nome e esta senha para entrar.</p>
      {pessoas.map((pessoa) => (
        <div className="senha-linha" key={pessoa.nome}>
          <label className="field">
            {pessoa.nome}
            <span className="muted">{pessoa.temSenha ? "Senha definida" : "Sem senha"}</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Nova senha"
              value={senhas[pessoa.nome] ?? ""}
              onChange={(e) => setSenhas((prev) => ({ ...prev, [pessoa.nome]: e.target.value }))}
            />
          </label>
          <button type="button" className="ghost" onClick={() => void salvar(pessoa.nome)}>
            Salvar
          </button>
        </div>
      ))}
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
