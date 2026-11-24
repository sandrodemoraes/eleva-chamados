"use client";

import { useEffect, useState } from "react";

type Pessoa = { nome: string; papel: "campo" | "escritorio" | "admin"; temSenha: boolean };

export function SenhasUsuarios() {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [senhas, setSenhas] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

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
      <button
        type="button"
        className="senhas-toggle"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? "Fechar senhas" : "Senhas da equipe"}
      </button>
      {aberto && (
        <>
          <p className="muted">Toque no nome para definir ou trocar a senha.</p>
          {pessoas.map((pessoa) => {
            const aberta = editando === pessoa.nome;
            return (
              <div className="senha-linha" key={pessoa.nome}>
                <button
                  type="button"
                  className="senha-nome"
                  aria-expanded={aberta}
                  onClick={() => setEditando(aberta ? null : pessoa.nome)}
                >
                  {pessoa.nome}
                  <span className="muted">{pessoa.temSenha ? "Definida" : "Sem senha"}</span>
                </button>
                {aberta && (
                  <>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nova senha"
                      aria-label={`Senha de ${pessoa.nome}`}
                      value={senhas[pessoa.nome] ?? ""}
                      onChange={(e) => setSenhas((prev) => ({ ...prev, [pessoa.nome]: e.target.value }))}
                    />
                    <button type="button" className="ghost" onClick={() => void salvar(pessoa.nome)}>
                      Salvar
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {msg && <p className="muted">{msg}</p>}
        </>
      )}
    </section>
  );
}
