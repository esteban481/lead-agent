import Anthropic from '@anthropic-ai/sdk'

// Le SDK Anthropic retente automatiquement les erreurs transitoires
// (408/409/429 et 5xx, dont 529 "overloaded") avec un backoff
// exponentiel qui respecte le header retry-after. Sans ça, un simple
// pic de charge côté API faisait échouer tout le traitement d'un lead.
// timeout : borne une requête bloquée pour ne pas épuiser le budget
// d'exécution Vercel.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  maxRetries: 4,
  timeout: 30_000,
})

export async function callClaude(prompt: string): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = message.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
    return block.text
  } catch (err) {
    // Après épuisement des retries : on log clairement et on propage.
    // Les webhooks renvoient alors 500 → le provider rejoue, et la garde
    // d'idempotence (processed_webhooks) rend ce rejeu sûr.
    const status = err instanceof Anthropic.APIError ? err.status : undefined
    console.error('[claude] appel échoué', { status, message: (err as Error).message })
    throw err
  }
}
