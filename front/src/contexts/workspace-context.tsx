import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useAuth } from "@/contexts/auth-context"
import { setCurrentWorkspaceId } from "@/lib/api-client"
import { setCurrentWorkspace, deleteCurrentWorkspace } from "@/lib/utils"

export interface Workspace {
  id: string
  name: string
  isAdmin?: boolean
  isOwner?: boolean
}

interface WorkspaceContextValue {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  switchWorkspace: (
    id: string,
    availableWorkspaces?: readonly Workspace[],
  ) => boolean
  isLoading: boolean
}

const STORAGE_KEY = import.meta.env.VITE_STORAGE_WK_KEY
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: authIsLoading } = useAuth()
  const [currentWorkspace, setCurrentWs] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const workspaces = useMemo<Workspace[]>(
    () =>
      (user?.empresas ?? []).map((empresa) => ({
        id: empresa.identificador,
        name: empresa.nomeEmpresa,
        isAdmin: empresa.cargo === "ADMIN",
        isOwner: empresa.cargo === "OWNER",
      })),
    [user],
  )

  // Sync workspace when user changes (login / logout / refetch)
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentWs(null)
      setCurrentWorkspaceId(undefined)
      // só limpa o storage após o auth ter carregado (logout real, não carregamento inicial)
      if (!authIsLoading) {
        localStorage.removeItem(STORAGE_KEY)
        deleteCurrentWorkspace()
      }
      setIsLoading(false)
      return
    }

    if (workspaces.length === 0) {
      setCurrentWs(null)
      setCurrentWorkspaceId(undefined)
      localStorage.removeItem(STORAGE_KEY)
      deleteCurrentWorkspace()
      setIsLoading(false)
      return
    }

    const savedId = localStorage.getItem(STORAGE_KEY)
    const restored = workspaces.find((w) => w.id === savedId) ?? workspaces[0]

    setCurrentWs(restored)
    setCurrentWorkspaceId(restored.id)
    setCurrentWorkspace(restored.id)
    setIsLoading(false)
  }, [user, workspaces, isAuthenticated, authIsLoading])

  const switchWorkspace = useCallback(
    (id: string, availableWorkspaces: readonly Workspace[] = workspaces) => {
      const found = availableWorkspaces.find((workspace) => workspace.id === id)
      if (!found) return false
      setCurrentWs(found)
      setCurrentWorkspaceId(found.id)
      localStorage.setItem(STORAGE_KEY, found.id)
      setCurrentWorkspace(found.id)
      return true
    },
    [workspaces]
  )

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, currentWorkspace, switchWorkspace, isLoading }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>")
  return ctx
}
