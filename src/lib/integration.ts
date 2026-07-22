// ============================================================
// Génération du guide d'intégration d'un client : l'endpoint et le
// snippet à coller pour brancher son formulaire web sur l'agent.
//
// Le webhook attend du JSON (req.json()), donc le snippet utilise
// fetch (un <form> HTML natif poste en form-encoded → incompatible).
// Logique pure et testable.
// ============================================================

export function webhookEndpoint(origin: string, clientId: string): string {
  return `${origin.replace(/\/$/, '')}/api/webhook/form?client_id=${clientId}`
}

export function integrationSnippet(origin: string, clientId: string): string {
  const endpoint = webhookEndpoint(origin, clientId)
  return `<!-- Formulaire de captation de leads -->
<form id="lead-form">
  <input name="name" placeholder="Nom" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" placeholder="Téléphone" />
  <textarea name="message" placeholder="Votre projet"></textarea>
  <!-- Champ anti-bot : laissez-le caché en CSS -->
  <input name="website" tabindex="-1" autocomplete="off" style="display:none" />
  <button type="submit">Envoyer</button>
</form>

<script>
document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  await fetch('${endpoint}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  e.target.innerHTML = '<p>Merci ! Nous revenons vers vous très vite.</p>';
});
</script>`
}
