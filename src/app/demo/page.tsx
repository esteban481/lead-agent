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

const STATS = [
  ['< 1 min', 'première réponse au lead'],
  ['24/7', 'y compris la nuit et le week-end'],
  ['A → D', 'chaque lead scoré sur vos critères'],
]

function Check() {
  return (
    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-50 ring-1 ring-inset ring-indigo-100">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2.5 6.5L5 9l4.5-6" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

// Page publique : vitrine de l'offre + démo live branchée sur le client démo.
export default function DemoPage() {
  const demoClientId = process.env.DEMO_CLIENT_ID

  return (
    <div className="relative space-y-20 py-6 sm:space-y-24">
      {/* Halos décoratifs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 -z-10 overflow-hidden">
        <div className="mx-auto h-[420px] max-w-4xl bg-[radial-gradient(closest-side,rgba(99,102,241,0.14),transparent)]" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-3xl space-y-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-medium text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          Agent IA de qualification de leads
        </span>
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
          Transformez vos leads entrants en{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
            rendez-vous qualifiés
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
          Un agent IA qui répond à vos leads en moins d&apos;une minute, pose vos
          questions de qualification par email, et ne remplit votre agenda
          qu&apos;avec des prospects sérieux.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <a
            href="#demo"
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            Tester la démo en direct
          </a>
          <a
            href="#comment"
            className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Comment ça marche
          </a>
        </div>

        {/* Bandeau chiffres */}
        <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-1 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STATS.map(([value, label]) => (
            <div key={value} className="px-6 py-5">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Comment ça marche */}
      <section id="comment" className="mx-auto max-w-4xl scroll-mt-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Comment ça marche
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          De la demande entrante au rendez-vous, sans intervention humaine.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm shadow-indigo-600/30">
                {s.n}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Points forts */}
      <section className="mx-auto max-w-4xl">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, text]) => (
            <div key={title} className="flex gap-3">
              <Check />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Démo live */}
      <section id="demo" className="mx-auto max-w-xl scroll-mt-20">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-400 to-sky-400 p-[1.5px] shadow-xl shadow-indigo-500/10">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white p-8">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
              Jouez le prospect, jugez sur pièce
            </h2>
            <p className="mx-auto mt-2 mb-6 max-w-md text-center text-sm leading-relaxed text-slate-500">
              Remplissez le formulaire comme le ferait un de vos leads :
              l&apos;agent vous répond par email en moins d&apos;une minute.
              Répondez-lui, et vivez la qualification côté prospect.
            </p>
            {demoClientId ? (
              <DemoForm clientId={demoClientId} />
            ) : (
              <p className="text-center text-sm text-slate-400">
                Démo momentanément indisponible.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Bandeau final */}
      <section className="mx-auto max-w-4xl">
        <div className="rounded-3xl bg-slate-900 px-8 py-12 text-center shadow-xl">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Plus de rendez-vous qualifiés, sans effort.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
            Pendant que vos concurrents répondent demain matin, votre agent a
            déjà qualifié le lead et proposé un créneau.
          </p>
          <a
            href="#demo"
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Essayer maintenant
          </a>
        </div>
      </section>

      <footer className="pb-2 text-center text-xs text-slate-400">
        Lead Agent — plus de rendez-vous qualifiés, sans effort.
      </footer>
    </div>
  )
}
