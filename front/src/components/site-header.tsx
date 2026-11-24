import { Link, useLocation } from "react-router-dom"

import { HOME_LABEL, routeLabels } from "@/components/navigation/nav-config"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { WorkSpaceMenu } from "@/components/workspace-modal"

export function SiteHeader() {
  const { pathname } = useLocation()

  const segments = pathname.split("/").filter(Boolean)
  const sectionSegment = segments[0]
  const sectionLabel = sectionSegment ? routeLabels[sectionSegment] : undefined
  const isHome = segments.length === 0
  const isDetailPage = segments.length > 1

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-1.5"
        />
        <Breadcrumb aria-label="Trilha de navegação" className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className={sectionLabel ? "hidden sm:inline-flex" : undefined}>
              {isHome ? (
                <BreadcrumbPage>{HOME_LABEL}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to="/">{HOME_LABEL}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>

            {sectionLabel && (
              <>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem className="min-w-0">
                  {isDetailPage ? (
                    <BreadcrumbLink asChild>
                      <Link to={`/${sectionSegment}`} className="truncate">
                        {sectionLabel}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate">
                      {sectionLabel}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </>
            )}

            {sectionLabel && isDetailPage && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Detalhes</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <WorkSpaceMenu />
        </div>
      </div>
    </header>
  )
}
