const NO_REFRESH_ENDPOINTS = new Set([
  "/auth/login",
  "/auth/refresh-token",
  "/auth/logout",
])

const API_BASE_URLS = {
  prod: "https://api-chronotracker.sinosbyte.com.br",
  hom: "https://api-chrono-hml.sinosbyte.com.br",
  dev: "http://localhost:3001",
} as const

type RefreshResult =
  | { status: "refreshed" }
  | { status: "unauthorized" }
  | { status: "unavailable"; response?: Response }

let refreshInFlight: Promise<RefreshResult> | null = null
let unauthorizedHandler: (() => void) | null = null
const WORKSPACE_STORAGE_KEY = import.meta.env.VITE_STORAGE_WK_KEY

const getApiBaseUrl = () => {
  const environment = import.meta.env.VITE_NODE_ENV

  if (environment === "prod" || environment === "hom" || environment === "dev") {
    return API_BASE_URLS[environment as keyof typeof API_BASE_URLS]
  }

  return API_BASE_URLS.dev
}

const getWorkspaceIdFromStorage = (): string | null => {
  try {
    if (typeof window === "undefined") return null
    // Prefer localStorage (used by WorkspaceProvider) when available
    const fromStorage = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    return fromStorage
  } catch {
    return null
  }
}

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

export function setCurrentWorkspaceId(id?: string) {
  return id ? localStorage.setItem(WORKSPACE_STORAGE_KEY, id) : undefined
}

export interface Resp {
  error: boolean
  message: string
  data?: any
}

const readJsonSafely = async (response: Response) => {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.toLowerCase().includes("application/json")) return null
  return response.json().catch(() => null)
}

const maybeRedirectToLogin = () => {
  if (typeof window === "undefined") return
  if (window.location.pathname === "/login") return
  if (unauthorizedHandler) {
    unauthorizedHandler()
  } else {
    window.location.href = "/login"
  }
}

const refreshSession = async (): Promise<RefreshResult> => {
  const url = `${getApiBaseUrl()}/auth/refresh-token`
  try {
    const response = await fetch(url, { method: "POST", credentials: "include" })
    if (response.ok) return { status: "refreshed" }
    if (response.status === 401) return { status: "unauthorized" }
    return { status: "unavailable", response }
  } catch {
    return { status: "unavailable" }
  }
}

export const apiFetchRaw = async (
  endpoint: string,
  options: RequestInit = {},
  allowRefresh = true
): Promise<Response> => {
  const url = `${getApiBaseUrl()}${endpoint}`
  const isFormData = options.body instanceof FormData

  const headers = new Headers(options.headers)
  if (!isFormData && options.body != null && !headers.has("content-type")) {
    headers.set("Content-Type", "application/json")
  }
  const workspaceId = getWorkspaceIdFromStorage()
  if (workspaceId && !headers.has("X-Workspace-Id")) {
    headers.set("X-Workspace-Id", workspaceId)
  }

  const requestInit: RequestInit = { ...options, credentials: "include", headers }
  const response = await fetch(url, requestInit)

  if (response.status !== 401) return response
  if (!allowRefresh) return response
  if (NO_REFRESH_ENDPOINTS.has(endpoint)) return response

  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null
    })
  }

  const refreshResult = await refreshInFlight
  if (refreshResult.status === "unauthorized") {
    maybeRedirectToLogin()
    return response
  }
  if (refreshResult.status === "unavailable") {
    return (
      refreshResult.response ??
      new Response(
        JSON.stringify({
          error: true,
          message: "Não foi possível renovar a sessão agora. Tente novamente.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    )
  }

  const retryResponse = await fetch(url, requestInit)
  if (retryResponse.status === 401) {
    maybeRedirectToLogin()
  }
  return retryResponse
}

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Resp> => {
  try {
    const response = await apiFetchRaw(endpoint, options)
    const json = await readJsonSafely(response)

    const isObject = (v: unknown): v is Record<string, any> =>
      typeof v === "object" && v !== null && !Array.isArray(v)

    const errorFromJson =
      isObject(json) && typeof json.error === "boolean" ? json.error : undefined
    const messageFromJson =
      isObject(json) && typeof json.message === "string"
        ? json.message
        : undefined

    let data: any = {}
    if (isObject(json)) {
      if ("data" in json) data = (json as any).data
      else if ("error" in json || "message" in json) data = {}
      else data = json
    } else if (json != null) {
      data = json
    }

    const isError = !response.ok || errorFromJson === true

    return {
      error: isError,
      message:
        messageFromJson ||
        (isError ? "Erro ao realizar requisição" : "Request realizada"),
      data,
    } 
  } catch (err) {
    return {
      error: true,
      message:
        err instanceof Error ? err.message : "Erro ao conectar com a API",
      data: {},
    }
  }
}