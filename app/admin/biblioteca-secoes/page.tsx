import { Suspense } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { AdminBibliotecaSecoesContent } from "@/components/admin-biblioteca-secoes-content"

export default function AdminBibliotecaSecoesPage() {
  return (
    <AdminLayout title="Resumos (Drive)">
      <Suspense fallback={null}>
        <AdminBibliotecaSecoesContent />
      </Suspense>
    </AdminLayout>
  )
}
