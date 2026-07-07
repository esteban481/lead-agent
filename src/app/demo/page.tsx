import Link from 'next/link'
import type { Metadata } from 'next'
import DemoForm from './DemoForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Lead Agent — Transformez vos leads en rendez-vous qualifiés',
  description:
    "Un agent IA qui répond à vos leads en moins d'une minute, les qualifie par email et remplit votre agenda de rendez-vous qualifiés.",
}

const STEPS = [
  {
    n: '1',
    title: 'Un lead arrive',
    text: 'Votre formulaire web envoie le lead à l’agent, quelle que soit l’heure.',
  },
  {
    n: '2',
    title: 'Réponse en moins d’une minute',
    text: 'L’agent répond par email et pose vos questions de qualification, naturellement.',
  },
  {
    n: '3',
    title: 'Scoring sur vos critères',
    text: 'Chaque lead est noté A, B, C ou D selon votre zone, vos types de projets, votre budget.',
  },
  {
    n: '4',
    title: 'RDV dans votre agenda',
    text: 'Les leads chauds reçoivent votre lien de réservation. Les silencieux sont relancés à J+1, J+3, J+7.',
  },
]

const FEATURES = [
  ['Réponse immédiate', 'Le premier arrivé décroche le lead : votre agent répond avant vos concurrents.'],
  ['Vos critères, pas les nôtres', 'Questions, zone, scoring et seuils configurés pour votre activité.'],
  ['Relances automatiques', 'Trois relances polies, aux bonnes heures, qui s’arrêtent dès que le lead répond.'],
  ['Respect des prospects', 'Un « pas intéressé » est compris et clôturé poliment. Un opt-out est définitif.'],
  ['Vos couleurs', 'Les emails portent votre nom, votre logo, votre ton — jamais celui d’un robot.'],
  ['Tout est mesuré', 'Funnel de conversion, temps de première réponse, RDV pris : un dashboard clair.'],
]

// Page publique : vitrine de l'offre + démo live branchée sur le client démo.
export default function DemoPage() {
  const demoClientId = process.env.DEMO_CLIENT_ID

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <section className="text-center max-w-2xl mx-auto space-y-5">
        <h1 className="text-4xl font-bold leading-tight">
          Transformez vos leads entrants en{' '}
          <span className="text-blue-600">rendez-vous qualifiés</span>
        </h1>
        <p className="text-lg text-gray-600">
          Un agent IA qui répond à vos leads en moins d&apos;une minute, pose vos
          questions de qualification par email, et ne remplit votre agenda
          qu&apos;avec des prospects sérieux.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="#demo"
            className="bg-blue-600 text-white rounded-lg px-6 py-3 text-sm font-semibold hover:bg-blue-700"
          >
            Tester la démo en direct
          </a>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
            Espace client →
          </Link>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-center mb-8">Comment ça marche</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mb-3">
                {s.n}
              </div>
              <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Points forts */}
      <section className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(([title, text]) => (
            <div key={title} className="p-5">
              <h3 className="font-semibold text-sm mb-1">{title}</h3>
              <p className="text-sm text-gray-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Démo live */}
      <section id="demo" className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-center mb-2">
            Jouez le prospect, jugez sur pièce
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Remplissez le formulaire comme le ferait un de vos leads : l&apos;agent
            vous répond par email en moins d&apos;une minute. Répondez-lui, et
            vivez la qualification côté prospect.
          </p>
          {demoClientId ? (
            <DemoForm clientId={demoClientId} />
          ) : (
            <p className="text-sm text-gray-400 text-center">
              Démo momentanément indisponible.
            </p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 pb-4">
        Lead Agent — plus de rendez-vous qualifiés, sans effort.
      </footer>
    </div>
  )
}
