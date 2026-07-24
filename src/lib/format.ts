// ============================================================
// Formatage d'affichage — logique pure et testable.
// ============================================================

// Date lisible d'un coup d'œil : « aujourd'hui », « hier »,
// « il y a 3 j », puis date courte au-delà d'une semaine.
// (La date exacte reste disponible en title au survol.)
export function relativeDay(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''

  const startOf = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.floor((startOf(now) - startOf(then)) / 86_400_000)

  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  return then.toLocaleDateString('fr-FR')
}
