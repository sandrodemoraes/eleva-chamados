/** Dispara quando a pessoa sai da tela: fecha o app, troca de aplicativo ou o celular bloqueia. */
export function aoSairDaTela(parar: () => void): () => void {
  function ocultar() {
    if (document.visibilityState === "hidden") parar();
  }
  window.addEventListener("pagehide", parar);
  document.addEventListener("visibilitychange", ocultar);
  document.addEventListener("freeze", parar);
  return () => {
    window.removeEventListener("pagehide", parar);
    document.removeEventListener("visibilitychange", ocultar);
    document.removeEventListener("freeze", parar);
  };
}
