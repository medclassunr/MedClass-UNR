"use client"

// Obrigatório pro pdf.js posicionar as <span> da camada de texto em cima da
// palavra certa (position:absolute por span, via seletor `.textLayer span`
// -- sem essa classe/CSS, as spans ficam no fluxo normal do documento,
// empilhadas no canto superior esquerdo, e o marca-texto (que lê
// getBoundingClientRect() de cada span pra saber onde encaixar o grifo)
// acaba desenhando o grifo em qualquer lugar errado, geralmente na margem
// esquerda em branco -- foi exatamente o bug relatado.
import "pdfjs-dist/web/pdf_viewer.css"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Eraser,
  Highlighter,
  ImagePlus,
  Loader2,
  MousePointer2,
  Pen,
  Redo2,
  Save,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/i18n"

// ---------- Tipos ----------

interface Ponto {
  x: number
  y: number
}

interface AnotacaoHighlight {
  id: string
  x: number
  y: number
  largura: number
  altura: number
  cor: string
}

interface AnotacaoTraco {
  id: string
  cor: string
  espessura: number
  pontos: Ponto[]
}

interface AnotacaoTexto {
  id: string
  x: number
  y: number
  largura: number
  altura: number
  texto: string
  cor: string
}

interface AnotacaoImagem {
  id: string
  x: number
  y: number
  largura: number
  altura: number
  src: string
}

interface PaginaAnotacoes {
  highlights: AnotacaoHighlight[]
  tracos: AnotacaoTraco[]
  textos: AnotacaoTexto[]
  imagens: AnotacaoImagem[]
}

type MapaPaginas = Record<number, PaginaAnotacoes>

type Ferramenta = "nenhuma" | "marca-texto" | "caneta" | "texto" | "imagem" | "borracha"

const PAGINA_VAZIA: PaginaAnotacoes = { highlights: [], tracos: [], textos: [], imagens: [] }

const CORES_CANETA = ["#f43f5e", "#2563eb", "#16a34a", "#111827"]
const COR_HIGHLIGHT = "#fde047"

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function clonarPaginas(paginas: MapaPaginas): MapaPaginas {
  return JSON.parse(JSON.stringify(paginas))
}

function paginaDe(paginas: MapaPaginas, pagina: number): PaginaAnotacoes {
  return paginas[pagina] ?? PAGINA_VAZIA
}

