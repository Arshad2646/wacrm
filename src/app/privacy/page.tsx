export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated: 17 June 2026
          </p>
        </div>

        <p className="text-slate-300">
          This WhatsApp AI chatbot SaaS helps small businesses respond to
          customer enquiries. We collect only the information needed to provide
          the service, operate WhatsApp messaging, support the business account,
          and improve reliability.
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Information We Process</h2>
          <p className="text-slate-300">
            We may process business account details, WhatsApp connection
            settings, customer messages sent to connected WhatsApp numbers,
            conversation history, product or FAQ content added by the business,
            lead metadata, and usage logs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">How We Use Information</h2>
          <p className="text-slate-300">
            Information is used to route WhatsApp messages, generate business
            scoped AI replies, show conversations and leads to the correct
            business, enforce package limits, troubleshoot errors, and provide
            support.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Data Sharing</h2>
          <p className="text-slate-300">
            Messages and related data may be sent to Meta WhatsApp Cloud API and
            the configured AI provider to deliver chatbot responses. We do not
            sell personal information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Data Requests</h2>
          <p className="text-slate-300">
            Businesses or their customers may request access, correction, or
            deletion by contacting the SaaS operator. See the data deletion page
            for deletion instructions.
          </p>
        </section>
      </div>
    </main>
  );
}
