import { AtividadesUnrContent } from "@/components/actividades-unr-content"
import { DashboardLayout } from "@/components/dashboard-layout"

export const metadata = {
  title: "Actividades en la UNR | MedClass",
  description: "Aulas, prácticos y seminarios del día en la Facultad de Ciencias Médicas de la UNR",
}

export default function ActividadesUnrPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand">Actividades en la UNR</h1>
        </div>

        <AtividadesUnrContent />
      </div>
    </DashboardLayout>
  )
}
