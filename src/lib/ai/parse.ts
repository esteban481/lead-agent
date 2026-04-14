import { callClaude } from '@/lib/anthropic'
import type { ClientConfig, ParsedLeadData, QualificationAnswer } from '@/types'

// Extrait les données structurées d'un message brut du lead
export async function parseLeadMessage(
  message: string,
  config: ClientConfig,
  existingAnswers: QualificationAnswer[] = []
): Promise<ParsedLeadData> {
  const questions = config.qualification_questions
    .map((q) => `- ${q.key}: ${q.label}`)
    .join('\n')

  const alreadyKnown = existingAnswers
    .map((a) => `- ${a.question_key}: ${a.answer}`)
    .join('\n')

  const prompt = `Tu es un assistant qui extrait des informations structurées de messages de prospects.

Questions à remplir :
${questions}

${alreadyKnown ? `Informations déjà connues (ne pas réextraire) :\n${alreadyKnown}\n` : ''}

Message du prospect :
"${message}"

Réponds UNIQUEMENT avec un objet JSON valide contenant les clés trouvées dans le message.
Si une information n'est pas mentionnée, ne l'inclus pas dans le JSON.
Exemple : {"type_logement":"maison","surface":"120m2"}

JSON:`

  const raw = await callClaude(prompt)

  try {
    // Extrait le JSON même si Claude ajoute du texte autour
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(match[0]) as ParsedLeadData
  } catch {
    return {}
  }
}
