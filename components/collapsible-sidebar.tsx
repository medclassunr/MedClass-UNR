"use client"

import { ChevronRight } from "lucide-react"
import { SidebarNav } from "@/components/sidebar-nav"
import { useCollapsiblePanel } from "@/hooks/use-collapsible-panel"

export function CollapsibleSidebar() {
  const { expanded, pinned, onMouseEnter, onMouseLeave, togglePinned } = useCollapsiblePanel(
    "medclass-sidebar-pinned"
  )

  return (
    <aside className={`hidden shrink-0 transition-[width] duration-200 ease-in-out lg:block ${pinned ? "w-64" : "w-16"}`}>
      <div
        data-tutorial="sidebar-menu"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`fixed inset-y-0 left-0 z-40 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out ${
          expanded ? "w-64 shadow-xl" : "w-16"
        }`}
      >
        <SidebarNav compact={!expanded} />

        <button
          type="button"
          onClick={togglePinned}
          aria-label={pinned ? "Recolher menu" : "Fixar menu aberto"}
          title={pinned ? "Recolher menu" : "Fixar menu aberto"}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${pinned ? "rotate-180" : ""}`} />
        </button>
      </div>
    </aside>
  )
}
