import { callClaude } from '@/lib/anthropic'
import type { ClientConfig, Lead, QualificationAnswer } from '@/types'

// Génère l'email de première prise de contact + questions de qualification
export async function generateQualificationEmail(
  lead: Lead,
  answers: QualificationAnswer[],
  config: ClientConfig
): Promise<{ subject: string; body: string }> {
  const answeredKeys = new Set(answers.map((a) => a.question_key))
  const missing = config.qualification_questions.filter(
    (q) => !answeredKeys.has(q.key)
  )

  // Si toutes les infos sont déjà là, on ne devrait pas appeler cette fonction
  // Mais on gère le cas gracieusement
  const questionsToAsk = missing.slice(0, 4) // max 4 questions d'un coup

  const questionsText = questionsToAsk
    .map((q, i) => `${i + 1}. ${q.label}`)
    .join('\n')

  const prompt = `Tu es un assistant commercial pour une entreprise de rénovation énergétique.
Ton rôle est d'écrire un email court, chaleureux et professionnel pour répondre à une demande de devis.

Prospect : ${lead.name ?? 'le prospect'}
Message initial : ${JSON.stringify(lead.raw_data)}

Questions à poser (maximum 4, intégrées naturellement dans le message) :
${questionsText}

Contraintes :
- Ton chaleureux mais professionnel
- Email court (< 120 mots)
- Terminer par "Vous pouvez répondre directement à cet email."
- Ne pas mentionner l'IA ou un robot
- Ne pas promettre de prix dans cet email
- Écrire en français

Réponds UNIQUEMENT avec ce JSON :
{"subject": "<objet de l'email>", "body": "<corps de l'email en texte brut, avec sauts de ligne \\n>"}

JSON:`

  const raw = await callClaude(prompt)

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    return JSON.parse(match[0]) as { subject: string; body: string }
  } catch {
    return {
      subject: 'Votre demande de devis',
      body: `Bonjour ${lead.name ?? ''},\n\nMerci pour votre demande. Pour vous orienter rapidement, pourriez-vous nous préciser :\n${questionsText}\n\nVous pouvez répondre directement à cet email.\n\nCordialement`,
    }
  }
}

// Génère un email de relance selon le step (1, 2 ou 3)
export async function generateRelanceEmail(
  lead: Lead,
  step: number,
  config: ClientConfig
): Promise<{ subject: string; body: string }> {
  const tones: Record<number, string> = {
    1: 'rappel doux et bienveillant (J+1)',
    2: 'relance légère avec simplicité (J+3)',
    3: 'dernier message, proposer directement un créneau (J+7)',
  }

  const prompt = `Tu es un assistant commercial pour une entreprise de rénovation énergétique.
Écris un email de relance en français pour un prospect qui n'a pas répondu.

Prospect : ${lead.name ?? 'le prospect'}
Ton de la relance : ${tones[step] ?? 'relance standard'}
${step === 3 ? `Inclure ce lien de prise de RDV : ${config.cal_booking_url}` : ''}

Contraintes :
- Très court (< 80 mots)
- Naturel, pas robotique
- Ne pas mentionner l'IA
- Ne pas être insistant ou agressif
- Écrire en français

Réponds UNIQUEMENT avec ce JSON :
{"subject": "<objet>", "body": "<corps en texte brut>"}

JSON:`

  const raw = await callClaude(prompt)

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    return JSON.parse(match[0]) as { subject: string; body: string }
  } catch {
    return {
      subject: 'Votre demande de devis — suite',
      body: `Bonjour ${lead.name ?? ''},\n\nJe reviens vers vous concernant votre demande. N'hésitez pas à me répondre si votre projet est toujours d'actualité.\n\nCordialement`,
    }
  }
}

// Génère l'email avec le lien de réservation Cal.com
export async function generateBookingEmail(
  lead: Lead,
  config: ClientConfig,
  aiSummary: string
): Promise<{ subject: string; body: string }> {
  const prompt = `Tu es un assistant commercial pour une entreprise de rénovation énergétique.
Écris un email pour proposer un rendez-vous téléphonique de 15 minutes à un prospect qualifié.

Prospect : ${lead.name ?? 'le prospect'}
Résumé de son projet : ${aiSummary}
Lien de réservation : ${config.cal_booking_url}

Contraintes :
- Court et direct (< 100 mots)
- Mettre le lien de réservation clairement
- Ton enthousiaste et professionnel
- Écrire en français

Réponds UNIQUEMENT avec ce JSON :
{"subject": "<objet>", "body": "<corps en texte brut>"}

JSON:`

  const raw = await callClaude(prompt)

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    return JSON.parse(match[0]) as { subject: string; body: string }
  } catch {
    return {
      subject: 'Planifions un échange sur votre projet',
      body: `Bonjour ${lead.name ?? ''},\n\nVotre projet correspond à nos prestations. Je vous propose un échange rapide de 15 minutes :\n\n${config.cal_booking_url}\n\nCordialement`,
    }
  }
}

// Génère l'email de disqualification poli
export async function generateDisqualificationEmail(
  lead: Lead,
  reason: string
): Promise<{ subject: string; body: string }> {
  const prompt = `Tu es un assistant commercial pour une entreprise de rénovation énergétique.
Écris un email poli pour indiquer à un prospect que vous ne pouvez pas traiter sa demande.

Prospect : ${lead.name ?? 'le prospect'}
Raison (interne, ne pas la répéter mot pour mot) : ${reason}

Contraintes :
- Court et respectueux (< 60 mots)
- Ne pas donner de détails sur les critères internes
- Proposer de revenir si la situation change
- Écrire en français

Réponds UNIQUEMENT avec ce JSON :
{"subject": "<objet>", "body": "<corps en texte brut>"}

JSON:`

  const raw = await callClaude(prompt)

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    return JSON.parse(match[0]) as { subject: string; body: string }
  } catch {
    return {
      subject: 'Votre demande de devis',
      body: `Bonjour ${lead.name ?? ''},\n\nMerci pour votre demande. Nous ne sommes malheureusement pas en mesure de traiter ce type de projet pour le moment.\n\nCordialement`,
    }
  }
}
