// ============================================================
// Rendu HTML des emails à partir du texte généré.
//
// Les emails étaient envoyés en texte brut. On ajoute une version
// HTML simple et propre (envoi multipart text + html) : meilleure
// délivrabilité et image côté prospect, liens de RDV cliquables.
//
// Sécurité : le corps vient de Claude → on échappe tout le HTML
// avant rendu. Les URLs http(s) sont transformées en liens.
// ============================================================

const URL_RE = /(https?:\/\/[^\s<]+)/g

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Échappe le texte et transforme les URLs en liens cliquables.
function linkifyAndEscape(text: string): string {
  // split avec groupe capturant → les URLs tombent sur les index impairs
  return text
    .split(URL_RE)
    .map((part, i) => {
      if (i % 2 === 1) {
        const safe = escapeHtml(part)
        return `<a href="${safe}" style="color:#2563eb;text-decoration:underline;">${safe}</a>`
      }
      return escapeHtml(part)
    })
    .join('')
}

// Convertit un corps texte (avec \n) en HTML email prêt à envoyer.
export function renderEmailHtml(text: string): string {
  const escaped = linkifyAndEscape(text ?? '')
  const paragraphs = escaped
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;',
    'max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;font-size:15px;line-height:1.6;">',
    paragraphs,
    '</div>',
  ].join('')
}
