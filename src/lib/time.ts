// ============================================================
// Heure locale dans un fuseau, avec gestion automatique de
// l'heure d'été/hiver (DST).
//
// Les serveurs Vercel tournent en UTC. Le code historique faisait
// `getUTCHours() + 1` (UTC+1 codé en dur) → faux l'été en France,
// où le décalage est UTC+2. Résultat : les relances partaient une
// heure trop tôt de mai à octobre, potentiellement hors de la plage
// autorisée par le client.
//
// Intl.DateTimeFormat connaît les règles DST de chaque fuseau IANA,
// donc on délègue le calcul plutôt que de coder un offset.
// ============================================================

// Heure (0-23) d'une date dans le fuseau donné (ex: 'Europe/Paris').
export function getHourInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '0'
  // '24' peut apparaître pour minuit selon l'implémentation → normaliser
  return parseInt(hour, 10) % 24
}
