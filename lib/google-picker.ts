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
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement("script")
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`))
    document.body.appendChild(s)
  })
}

let pickerCarregado = false
async function garantirPicker(): Promise<void> {
  if (pickerCarregado && window.google?.picker) return
  await carregarScript("https://apis.google.com/js/api.js")
  await new Promise<void>((resolve) => {
    window.gapi.load("picker", { callback: () => resolve() })
  })
  pickerCarregado = true
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
