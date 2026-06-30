import type { ClientConfig } from '@/types'

// ============================================================
// Rendu HTML des emails à partir du texte généré, avec branding
// optionnel par client (nom, couleur d'accent, logo).
//
// Sécurité : le corps vient de Claude → tout le HTML est échappé.
// Le branding vient de la config client → la couleur est validée
// (hex strict, anti-injection CSS) et le logo doit être en https.
// ============================================================

export interface EmailBranding {
  companyName?: string
  color?: string
  logoUrl?: string
}

const DEFAULT_ACCENT = '#2563eb'
const URL_RE = /(https?:\/\/[^\s<]+)/g

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Couleur sûre : hex 6 chiffres uniquement, sinon défaut (anti-injection CSS).
function safeColor(color?: string): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_ACCENT
}

// Échappe le texte et transforme les URLs en liens cliquables (couleur d'accent).
function linkifyAndEscape(text: string, linkColor: string): string {
  return text
    .split(URL_RE)
    .map((part, i) => {
      if (i % 2 === 1) {
        const safe = escapeHtml(part)
        return `<a href="${safe}" style="color:${linkColor};text-decoration:underline;">${safe}</a>`
      }
      return escapeHtml(part)
    })
    .join('')
}

function renderHeader(branding: EmailBranding | undefined, accent: string): string {
  const logo = branding?.logoUrl
  if (logo && logo.startsWith('https://')) {
    return `<div style="margin:0 0 20px;"><img src="${escapeHtml(logo)}" alt="${escapeHtml(branding?.companyName ?? '')}" style="max-height:40px;border:0;"></div>`
  }
  if (branding?.companyName) {
    return `<div style="font-weight:600;font-size:17px;color:${accent};margin:0 0 20px;">${escapeHtml(branding.companyName)}</div>`
  }
  return ''
}

function renderFooter(branding: EmailBranding | undefined): string {
  if (!branding?.companyName) return ''
  return `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;">${escapeHtml(branding.companyName)}</p>`
}

// Convertit un corps texte (avec \n) en HTML email prêt à envoyer.
export function renderEmailHtml(text: string, branding?: EmailBranding): string {
  const accent = safeColor(branding?.color)
  const escaped = linkifyAndEscape(text ?? '', accent)
  const paragraphs = escaped
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;',
    'max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;font-size:15px;line-height:1.6;">',
    renderHeader(branding, accent),
    paragraphs,
    renderFooter(branding),
    '</div>',
  ].join('')
}

// Extrait le branding depuis la config client (champs optionnels).
export function brandingFromConfig(config?: ClientConfig): EmailBranding {
  const b = config?.branding
  return { companyName: b?.company_name, color: b?.color, logoUrl: b?.logo_url }
}
