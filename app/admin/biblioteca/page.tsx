import { Suspense } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { AdminBibliotecaContent } from "@/components/admin-biblioteca-content"
import { AdminBibliotecaResumosContent } from "@/components/admin-biblioteca-resumos-content"

export default function AdminBibliotecaPage() {
  return (
    <AdminLayout title="Biblioteca">
      {/* Novo: resumos por Matéria → UP, com cards (arquivo + capa do Drive) */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-bold text-foreground">Resúmenes (por UP)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Escolha a matéria, crie as UPs e adicione os resumos (arquivo e capa) direto do seu Google Drive.
        </p>
        <Suspense fallback={null}>
          <AdminBibliotecaResumosContent />
        </Suspense>
      </section>

      {/* Antigo: mapeamento de pastas públicas do Drive por ID (Libros e demais) */}
      <section className="border-t border-border pt-8">
        <h2 className="mb-1 text-lg font-bold text-foreground">Pastas por matéria (ID do Drive)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Sistema antigo: cola o ID de uma pasta pública do Drive por matéria (usado pelos Libros).
        </p>
        <AdminBibliotecaContent />
      </section>
    </AdminLayout>
  )
}
