const pad = (n) => String(n).padStart(2, '0')

export const fmtDate = (iso, fallback = null) => {
  if (!iso) return fallback
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
