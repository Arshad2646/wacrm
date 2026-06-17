export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated: 17 June 2026
          </p>
        </div>

        <p className="text-slate-300">
          These terms cover use of the WhatsApp AI chatbot SaaS MVP. The service
          is intended for small businesses that want to manage WhatsApp
          enquiries, products, FAQs, conversations, and leads from one shared
          dashboard.
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Business Responsibility</h2>
          <p className="text-slate-300">
            Each business is responsible for the accuracy of its products,
            prices, availability, opening hours, delivery information, payment
            instructions, and FAQ content.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">WhatsApp and AI Providers</h2>
          <p className="text-slate-300">
            The service depends on Meta WhatsApp Cloud API and the configured AI
            provider. Their availability, policies, and rate limits may affect
            chatbot delivery.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Acceptable Use</h2>
          <p className="text-slate-300">
            Businesses must not use the service for unlawful, deceptive,
            abusive, or spam messaging. The chatbot should be configured to
            answer only business-related enquiries.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">MVP Status</h2>
          <p className="text-slate-300">
            Billing and self-serve Meta Embedded Signup are not included in this
            MVP. Accounts and packages are configured manually by the SaaS
            operator.
          </p>
        </section>
      </div>
    </main>
  );
}
