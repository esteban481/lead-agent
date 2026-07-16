import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Lead Agent — Confidentialité et mentions légales',
  description: 'Politique de confidentialité et mentions légales de Lead Agent.',
}

// Page publique (hors matcher du middleware).
export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Confidentialité &amp; mentions légales
        </h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : juillet 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Politique de confidentialité
        </h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
          <p>
            <strong className="text-slate-900">Quelles données collectons-nous ?</strong>{' '}
            Lorsque vous remplissez un formulaire connecté à Lead Agent (y compris le
            formulaire de démonstration de ce site), nous collectons les informations que
            vous saisissez : nom, adresse email, téléphone le cas échéant, et le contenu
            de votre message. Les échanges par email qui suivent sont également conservés
            afin d&apos;assurer le suivi de votre demande.
          </p>
          <p>
            <strong className="text-slate-900">Pour quoi faire ?</strong> Uniquement pour
            traiter votre demande : y répondre, poser les questions de qualification
            nécessaires, et le cas échéant vous proposer un rendez-vous. Vos données ne
            sont ni vendues, ni louées, ni utilisées à d&apos;autres fins.
          </p>
          <p>
            <strong className="text-slate-900">Qui y a accès ?</strong> L&apos;entreprise
            auprès de laquelle vous avez déposé votre demande, et nos sous-traitants
            techniques strictement nécessaires au service : hébergement (Vercel), base de
            données (Supabase), envoi d&apos;emails (Resend) et traitement du langage
            (Anthropic). Aucun de ces prestataires n&apos;utilise vos données pour son
            propre compte.
          </p>
          <p>
            <strong className="text-slate-900">Ne plus être contacté.</strong> À tout
            moment, répondez simplement <strong className="text-slate-900">STOP</strong> à
            l&apos;un de nos emails : vous ne recevrez plus aucun message, définitivement.
            Chaque email automatique le rappelle en pied de page.
          </p>
          <p>
            <strong className="text-slate-900">Vos droits.</strong> Conformément au RGPD,
            vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement
            et d&apos;opposition sur vos données. Pour l&apos;exercer, écrivez à{' '}
            <a href="mailto:leads@leadqualifie.fr" className="text-indigo-600 underline">
              leads@leadqualifie.fr
            </a>
            . Vous pouvez également saisir la CNIL (cnil.fr).
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Mentions légales
        </h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
          <p>
            <strong className="text-slate-900">Éditeur du site :</strong>{' '}
            <em>[À compléter : nom / raison sociale, adresse, SIREN]</em>
          </p>
          <p>
            <strong className="text-slate-900">Contact :</strong>{' '}
            <a href="mailto:leads@leadqualifie.fr" className="text-indigo-600 underline">
              leads@leadqualifie.fr
            </a>
          </p>
          <p>
            <strong className="text-slate-900">Hébergement :</strong> Vercel Inc., 340 S
            Lemon Ave #4133, Walnut, CA 91789, États-Unis.
          </p>
        </div>
      </section>

      <div>
        <Link href="/demo" className="text-sm text-slate-500 hover:text-slate-900">
          ← Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  )
}
