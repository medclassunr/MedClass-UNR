// "Ctrl+F5 de verdade" para o app instalado (PWA): desregistra todos os
// service workers, apaga todos os caches e recarrega com cache-bust forte.
// Usado tanto pelo aviso automático do avatar (hooks/use-app-update) quanto
// pelo botão manual de "Atualizar agora" nas Configurações.
export async function recarregarAppAgora(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ("caches" in window) {
      const chaves = await caches.keys()
      await Promise.all(chaves.map((k) => caches.delete(k)))
    }
  } catch {
    // Se algo falhar ao limpar, ainda assim força o reload abaixo.
  }
  // Param único na URL: faz o navegador (inclusive o WebView do atalho no iOS)
  // tratar como recurso novo e ignorar o cache HTTP do documento.
  const url = new URL(window.location.href)
  url.searchParams.set("_v", Date.now().toString())
  window.location.replace(url.toString())
}
