import { getCurrentAccount } from '@/lib/auth/account';
import { loadBusinessKnowledge } from '@/lib/knowledge/load';
import { accountHasFullLeads } from '@/lib/saas/packages';
import { AiChatTester } from '@/components/ai-test/ai-chat-tester';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function AiTestPage() {
  const ctx = await getCurrentAccount();
  const bundle = await loadBusinessKnowledge(ctx.supabase, ctx.accountId);
  const fullLeads = accountHasFullLeads(bundle.account);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Test</h1>
        <p className="mt-1 text-sm text-slate-400">
          Test a WhatsApp-style conversation using only this account&apos;s
          active business info, products, and FAQs. Nothing is sent to WhatsApp.
        </p>
      </div>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Knowledge Loaded</CardTitle>
          <CardDescription>
            These active items are used for every reply in the chat simulator.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-300 sm:grid-cols-5">
          <div>
            <span className="text-slate-400">Business</span>
            <div className="mt-1 font-medium text-white">
              {bundle.account.name}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Bot enabled</span>
            <div className="mt-1 text-white">
              {bundle.account.bot_enabled ? 'Yes' : 'No'}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Products/services</span>
            <div className="mt-1 text-white">
              {bundle.activeProducts.length}
            </div>
          </div>
          <div>
            <span className="text-slate-400">FAQs/knowledge</span>
            <div className="mt-1 text-white">
              {bundle.activeKnowledgeEntries.length}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Badge variant="secondary">{bundle.account.package_type}</Badge>
            {fullLeads ? (
              <Badge>Full Leads</Badge>
            ) : (
              <Badge variant="outline">Lead Lite</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <AiChatTester businessName={bundle.account.name} />
    </div>
  );
}
