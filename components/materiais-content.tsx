"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoaulasGrid } from "@/components/videoaulas-grid"
import { FlashcardDecksGrid } from "@/components/flashcard-decks-grid"
import { BibliotecaDriveContent } from "@/components/biblioteca-drive-content"
import { useLanguage } from "@/lib/i18n"

const VALID_TABS = ["videoaulas", "resumos", "flashcards"]

export function MateriaisContent() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const initialTab = VALID_TABS.includes(tabParam ?? "") ? (tabParam as string) : "videoaulas"
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam)) setActiveTab(tabParam)
  }, [tabParam])

  // Vídeos ficam abertos a todos. Flashcards e resumos mostram tudo pra
  // conta gratuita também, só que com cadeado nos itens bloqueados
  // (flashcards: 1 baralho por matéria liberado; resumos: nenhum liberado)
  // -- cada grade decide isso sozinha via getPlanStatus().
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
      <TabsList>
        <TabsTrigger value="videoaulas">{t.materiais.videoaulas}</TabsTrigger>
        <TabsTrigger value="resumos">{t.materiais.resumos}</TabsTrigger>
        <TabsTrigger value="flashcards">{t.materiais.flashcards}</TabsTrigger>
      </TabsList>

      <TabsContent value="videoaulas">
        <VideoaulasGrid />
      </TabsContent>

      <TabsContent value="resumos">
        <BibliotecaDriveContent />
      </TabsContent>

      <TabsContent value="flashcards">
        <FlashcardDecksGrid />
      </TabsContent>
    </Tabs>
  )
}
