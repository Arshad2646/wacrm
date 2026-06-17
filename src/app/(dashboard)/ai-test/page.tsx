import { getCurrentAccount } from '@/lib/auth/account';
import { generateBusinessScopedPreviewReply } from '@/lib/ai/chatbot';
import { buildBusinessScopedPrompt } from '@/lib/ai/prompt';
import { loadBusinessKnowledge } from '@/lib/knowledge/load';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type SearchParams = Promise<{
  message?: string | string[];
}>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AiTestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getCurrentAccount();
  const params = await searchParams;
  const message = firstParam(params.message).trim();

  const bundle = await loadBusinessKnowledge(ctx.supabase, ctx.accountId);
  const promptPreview = message
    ? buildBusinessScopedPrompt(bundle, message)
    : null;

  let result:
    | { ok: true; provider: string; model: string; text: string }
    | { ok: false; error: string }
    | null = null;

  if (message) {
    try {
      const response = await generateBusinessScopedPreviewReply({
        supabase: ctx.supabase,
        accountId: ctx.accountId,
        customerMessage: message,
      });
      result = {
        ok: true,
        provider: response.provider,
        model: response.model,
        text: response.text,
      };
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : 'AI test failed',
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Test</h1>
        <p className="mt-1 text-sm text-slate-400">
          Test the selected AI provider using only this account&apos;s active
          business info, products, and FAQs. Nothing is sent to WhatsApp.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle>Sample Customer Message</CardTitle>
            <CardDescription>
              Try pricing, stock, delivery, opening hours, or a mixed question.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="GET" className="flex flex-col gap-4">
              <Textarea
                name="message"
                rows={6}
                defaultValue={message}
                placeholder="How much is the projector and also what is the capital of France?"
                required
              />
              <Button type="submit" className="w-fit">
                Test AI reply
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle>Knowledge Loaded</CardTitle>
            <CardDescription>
              These active items are used for this test prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-300">
            <div>
              <span className="text-slate-400">Business:</span>{' '}
              {bundle.account.name}
            </div>
            <div>
              <span className="text-slate-400">Bot enabled:</span>{' '}
              {bundle.account.bot_enabled ? 'Yes' : 'No'}
            </div>
            <div>
              <span className="text-slate-400">Products/services:</span>{' '}
              {bundle.activeProducts.length}
            </div>
            <div>
              <span className="text-slate-400">FAQs/knowledge:</span>{' '}
              {bundle.activeKnowledgeEntries.length}
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{bundle.account.package_type}</Badge>
              {bundle.account.full_leads_enabled ? (
                <Badge>Full Leads</Badge>
              ) : (
                <Badge variant="outline">Lead Lite</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle>AI Reply</CardTitle>
            {result.ok && (
              <CardDescription>
                Provider: {result.provider} / {result.model}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {result.ok ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm whitespace-pre-wrap text-slate-100">
                {result.text}
              </div>
            ) : (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
                {result.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {promptPreview && (
        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle>Prompt Preview</CardTitle>
            <CardDescription>
              Server-side prompt built from this account&apos;s knowledge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
              {promptPreview.system}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
