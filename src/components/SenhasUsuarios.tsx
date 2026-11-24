"use client";

import { useEffect, useState } from "react";

type Pessoa = { id: string; nome: string; papel: "campo" | "escritorio" | "admin"; temSenha: boolean };

const PAPEL_LABEL = { admin: "Admin", escritorio: "Escritório", campo: "Campo" };

export function SenhasUsuarios() {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<Pessoa["papel"]>("campo");
  const [senha, setSenha] = useState("");
  const [limpar, setLimpar] = useState(false);
  const [msg, setMsg] = useState("");

  function carregar() {
    void fetch("/api/usuarios", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { usuarios?: Pessoa[] } | null) => setPessoas(data?.usuarios ?? []))
      .catch(() => setPessoas([]));
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrir(pessoa: Pessoa) {
    setEditando(pessoa.id);
    setNome(pessoa.nome);
    setPapel(pessoa.papel);
    setSenha("");
    setLimpar(false);
    setMsg("");
  }

  async function salvar(id: string) {
    setMsg("");
    const res = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, nome, papel, senha, limparSenha: limpar }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMsg(data.error || "Não foi possível salvar.");
      return;
    }
    setEditando(null);
    setMsg("Usuário atualizado.");
    carregar();
  }

  async function excluir(pessoa: Pessoa) {
    if (!window.confirm(`Excluir ${pessoa.nome}? Essa pessoa deixa de entrar no app.`)) return;
    setMsg("");
    const res = await fetch("/api/usuarios", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: pessoa.id }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMsg(data.error || "Não foi possível excluir.");
      return;
    }
    setMsg(`${pessoa.nome} excluído.`);
    carregar();
  }

  if (!pessoas) return null;

  return (
    <section className="senhas">
      <button type="button" className="senhas-toggle" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Fechar usuários" : "Usuários"}
      </button>
      {aberto && (
        <>
          <p className="muted">Edite o nome e o papel, ou exclua. Limpar a senha deixa a pessoa criar outra.</p>
          {pessoas.map((pessoa) => {
            const aberta = editando === pessoa.id;
            return (
              <div className="senha-linha" key={pessoa.id}>
                <button type="button" className="senha-nome" aria-expanded={aberta} onClick={() => (aberta ? setEditando(null) : abrir(pessoa))}>
                  {pessoa.nome}
                  <span className="muted">
                    {PAPEL_LABEL[pessoa.papel]} · {pessoa.temSenha ? "Senha definida" : "Sem senha"}
                  </span>
                </button>
                {aberta && (
                  <div className="senha-edicao">
                    <label className="field">
                      Nome
                      <input value={nome} onChange={(e) => setNome(e.target.value)} />
                    </label>
                    <label className="field">
                      Papel
                      <select value={papel} onChange={(e) => setPapel(e.target.value as Pessoa["papel"])}>
                        <option value="campo">Campo</option>
                        <option value="escritorio">Escritório</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <label className="field">
                      Nova senha
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Opcional"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                      />
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={limpar} onChange={(e) => setLimpar(e.target.checked)} />
                      Limpar a senha para a pessoa criar outra
                    </label>
                    <div className="senha-acoes">
                      <button type="button" className="ghost" onClick={() => void salvar(pessoa.id)}>
                        Salvar
                      </button>
                      {pessoa.nome !== "Sandro de Moraes" && (
                        <button type="button" className="ghost" onClick={() => void excluir(pessoa)}>
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
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
