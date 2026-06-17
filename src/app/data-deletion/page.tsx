export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Data Deletion</h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated: 17 June 2026
          </p>
        </div>

        <p className="text-slate-300">
          Businesses and customers can request deletion of personal data linked
          to WhatsApp conversations handled by this SaaS.
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">How to Request Deletion</h2>
          <p className="text-slate-300">
            Send a deletion request to the SaaS operator with the business name,
            WhatsApp phone number, and a short description of the data to
            delete. The operator will verify the request before removing data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">What Can Be Deleted</h2>
          <p className="text-slate-300">
            Deletable records may include customer contact records, conversation
            messages, lead metadata, notes, and imported business knowledge that
            contains personal information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Retention Notes</h2>
          <p className="text-slate-300">
            Some operational logs, backups, or legal records may be retained for
            a limited period where required for security, troubleshooting, or
            legal compliance.
          </p>
        </section>
      </div>
    </main>
  );
}
