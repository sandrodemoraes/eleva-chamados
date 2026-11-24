"use client";

import { useEffect, useState } from "react";
import { EQUIPE, ESCRITORIO } from "../lib/equipe";

type Pessoa = { nome: string; papel: "campo" | "escritorio" | "admin"; temSenha: boolean };

const fallback: Pessoa[] = [
  ...ESCRITORIO.map((nome) => ({ nome, papel: "escritorio" as const, temSenha: true })),
  ...EQUIPE.map((nome) => ({ nome, papel: "campo" as const, temSenha: true })),
];

export function Entrar({ onEntrou }: { onEntrou: (nome: string, papel: string) => void }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>(fallback);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [criar, setCriar] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void fetch("/api/entrar", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { usuarios?: Pessoa[] } | null) => {
        if (data?.usuarios?.length) setPessoas(data.usuarios);
      })
      .catch(() => undefined);
  }, []);

  const escolhida = pessoas.find((pessoa) => pessoa.nome === nome);
  const escritorio = pessoas.filter((pessoa) => pessoa.papel === "escritorio");
  const campo = pessoas.filter((pessoa) => pessoa.papel !== "escritorio");

  function escolher(valor: string) {
    setNome(valor);
    setErro("");
    const pessoa = pessoas.find((item) => item.nome === valor);
    setCriar(Boolean(pessoa && !pessoa.temSenha));
  }

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      if (criar && senha !== confirmar) {
        setErro("As senhas não conferem.");
        return;
      }
      const res = await fetch(criar ? "/api/criar-senha" : "/api/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome, senha }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; papel?: string };
      if (res.status === 403 && !criar) {
        setCriar(true);
        setErro("Esta pessoa ainda não tem senha. Crie a sua.");
        return;
      }
      if (!res.ok) {
        setErro(data.error || "Não foi possível entrar.");
        return;
      }
      onEntrou(nome, data.papel || escolhida?.papel || "campo");
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
        {criar
          ? "Crie a sua senha. Na próxima vez, entre com ela."
          : "Cada pessoa entra com o próprio nome e a própria senha."}
      </p>
      <form className="entrar-form" onSubmit={enviar}>
        <label className="field" htmlFor="usuario-nome">
          Usuário
          <select id="usuario-nome" value={nome} onChange={(e) => escolher(e.target.value)} required>
            <option value="">Escolha seu nome</option>
            {escritorio.length > 0 && (
              <optgroup label="Escritório">
                {escritorio.map((pessoa) => (
                  <option key={pessoa.nome} value={pessoa.nome}>
                    {pessoa.nome}
                    {pessoa.temSenha ? "" : " (criar senha)"}
                  </option>
                ))}
              </optgroup>
            )}
            {campo.length > 0 && (
              <optgroup label="Campo">
                {campo.map((pessoa) => (
                  <option key={pessoa.nome} value={pessoa.nome}>
                    {pessoa.nome}
                    {pessoa.temSenha ? "" : " (criar senha)"}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="field" htmlFor="usuario-senha">
          {criar ? "Nova senha" : "Senha"}
          <input
            id="usuario-senha"
            type="password"
            autoComplete={criar ? "new-password" : "current-password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>
        {criar && (
          <label className="field" htmlFor="usuario-senha-2">
            Repita a senha
            <input
              id="usuario-senha-2"
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
            />
          </label>
        )}
        {erro && (
          <p className="error" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className="primary" disabled={enviando || !nome || !senha}>
          {enviando ? "Salvando…" : criar ? "Criar senha e entrar" : "Entrar"}
        </button>
        {nome && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setCriar((valor) => !valor);
              setErro("");
            }}
          >
            {criar ? "Já tenho senha" : "Ainda não tenho senha"}
          </button>
        )}
      </form>
    </main>
  );
}
