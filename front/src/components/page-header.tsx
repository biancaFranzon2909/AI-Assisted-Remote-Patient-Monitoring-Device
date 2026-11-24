import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocation, useNavigate } from "react-router-dom"
import { NotificationMenu } from "./app-notification-menu"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  buttons?: React.ReactNode
  tabs?: { name: string; label?: string; icon: any }[]
  back?: boolean
  activeTab?: string
  onTabChange?: (tabName: string) => void
}

export function PageHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  buttons,
  onTabChange,
}: PageHeaderProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const segments = pathname.split("/").filter(Boolean)
  const isDetailPage = segments.length > 1

  return (
    <header className="py-4 pr-4">
      <div className="flex w-full flex-row">
        {isDetailPage && (
          <div className="flex flex-col justify-center items-center">
            <ChevronLeft
              className="mr-2 size-6 cursor-pointer"
              onClick={() => navigate(-1)}
            />
          </div>
        )}
        <div className="flex w-full flex-col">
          <div className="flex flex-row items-center font-bold text-2xl">{title}</div>
          {subtitle && (
            <div className="flex flex-row items-center text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col space-y-2">
          <div className="flex flex-row justify-end">
            {/* <NotificationMenu /> */}
          </div>
          <div
            className={`flex flex-row items-center justify-end ${buttons ? "visible gap-2" : "hidden"}`}
          >
            {buttons}
          </div>
        </div>
      </div>

      {tabs && activeTab && (
        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="flex w-full flex-row"
        >
          {/* Rola só a faixa de abas em telas estreitas; pb/-mb preservam o
              sublinhado da aba ativa (bottom -5px) sem alterar o layout. */}
          <div className="-mb-1 max-w-full min-w-0 overflow-x-auto pb-1">
            <TabsList variant="line">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <TabsTrigger key={tab.name} value={tab.name}>
                    <Icon />{" "}
                    {tab.label ??
                      tab.name.charAt(0).toUpperCase() + tab.name.slice(1)}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>
        </Tabs>
      )}
    </header>
  )
}