function distanciaPontoSegmento(p: Ponto, a: Ponto, b: Ponto) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimento2 = dx * dx + dy * dy
  if (comprimento2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimento2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function pontoDentroRetangulo(p: Ponto, r: { x: number; y: number; largura: number; altura: number }) {
  return p.x >= r.x && p.x <= r.x + r.largura && p.y >= r.y && p.y <= r.y + r.altura
}

// Comprime/redimensiona a imagem antes de embutir como base64 no jsonb --
// evita linhas gigantes no banco (mesma técnica já usada no avatar do
// aluno no CRM na Mão).
function comprimirImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = reject
      img.onload = () => {
        const maxLado = 1100
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
        const largura = Math.round(img.width * escala)
        const altura = Math.round(img.height * escala)
        const canvas = document.createElement("canvas")
        canvas.width = largura
        canvas.height = altura
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("canvas"))
        ctx.drawImage(img, 0, 0, largura, altura)
        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

interface BibliotecaPdfEditorProps {
  // Chave usada em biblioteca_anotacoes.drive_file_id -- prefixada
  // ("proprio:<id>") pro upload próprio do aluno pra nunca colidir com um
  // ID real do Drive.
  chaveAnotacao: string
  nome: string
  onClose: () => void
  // Drive: busca via proxy autenticado (driveFileId). Upload próprio: usa
  // uma signed URL do Storage direto (já é a própria autenticação, e já
  // suporta Range nativamente) -- só um dos dois é informado.
  driveFileId?: string
  urlPdf?: string
}

export function BibliotecaPdfEditor({ chaveAnotacao, nome, onClose, driveFileId, urlPdf }: BibliotecaPdfEditorProps) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasPdfRef = useRef<HTMLCanvasElement>(null)
  const canvasDesenhoRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)
  const inputImagemRef = useRef<HTMLInputElement>(null)

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [numPaginas, setNumPaginas] = useState(0)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [escala, setEscala] = useState(1)
  const [renderizandoPagina, setRenderizandoPagina] = useState(false)

  const [paginas, setPaginas] = useState<MapaPaginas>({})
  const [ferramenta, setFerramenta] = useState<Ferramenta>("nenhuma")
  const [corAtiva, setCorAtiva] = useState(CORES_CANETA[0])
  const [alteracoesNaoSalvas, setAlteracoesNaoSalvas] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoFechar, setConfirmandoFechar] = useState(false)

  const historicoRef = useRef<{ stack: MapaPaginas[]; pointer: number }>({ stack: [{}], pointer: 0 })
  const [podeDesfazer, setPodeDesfazer] = useState(false)
  const [podeRefazer, setPodeRefazer] = useState(false)

  const arrastoRef = useRef<{
    tipo: "marca-texto" | "caneta" | null
    pontos: Ponto[]
  }>({ tipo: null, pontos: [] })

  const elementoArrastandoRef = useRef<{
    id: string
    tipoCampo: "texto" | "imagem"
    modo: "mover" | "redimensionar"
    inicioPointer: Ponto
    inicioObj: { x: number; y: number; largura: number; altura: number }
  } | null>(null)

  // ---------- Carregar PDF + anotações salvas ----------

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const pdfjsLib = await import("pdfjs-dist")
        // Servido do próprio domínio (public/pdf.worker.min.mjs, copiado de
        // node_modules/pdfjs-dist/build na mesma versão do pacote) -- carregar
        // o worker de um CDN (unpkg etc.) é bloqueado pela Content-Security-
        // Policy do site (script-src só libera 'self' + alguns domínios
        // específicos, não CDNs genéricos -- ver next.config.mjs). Sem isso o
        // pdf.js cai pro modo "fake worker" (thread principal) e depois dá
        // erro de rede de qualquer forma.
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

        let loadingTask
        if (urlPdf) {
          loadingTask = pdfjsLib.getDocument({ url: urlPdf })
        } else {
          const { data: sessao } = await supabase.auth.getSession()
          const token = sessao.session?.access_token
          if (!token) throw new Error("sem sessão")
          loadingTask = pdfjsLib.getDocument({
            url: `/api/biblioteca/arquivo/${driveFileId}?modo=inline`,
            httpHeaders: { Authorization: `Bearer ${token}` },
          })
        }
        const pdf = await loadingTask.promise
        if (cancelado) return
        pdfDocRef.current = pdf
        setNumPaginas(pdf.numPages)

        const { data: existente } = await supabase
          .from("biblioteca_anotacoes")
          .select("paginas")
          .eq("drive_file_id", chaveAnotacao)
          .maybeSingle()
        if (cancelado) return

        const paginasCarregadas: MapaPaginas = (existente?.paginas as MapaPaginas) ?? {}
        setPaginas(paginasCarregadas)
        historicoRef.current = { stack: [paginasCarregadas], pointer: 0 }
        setPodeDesfazer(false)
        setPodeRefazer(false)
        setPaginaAtual(1)
      } catch {
        if (!cancelado) setErro(t.biblioteca.erroCarregarArquivos)
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveAnotacao, driveFileId, urlPdf])

  // ---------- Renderizar página atual (canvas PDF + text layer) ----------

  const renderizarPagina = useCallback(async () => {
    const pdf = pdfDocRef.current
    const canvas = canvasPdfRef.current
    const canvasDesenho = canvasDesenhoRef.current
    const textLayerEl = textLayerRef.current
    if (!pdf || !canvas || !canvasDesenho) return

    setRenderizandoPagina(true)
    try {
      const page = await pdf.getPage(paginaAtual)
      let escalaAtual = escala
      if (escalaAtual === 1 && containerRef.current) {
        const viewportNativo = page.getViewport({ scale: 1 })
        const larguraDisponivel = containerRef.current.clientWidth - 32
        escalaAtual = Math.max(0.5, Math.min(2.2, larguraDisponivel / viewportNativo.width))
        setEscala(escalaAtual)
      }

      const viewport = page.getViewport({ scale: escalaAtual })
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvasDesenho.width = viewport.width
      canvasDesenho.height = viewport.height

      const ctx = canvas.getContext("2d")
      if (ctx) await page.render({ canvasContext: ctx, viewport }).promise

      if (textLayerEl) {
        textLayerEl.innerHTML = ""
        textLayerEl.style.width = `${viewport.width}px`
        textLayerEl.style.height = `${viewport.height}px`
        const pdfjsLib = await import("pdfjs-dist")
        const textContent = await page.getTextContent()
        const camada = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textLayerEl, viewport })
        await camada.render()
      }

      redesenharTracos()
    } finally {
      setRenderizandoPagina(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaAtual, escala])

  useEffect(() => {
    if (!carregando) renderizarPagina()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, paginaAtual, escala])

  const redesenharTracos = useCallback(() => {
    const canvas = canvasDesenhoRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const tracos = paginaDe(paginas, paginaAtual).tracos
    for (const traco of tracos) {
      if (traco.pontos.length < 2) continue
      ctx.strokeStyle = traco.cor
      ctx.lineWidth = traco.espessura * escala
      ctx.lineJoin = "round"
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(traco.pontos[0].x * escala, traco.pontos[0].y * escala)
      for (const p of traco.pontos.slice(1)) ctx.lineTo(p.x * escala, p.y * escala)
      ctx.stroke()
    }
  }, [paginas, paginaAtual, escala])

  useEffect(() => {
    redesenharTracos()
  }, [redesenharTracos])

  // ---------- Histórico (desfazer/refazer) ----------

  const aplicarMudanca = (novaPagina: PaginaAnotacoes) => {
    const novoMapa: MapaPaginas = { ...paginas, [paginaAtual]: novaPagina }
    const hist = historicoRef.current
    const novoStack = hist.stack.slice(0, hist.pointer + 1)
    novoStack.push(clonarPaginas(novoMapa))
    historicoRef.current = { stack: novoStack, pointer: novoStack.length - 1 }
    setPaginas(novoMapa)
    setAlteracoesNaoSalvas(true)
    setPodeDesfazer(novoStack.length > 1)
    setPodeRefazer(false)
  }

  const desfazer = () => {
    const hist = historicoRef.current
    if (hist.pointer === 0) return
    hist.pointer -= 1
    setPaginas(clonarPaginas(hist.stack[hist.pointer]))
    setAlteracoesNaoSalvas(true)
    setPodeDesfazer(hist.pointer > 0)
    setPodeRefazer(true)
  }

  const refazer = () => {
    const hist = historicoRef.current
    if (hist.pointer >= hist.stack.length - 1) return
    hist.pointer += 1
    setPaginas(clonarPaginas(hist.stack[hist.pointer]))
    setAlteracoesNaoSalvas(true)
    setPodeDesfazer(true)
    setPodeRefazer(hist.pointer < hist.stack.length - 1)
  }

  // ---------- Coordenadas ----------

  const pointerParaCoordenada = (ev: React.PointerEvent): Ponto => {
    const rect = containerRef.current?.getBoundingClientRect()
    const base = canvasPdfRef.current?.getBoundingClientRect() ?? rect
    if (!base) return { x: 0, y: 0 }
    return { x: (ev.clientX - base.left) / escala, y: (ev.clientY - base.top) / escala }
  }

  // ---------- Pointer handlers na camada de interação ----------

  const handlePointerDown = (ev: React.PointerEvent) => {
    const ponto = pointerParaCoordenada(ev)

    if (ferramenta === "caneta") {
      arrastoRef.current = { tipo: "caneta", pontos: [ponto] }
      ;(ev.target as Element).setPointerCapture?.(ev.pointerId)
      return
    }

    if (ferramenta === "marca-texto") {
      arrastoRef.current = { tipo: "marca-texto", pontos: [ponto] }
      ;(ev.target as Element).setPointerCapture?.(ev.pointerId)
      return
    }

    if (ferramenta === "borracha") {
      apagarProximo(ponto)
      return
    }
  }

  const handlePointerMove = (ev: React.PointerEvent) => {
    const arrasto = arrastoRef.current
    if (!arrasto.tipo) return
    const ponto = pointerParaCoordenada(ev)
    arrasto.pontos.push(ponto)

    if (arrasto.tipo === "caneta") {
      const ctx = canvasDesenhoRef.current?.getContext("2d")
      if (ctx && arrasto.pontos.length >= 2) {
        const a = arrasto.pontos[arrasto.pontos.length - 2]
        const b = ponto
        ctx.strokeStyle = corAtiva
        ctx.lineWidth = 2.5 * escala
        ctx.lineJoin = "round"
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.moveTo(a.x * escala, a.y * escala)
        ctx.lineTo(b.x * escala, b.y * escala)
        ctx.stroke()
      }
    }
  }

  const handlePointerUp = () => {
    const arrasto = arrastoRef.current
    if (!arrasto.tipo) return

    if (arrasto.tipo === "caneta" && arrasto.pontos.length >= 2) {
      const pagina = paginaDe(paginas, paginaAtual)
      const novoTraco: AnotacaoTraco = { id: gerarId(), cor: corAtiva, espessura: 2.5, pontos: arrasto.pontos }
      aplicarMudanca({ ...pagina, tracos: [...pagina.tracos, novoTraco] })
    }

    if (arrasto.tipo === "marca-texto") {
      comitarMarcaTexto(arrasto.pontos)
    }

    arrastoRef.current = { tipo: null, pontos: [] }
  }

  // Precisão por caractere, não por span inteira: cada <span> do pdf.js
  // normalmente é uma linha/trecho inteiro de texto -- marcar a span toda
  // sempre que o arrasto tocasse nela grifava palavras/trechos que o aluno
  // nem passou o mouse por cima. Aqui testamos caractere a caractere (via
  // Range.getBoundingClientRect() no nó de texto), e só depois fundimos
  // índices contíguos marcados num único retângulo -- dá pra grifar só
  // "metade de uma palavra", igual um marca-texto de verdade.
  const comitarMarcaTexto = (pontos: Ponto[]) => {
    if (pontos.length === 0) return
    const inicio = pontos[0]
    const fim = pontos[pontos.length - 1]
    const minX = Math.min(inicio.x, fim.x) * escala
    const maxX = Math.max(inicio.x, fim.x) * escala
    const minY = Math.min(inicio.y, fim.y) * escala
    const maxY = Math.max(inicio.y, fim.y) * escala

    const spans = textLayerRef.current?.querySelectorAll("span") ?? []
    const containerRect = textLayerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const novosHighlights: AnotacaoHighlight[] = []

    spans.forEach((span) => {
      const texto = span.textContent ?? ""
      const textNode = span.firstChild
      if (!texto.trim() || !textNode || textNode.nodeType !== Node.TEXT_NODE) return

      // Descarta a span toda de cara se nem tocar o retângulo do arrasto --
      // evita percorrer caractere por caractere de uma página inteira.
      const spanRect = span.getBoundingClientRect()
      const spanRelX = spanRect.left - containerRect.left
      const spanRelY = spanRect.top - containerRect.top
      const tocaSpan =
        spanRelX < maxX && spanRelX + spanRect.width > minX && spanRelY < maxY && spanRelY + spanRect.height > minY
      if (!tocaSpan) return

      const range = document.createRange()
      let inicioRun = -1

      const fecharRun = (fimRun: number) => {
        if (inicioRun === -1) return
        range.setStart(textNode, inicioRun)
        range.setEnd(textNode, fimRun)
        const r = range.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          novosHighlights.push({
            id: gerarId(),
            x: (r.left - containerRect.left) / escala,
            y: (r.top - containerRect.top) / escala,
            largura: r.width / escala,
            altura: r.height / escala,
            cor: COR_HIGHLIGHT,
          })
        }
        inicioRun = -1
      }

      for (let i = 0; i < texto.length; i++) {
        range.setStart(textNode, i)
        range.setEnd(textNode, i + 1)
        const r = range.getBoundingClientRect()
        const relX = r.left - containerRect.left
        const relY = r.top - containerRect.top
        const tocaCaractere = relX < maxX && relX + r.width > minX && relY < maxY && relY + r.height > minY
        if (tocaCaractere && inicioRun === -1) inicioRun = i
        if (!tocaCaractere) fecharRun(i)
      }
      fecharRun(texto.length)
    })

    if (novosHighlights.length === 0) return
    const pagina = paginaDe(paginas, paginaAtual)
    aplicarMudanca({ ...pagina, highlights: [...pagina.highlights, ...novosHighlights] })
  }

  const apagarProximo = (ponto: Ponto) => {
    const pagina = paginaDe(paginas, paginaAtual)

    for (const traco of pagina.tracos) {
      for (let i = 0; i < traco.pontos.length - 1; i++) {
        if (distanciaPontoSegmento(ponto, traco.pontos[i], traco.pontos[i + 1]) < 8 / escala) {
          aplicarMudanca({ ...pagina, tracos: pagina.tracos.filter((tr) => tr.id !== traco.id) })
          return
        }
      }
    }
    for (const h of pagina.highlights) {
      if (pontoDentroRetangulo(ponto, h)) {
        aplicarMudanca({ ...pagina, highlights: pagina.highlights.filter((x) => x.id !== h.id) })
        return
      }
    }
    for (const img of pagina.imagens) {
      if (pontoDentroRetangulo(ponto, img)) {
        aplicarMudanca({ ...pagina, imagens: pagina.imagens.filter((x) => x.id !== img.id) })
        return
      }
    }
    for (const txt of pagina.textos) {
      if (pontoDentroRetangulo(ponto, txt)) {
        aplicarMudanca({ ...pagina, textos: pagina.textos.filter((x) => x.id !== txt.id) })
        return
      }
    }
  }

  const removerHighlightClicado = (id: string) => {
    if (ferramenta !== "nenhuma" && ferramenta !== "marca-texto") return
    const pagina = paginaDe(paginas, paginaAtual)
    aplicarMudanca({ ...pagina, highlights: pagina.highlights.filter((h) => h.id !== id) })
  }

  // ---------- Inserir texto / imagem ----------

  const inserirTexto = () => {
    const pagina = paginaDe(paginas, paginaAtual)
    const novo: AnotacaoTexto = {
      id: gerarId(),
      x: 40,
      y: 40,
      largura: 180,
      altura: 60,
      texto: "",
      cor: corAtiva,
    }
    aplicarMudanca({ ...pagina, textos: [...pagina.textos, novo] })
    setFerramenta("nenhuma")
  }

  const editarTexto = (id: string, texto: string) => {
    const pagina = paginaDe(paginas, paginaAtual)
    aplicarMudanca({ ...pagina, textos: pagina.textos.map((tObj) => (tObj.id === id ? { ...tObj, texto } : tObj)) })
  }

  const handleArquivoImagem: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
    const file = ev.target.files?.[0]
    ev.target.value = ""
    if (!file) return
    const src = await comprimirImagem(file)
    const pagina = paginaDe(paginas, paginaAtual)
    const novo: AnotacaoImagem = { id: gerarId(), x: 60, y: 60, largura: 220, altura: 160, src }
    aplicarMudanca({ ...pagina, imagens: [...pagina.imagens, novo] })
    setFerramenta("nenhuma")
  }

  // ---------- Arrastar/redimensionar texto e imagem ----------

  const iniciarArrastoElemento = (
    ev: React.PointerEvent,
    id: string,
    tipoCampo: "texto" | "imagem",
    modo: "mover" | "redimensionar",
    objAtual: { x: number; y: number; largura: number; altura: number }
  ) => {
    ev.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    elementoArrastandoRef.current = {
      id,
      tipoCampo,
      modo,
      inicioPointer: { x: ev.clientX, y: ev.clientY },
      inicioObj: objAtual,
    }
    ;(ev.target as Element).setPointerCapture?.(ev.pointerId)
  }

  const moverElemento = (ev: React.PointerEvent) => {
    const estado = elementoArrastandoRef.current
    if (!estado) return
    const dx = (ev.clientX - estado.inicioPointer.x) / escala
    const dy = (ev.clientY - estado.inicioPointer.y) / escala
    const pagina = paginaDe(paginas, paginaAtual)
    const lista = estado.tipoCampo === "texto" ? pagina.textos : pagina.imagens

    const atualizada = lista.map((item) => {
      if (item.id !== estado.id) return item
      if (estado.modo === "mover") {
        return { ...item, x: estado.inicioObj.x + dx, y: estado.inicioObj.y + dy }
      }
      return {
        ...item,
        largura: Math.max(40, estado.inicioObj.largura + dx),
        altura: Math.max(30, estado.inicioObj.altura + dy),
      }
    })

    setPaginas((prev) => ({
      ...prev,
      [paginaAtual]: estado.tipoCampo === "texto" ? { ...pagina, textos: atualizada as AnotacaoTexto[] } : { ...pagina, imagens: atualizada as AnotacaoImagem[] },
    }))
  }

  const finalizarArrastoElemento = () => {
    if (!elementoArrastandoRef.current) return
    elementoArrastandoRef.current = null
    setAlteracoesNaoSalvas(true)
    const hist = historicoRef.current
    const novoStack = hist.stack.slice(0, hist.pointer + 1)
    novoStack.push(clonarPaginas(paginas))
    historicoRef.current = { stack: novoStack, pointer: novoStack.length - 1 }
    setPodeDesfazer(true)
    setPodeRefazer(false)
  }

  // ---------- Salvar ----------

  const salvar = async () => {
    setSalvando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error("sem usuário")

      const { error } = await supabase.from("biblioteca_anotacoes").upsert(
        {
          user_id: userId,
          drive_file_id: chaveAnotacao,
          drive_file_nome: nome,
          paginas,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "user_id,drive_file_id" }
      )
      if (error) throw error
      setAlteracoesNaoSalvas(false)
      return true
    } catch {
      alert(t.biblioteca.erroSalvarAnotacoes)
      return false
    } finally {
      setSalvando(false)
    }
  }

  const handleFechar = () => {
    if (alteracoesNaoSalvas) {
      setConfirmandoFechar(true)
      return
    }
    onClose()
  }

  const pagina = paginaDe(paginas, paginaAtual)
  const cursorClasse =
    ferramenta === "caneta" || ferramenta === "marca-texto"
      ? "cursor-crosshair"
      : ferramenta === "borracha"
        ? "cursor-pointer"
        : "cursor-default"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4">
      <div className="flex h-full max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{nome}</p>
          <button
            type="button"
            onClick={handleFechar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Barra de ferramentas */}
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
          <FerramentaBtn dataTutorial="biblioteca-tool-ponteiro" ativo={ferramenta === "nenhuma"} onClick={() => setFerramenta("nenhuma")} title={t.biblioteca.ferramentaPonteiro}>
            <MousePointer2 className="h-4 w-4" />
          </FerramentaBtn>
          <FerramentaBtn dataTutorial="biblioteca-tool-marca-texto" ativo={ferramenta === "marca-texto"} onClick={() => setFerramenta("marca-texto")} title={t.biblioteca.ferramentaMarcaTexto}>
            <Highlighter className="h-4 w-4" />
          </FerramentaBtn>
          <FerramentaBtn dataTutorial="biblioteca-tool-caneta" ativo={ferramenta === "caneta"} onClick={() => setFerramenta("caneta")} title={t.biblioteca.ferramentaCaneta}>
            <Pen className="h-4 w-4" />
          </FerramentaBtn>
          <FerramentaBtn dataTutorial="biblioteca-tool-texto" ativo={false} onClick={inserirTexto} title={t.biblioteca.ferramentaTexto}>
            <Type className="h-4 w-4" />
          </FerramentaBtn>
          <FerramentaBtn dataTutorial="biblioteca-tool-imagem" ativo={false} onClick={() => inputImagemRef.current?.click()} title={t.biblioteca.ferramentaImagem}>
            <ImagePlus className="h-4 w-4" />
          </FerramentaBtn>
          <input ref={inputImagemRef} type="file" accept="image/*" hidden onChange={handleArquivoImagem} />
          <FerramentaBtn dataTutorial="biblioteca-tool-borracha" ativo={ferramenta === "borracha"} onClick={() => setFerramenta("borracha")} title={t.biblioteca.ferramentaBorracha}>
            <Eraser className="h-4 w-4" />
          </FerramentaBtn>

          {(ferramenta === "caneta" || ferramenta === "texto") && (
            <div className="ml-1 flex items-center gap-1">
              {CORES_CANETA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCorAtiva(c)}
                  className={`h-5 w-5 rounded-full border-2 ${corAtiva === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          <div className="mx-1 h-5 w-px bg-border" />

          <FerramentaBtn dataTutorial="biblioteca-tool-desfazer" ativo={false} onClick={desfazer} disabled={!podeDesfazer} title={t.biblioteca.desfazer}>
            <Undo2 className="h-4 w-4" />
          </FerramentaBtn>
          <FerramentaBtn ativo={false} onClick={refazer} disabled={!podeRefazer} title={t.biblioteca.refazer}>
            <Redo2 className="h-4 w-4" />
          </FerramentaBtn>

          <div className="mx-1 h-5 w-px bg-border" />

          <FerramentaBtn ativo={false} onClick={() => setEscala((e) => Math.max(0.5, e - 0.15))} title={t.biblioteca.diminuirZoom}>
            <ZoomOut className="h-4 w-4" />
          </FerramentaBtn>
          <FerramentaBtn ativo={false} onClick={() => setEscala((e) => Math.min(2.5, e + 0.15))} title={t.biblioteca.aumentarZoom}>
            <ZoomIn className="h-4 w-4" />
          </FerramentaBtn>

          <div className="ml-auto flex items-center gap-1.5">
            {alteracoesNaoSalvas && <span className="text-[11px] text-muted-foreground">{t.biblioteca.naoSalvo}</span>}
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !alteracoesNaoSalvas}
              data-tutorial="biblioteca-tool-salvar"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t.biblioteca.salvar}
            </button>
          </div>
        </div>

        {/* Área do PDF */}
        <div ref={containerRef} className="relative flex-1 overflow-auto bg-muted/20 p-4">
          {carregando ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.biblioteca.carregando}
            </div>
          ) : erro ? (
            <div className="flex h-full items-center justify-center text-sm text-destructive">{erro}</div>
          ) : (
            <div className="relative mx-auto" style={{ width: "fit-content" }}>
              <canvas ref={canvasPdfRef} className="block shadow-md" />
              <div ref={textLayerRef} className="textLayer pointer-events-none absolute left-0 top-0" />
              <canvas ref={canvasDesenhoRef} className="pointer-events-none absolute left-0 top-0" />

              {/* Highlights */}
              {pagina.highlights.map((h) => (
                <div
                  key={h.id}
                  onClick={() => removerHighlightClicado(h.id)}
                  title={t.biblioteca.clicarParaRemover}
                  className="absolute cursor-pointer mix-blend-multiply"
                  style={{
                    left: h.x * escala,
                    top: h.y * escala,
                    width: h.largura * escala,
                    height: h.altura * escala,
                    backgroundColor: h.cor,
                  }}
                />
              ))}

              {/* Textos */}
              {pagina.textos.map((txt) => (
                <div
                  key={txt.id}
                  className="absolute rounded border border-dashed border-foreground/30 bg-background/70 p-1"
                  style={{ left: txt.x * escala, top: txt.y * escala, width: txt.largura * escala, height: txt.altura * escala }}
                >
                  <div
                    onPointerDown={(ev) => iniciarArrastoElemento(ev, txt.id, "texto", "mover", txt)}
                    className="mb-0.5 h-2.5 w-full cursor-move rounded-sm bg-foreground/10"
                  />
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(ev) => editarTexto(txt.id, ev.currentTarget.textContent ?? "")}
                    className="h-[calc(100%-14px)] overflow-auto text-sm outline-none"
                    style={{ color: txt.cor }}
                  >
                    {txt.texto}
                  </div>
                  <div
                    onPointerDown={(ev) => iniciarArrastoElemento(ev, txt.id, "texto", "redimensionar", txt)}
                    className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-foreground/30"
                  />
                </div>
              ))}

              {/* Imagens */}
              {pagina.imagens.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <div
                  key={img.id}
                  className="group absolute border border-border"
                  style={{ left: img.x * escala, top: img.y * escala, width: img.largura * escala, height: img.altura * escala }}
                  onPointerDown={(ev) => iniciarArrastoElemento(ev, img.id, "imagem", "mover", img)}
                >
                  <img src={img.src} alt="" className="h-full w-full object-contain" draggable={false} />
                  <div
                    onPointerDown={(ev) => iniciarArrastoElemento(ev, img.id, "imagem", "redimensionar", img)}
                    className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-se-resize bg-foreground/40"
                  />
                </div>
              ))}

              {/* Camada de interação (marca-texto/caneta/borracha) */}
              <div
                className={`absolute left-0 top-0 h-full w-full ${cursorClasse}`}
                style={{ pointerEvents: ferramenta === "nenhuma" ? "none" : "auto" }}
                onPointerDown={handlePointerDown}
                onPointerMove={(ev) => {
                  handlePointerMove(ev)
                  moverElemento(ev)
                }}
                onPointerUp={() => {
                  handlePointerUp()
                  finalizarArrastoElemento()
                }}
              />

              {renderizandoPagina && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paginação */}
        {!carregando && !erro && (
          <div className="flex items-center justify-center gap-3 border-t border-border px-3 py-2">
            <FerramentaBtn ativo={false} onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))} disabled={paginaAtual <= 1} title="">
              <ArrowLeft className="h-4 w-4" />
            </FerramentaBtn>
            <span className="text-xs tabular-nums text-muted-foreground">
              {paginaAtual} / {numPaginas}
            </span>
            <FerramentaBtn
              ativo={false}
              onClick={() => setPaginaAtual((p) => Math.min(numPaginas, p + 1))}
              disabled={paginaAtual >= numPaginas}
              title=""
            >
              <ArrowRight className="h-4 w-4" />
            </FerramentaBtn>
          </div>
        )}
      </div>

      {confirmandoFechar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-xl bg-card p-4 shadow-2xl">
            <p className="text-sm font-medium text-foreground">{t.biblioteca.alteracoesNaoSalvasTitulo}</p>
            <p className="text-xs text-muted-foreground">{t.biblioteca.alteracoesNaoSalvasTexto}</p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmandoFechar(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                {t.biblioteca.cancelar}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmandoFechar(false)
                  onClose()
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                {t.biblioteca.descartar}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await salvar()
                  setConfirmandoFechar(false)
                  if (ok) onClose()
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                {t.biblioteca.salvarEFechar}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FerramentaBtn({
  ativo,
  onClick,
  title,
  disabled,
  children,
  dataTutorial,
}: {
  ativo: boolean
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
  dataTutorial?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-tutorial={dataTutorial}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
        ativo ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
