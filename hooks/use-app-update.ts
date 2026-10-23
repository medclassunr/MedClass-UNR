"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Versão assada no bundle no momento do build (ver next.config.mjs). Muda a
// cada deploy na Vercel (usa o hash do commit). "dev" localmente.
const VERSAO_ATUAL = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"
const INTERVALO_MS = 60_000

/**
 * Detecta quando saiu uma versão nova da plataforma (sem o aluno precisar
 * desinstalar/reinstalar o atalho do app) e expõe uma função que força um
 * "Ctrl+F5" de verdade: desregistra o service worker, apaga todos os caches
 * e recarrega buscando tudo de novo na rede.
 */
export function useAppUpdate() {
  const [atualizacaoDisponivel, setAtualizacaoDisponivel] = useState(false)
  const [recarregando, setRecarregando] = useState(false)
  const jaAvisou = useRef(false)

  const checarVersao = useCallback(async () => {
    // Em dev não faz sentido (a versão é sempre "dev"); e uma vez que já
    // avisou, para de checar pra não ficar martelando a rede.
    if (jaAvisou.current || VERSAO_ATUAL === "dev") return
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" })
      if (!res.ok) return
      const { version } = (await res.json()) as { version?: string }
      if (version && version !== VERSAO_ATUAL) {
        jaAvisou.current = true
        setAtualizacaoDisponivel(true)
      }
    } catch {
      // Offline ou falha de rede -- ignora e tenta de novo no próximo ciclo.
    }
  }, [])

  useEffect(() => {
    checarVersao()
    const id = setInterval(checarVersao, INTERVALO_MS)
    // Também checa toda vez que o app volta pro primeiro plano -- é quando o
    // aluno reabre o atalho depois de um tempo, o momento mais provável de ter
    // saído uma atualização.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") checarVersao()
    }
    document.addEventListener("visibilitychange", aoVoltar)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", aoVoltar)
    }
  }, [checarVersao])

  const recarregarApp = useCallback(async () => {
    setRecarregando(true)
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
    // Cache-bust forte: um param único na URL faz o navegador (inclusive o
    // WebView do atalho no iOS) tratar como um recurso novo e ignorar o cache
    // HTTP do documento -- é o que mais se aproxima de um Ctrl+F5.
    const url = new URL(window.location.href)
    url.searchParams.set("_v", Date.now().toString())
    window.location.replace(url.toString())
  }, [])

  return { atualizacaoDisponivel, recarregando, recarregarApp }
}
