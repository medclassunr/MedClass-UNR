// Helper client-only do Google Picker: abre o Drive do admin pra ele escolher
// um arquivo (resumo) ou uma imagem (capa). O token/API key vêm do endpoint
// admin /api/admin/drive/picker-token. Nunca importar no servidor.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: any
    google?: any
  }
}

export interface ArquivoPicker {
  id: string
  name: string
  mimeType?: string
}

function carregarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existente = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
    if (existente) {
      if (existente.dataset.loaded === "1") return resolve()
      existente.addEventListener("load", () => resolve())
      existente.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}`)))
      return
    }
    const s = document.createElement("script")
    s.src = src
    s.async = true
    s.onload = () => {
      s.dataset.loaded = "1"
      resolve()
    }
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`))
    document.body.appendChild(s)
  })
}

// Espera uma condição virar verdadeira (polling), com timeout.
function esperar(cond: () => boolean, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (cond()) return resolve()
    const inicio = Date.now()
    const id = setInterval(() => {
      if (cond()) {
        clearInterval(id)
        resolve()
      } else if (Date.now() - inicio > timeoutMs) {
        clearInterval(id)
        reject(new Error("timeout"))
      }
    }, 50)
  })
}

async function garantirPicker(): Promise<void> {
  if (window.google?.picker) return
  // Etapa 1: baixar apis.google.com/js/api.js
  await carregarScript("https://apis.google.com/js/api.js").catch(() => {
    throw new Error("[Picker etapa 1] Não consegui baixar apis.google.com/js/api.js (bloqueado por rede/extensão/antivírus).")
  })
  // Etapa 2: api.js precisa anexar window.gapi
  await esperar(() => !!window.gapi).catch(() => {
    throw new Error("[Picker etapa 2] api.js baixou, mas window.gapi não apareceu.")
  })
  // Etapa 3: carregar o módulo 'picker' do gapi
  await new Promise<void>((resolve, reject) => {
    window.gapi.load("picker", {
      callback: () => resolve(),
      onerror: () => reject(new Error("[Picker etapa 3] gapi.load('picker') deu onerror.")),
      timeout: 12000,
      ontimeout: () => reject(new Error("[Picker etapa 3] gapi.load('picker') estourou o tempo (módulo do Picker não baixou).")),
    })
  })
  if (!window.google?.picker) throw new Error("[Picker etapa 4] módulo carregou mas google.picker continua indefinido.")
}

interface AbrirOpts {
  accessToken: string
  apiKey: string
  appId?: string | null
  apenasImagens?: boolean
  titulo?: string
}

// Abre o Picker e resolve com o arquivo escolhido (ou null se cancelar).
export async function abrirPicker(opts: AbrirOpts): Promise<ArquivoPicker | null> {
  await garantirPicker()
  const g = window.google
  return new Promise<ArquivoPicker | null>((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.DOCS)
    view.setIncludeFolders(true)
    view.setSelectFolderEnabled(false)
    if (opts.apenasImagens) view.setMimeTypes("image/png,image/jpeg,image/jpg,image/webp")

    const builder = new g.picker.PickerBuilder()
      .setOAuthToken(opts.accessToken)
      .setDeveloperKey(opts.apiKey)
      .addView(view)
      .setTitle(opts.titulo || (opts.apenasImagens ? "Escolher a capa" : "Escolher o arquivo"))
      .setCallback((data: any) => {
        if (data.action === g.picker.Action.PICKED) {
          const doc = data.docs?.[0]
          resolve(doc ? { id: doc.id, name: doc.name, mimeType: doc.mimeType } : null)
        } else if (data.action === g.picker.Action.CANCEL) {
          resolve(null)
        }
      })
    if (opts.appId) builder.setAppId(opts.appId)
    builder.build().setVisible(true)
  })
}
