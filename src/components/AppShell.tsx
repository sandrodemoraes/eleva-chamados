"use client";

import { useCallback, useEffect, useState } from "react";
import { ChamadoComposer } from "./ChamadoComposer";
import { ChamadoBoard } from "./ChamadoBoard";
import { AbertosAlert } from "./AbertosAlert";
import { EQUIPE, ESCRITORIO } from "../lib/equipe";
import { Entrar } from "./Entrar";
import { MinhaSenha } from "./MinhaSenha";
import { SenhasUsuarios } from "./SenhasUsuarios";
import { useFila } from "../lib/outbox";
import type { Chamado } from "../lib/types";

type Mode = "campo" | "abertos" | "escritorio";

const TECNICO_KEY = "eleva-tecnico";

export function AppShell() {
  const [mode, setMode] = useState<Mode>("campo");
  const [refreshToken, setRefreshToken] = useState(0);
  const [tecnico, setTecnico] = useState("");
  const [conta, setConta] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  const [liberado, setLiberado] = useState<boolean | null>(null);
  const [porSenha, setPorSenha] = useState(false);
  const [podeSenhas, setPodeSenhas] = useState(false);

  const fila = useFila();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    setTecnico(localStorage.getItem(TECNICO_KEY) ?? "");
    if (new URLSearchParams(window.location.search).get("aba") === "abertos") {
      setMode("abertos");
    }
    void fetch("/api/acesso", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { por?: string } | null;
        setLiberado(res.ok);
        setPorSenha(data?.por === "senha");
      })
      .catch(() => setLiberado(false));
    void fetch("/api/eu", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { name?: string; email?: string; por?: string; podeSenhas?: boolean } | null) => {
        if (!data) return;
        setPodeSenhas(Boolean(data.podeSenhas));
        if (data.por === "senha" && data.name) {
          setConta(data.name);
          setTecnico(data.name);
          localStorage.setItem(TECNICO_KEY, data.name);
          return;
        }
        setConta(data.email || data.name || "");
      })
      .catch(() => undefined);
  }, []);

  function escolherTecnico(nome: string) {
    setTecnico(nome);
    if (nome) localStorage.setItem(TECNICO_KEY, nome);
    else localStorage.removeItem(TECNICO_KEY);
  }

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);
  const verAbertos = useCallback(() => setMode("abertos"), []);
  const irParaCampo = useCallback(() => {
    setMode("campo");
    refresh();
    window.scrollTo({ top: 0 });
  }, [refresh]);

  function onCreated(_chamado?: Chamado) {
    refresh();
  }

  async function sair() {
    await fetch("/api/sair", { method: "POST" });
    setPorSenha(false);
    setConta("");
    setLiberado(false);
  }

  if (liberado !== true) {
    return (
      <div className="shell">
        <header className="top">
          <div className="brand-block">
            <p className="brand">ELEVA</p>
          </div>
        </header>
        {liberado === false ? (
          <Entrar
            onEntrou={(nome, papel) => {
              setLiberado(true);
              setPorSenha(true);
              setPodeSenhas(papel === "admin");
              setConta(nome);
              setTecnico(nome);
              localStorage.setItem(TECNICO_KEY, nome);
            }}
          />
        ) : (
          <p className="lede">Abrindo…</p>
        )}
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand-block">
          <p className="brand">ELEVA</p>
          {conta && <p className="conta">Entrou com {conta}</p>}
        </div>
        <nav className="modes" aria-label="Modo">
          <button
            type="button"
            className={mode === "campo" ? "mode mode--on" : "mode"}
            onClick={() => setMode("campo")}
          >
            Campo
          </button>
          <button
            type="button"
            className={mode === "abertos" ? "mode mode--on" : "mode"}
            onClick={() => setMode("abertos")}
          >
            Em aberto
          </button>
          <button
            type="button"
            className={mode === "escritorio" ? "mode mode--on" : "mode"}
            onClick={() => setMode("escritorio")}
          >
            Escritório
          </button>
        </nav>
      </header>

      <div className="eu-sou">
        <label htmlFor="eu-sou">Eu sou</label>
        <select
          id="eu-sou"
          value={tecnico}
          disabled={porSenha}
          onChange={(e) => escolherTecnico(e.target.value)}
        >
          <option value="">Escolha seu nome</option>
          <optgroup label="Escritório">
            {ESCRITORIO.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </optgroup>
          <optgroup label="Campo">
            {EQUIPE.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </optgroup>
        </select>
        {porSenha && <MinhaSenha />}
        {porSenha && (
          <button type="button" className="link-btn" onClick={sair}>
            Sair
          </button>
        )}
      </div>
      {podeSenhas && <SenhasUsuarios />}
      {(!fila.online || fila.qtd > 0) && (
        <p className={fila.online ? "fila fila--sync" : "fila"} role="status">
          {!fila.online && "Sem internet. Pode continuar trabalhando: tudo fica guardado no celular."}
          {fila.online && fila.qtd > 0 && "Enviando o que ficou guardado…"}
          {fila.qtd > 0 &&
            ` ${fila.qtd} ${fila.qtd === 1 ? "envio pendente" : "envios pendentes"}.`}
        </p>
      )}
      {fila.erro && (
        <p className="error" role="alert">
          Um envio guardado foi recusado: {fila.erro}{" "}
          <button type="button" className="link-btn" onClick={fila.limparErro}>
            ok
          </button>
        </p>
      )}

      <AbertosAlert onVerAbertos={verAbertos} onChange={refresh} tecnico={tecnico} />

      {mode === "campo" && (
        <main className="main main--campo">
          <h1 className="headline headline--sm">Serviços no campo</h1>
          <p className="lede">
            Chamados que você pegou. Anote o produto, o valor e o
            deslocamento durante a execução. O mínimo de cada chamado é R$ 150.
          </p>
          <ChamadoBoard
            key="campo"
            refreshToken={refreshToken}
            tecnico={tecnico}
            initialFilter="em_andamento"
          />
          <h2 className="headline headline--sm">Anote outro chamado falando</h2>
          <ChamadoComposer autor={tecnico} onCreated={onCreated} />
        </main>
      )}

      {mode === "abertos" && (
        <main className="main">
          <h1 className="headline headline--sm">Chamados em aberto</h1>
          <p className="lede">
            Chamados que o escritório abriu sem técnico. Quem estiver
            disponível toca em “Pegar chamado” e o serviço fica no seu nome.
          </p>
          <ChamadoBoard
            key="abertos"
            refreshToken={refreshToken}
            tecnico={tecnico}
            initialFilter="aberto"
            onAssumiu={irParaCampo}
          />
        </main>
      )}

      {mode === "escritorio" && (
        <main className="main">
          <h1 className="headline headline--sm">Fila do escritório</h1>
          <p className="lede">
            Abra chamados para os técnicos, copie o texto pronto e marque
            quando a nota do cliente estiver feita.
          </p>
          {abrindo ? (
            <div className="abrir-box">
              <div className="abrir-head">
                <h2>Abrir chamado</h2>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setAbrindo(false)}
                >
                  Fechar
                </button>
              </div>
              <ChamadoComposer modo="escritorio" autor={tecnico} onCreated={onCreated} />
            </div>
          ) : (
            <button
              type="button"
              className="primary abrir-btn"
              onClick={() => setAbrindo(true)}
            >
              + Abrir chamado
            </button>
          )}
          <ChamadoBoard
            key="escritorio"
            refreshToken={refreshToken}
            tecnico={tecnico}
            initialFilter="todos"
            onAssumiu={irParaCampo}
          />
        </main>
      )}
    </div>
  );
}
