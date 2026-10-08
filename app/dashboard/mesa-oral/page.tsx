import { DashboardLayout } from "@/components/dashboard-layout"
import { MesaOralGate } from "@/components/mesa-oral-gate"

export const metadata = {
  title: "Mesa Oral | MedClass",
  description: "Simulação de banca de exame oral",
}

export default function MesaOralPage() {
  return (
    <DashboardLayout>
      <MesaOralGate />
    </DashboardLayout>
  )
}
