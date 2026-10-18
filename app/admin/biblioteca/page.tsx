import { AdminLayout } from "@/components/admin-layout"
import { AdminBibliotecaContent } from "@/components/admin-biblioteca-content"

export default function AdminBibliotecaPage() {
  return (
    <AdminLayout title="Biblioteca">
      <AdminBibliotecaContent />
    </AdminLayout>
  )
}
