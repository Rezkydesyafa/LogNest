"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { ProjectPicker, ProjectProvider } from "@/components/project-context"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
            <div className="flex items-center gap-2"><SidebarTrigger /><Separator orientation="vertical" className="h-4" /><span className="hidden text-sm font-medium sm:inline">Operations</span></div>
            <ProjectPicker />
          </header>
          <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </ProjectProvider>
  )
}
