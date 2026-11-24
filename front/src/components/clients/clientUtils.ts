export const textoOuNulo = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() || null : null

// Só aceita http(s); sem protocolo, assume https. Qualquer outro esquema
// (javascript:, data: etc.) ou URL inválida não vira link.
export const normalizarWebsite = (valor: unknown) => {
  const texto = typeof valor === "string" ? valor.trim() : ""
  if (!texto) return null
  const comProtocolo = /^[a-z][a-z\d+.-]*:\/\//i.test(texto)
    ? texto
    : `https://${texto}`
  try {
    const url = new URL(comProtocolo)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return {
      href: url.href,
      rotulo: url.href.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
    }
  } catch {
    return null
  }
}
