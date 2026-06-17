'use client';

import { useMemo, useRef, useState } from 'react';
import { Bot, Loader2, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ChatRole = 'customer' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

interface AiChatTesterProps {
  businessName: string;
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AiChatTester({ businessName }: AiChatTesterProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const apiMessages = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages]
  );

  async function sendMessage() {
    const text = draft.trim();
    if (!text || loading) return;

    const customerMessage: ChatMessage = {
      id: newId('customer'),
      role: 'customer',
      content: text,
    };
    const nextMessages = [...apiMessages, customerMessage];

    setMessages((prev) => [...prev, customerMessage]);
    setDraft('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai-test/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        reply?: string;
        provider?: string;
        model?: string;
        systemPrompt?: string;
        error?: string;
      };

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId('assistant'),
          role: 'assistant',
          content: payload.reply ?? '',
        },
      ]);
      setProviderLabel(
        [payload.provider, payload.model].filter(Boolean).join(' / ')
      );
      setSystemPrompt(payload.systemPrompt ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI chat test failed';
      toast.error(message);
      setMessages((prev) => [
        ...prev,
        {
          id: newId('assistant-error'),
          role: 'assistant',
          content: `Test error: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
      <section className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-white">
                  {businessName} bot test
                </h2>
                <p className="truncate text-xs text-slate-400">
                  Local simulator. Nothing is sent to WhatsApp.
                </p>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([]);
              setProviderLabel(null);
              setSystemPrompt(null);
              setDraft('');
            }}
            disabled={loading && messages.length === 0}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-950 bg-[url('/inbox-doodle.svg')] bg-repeat px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-96 items-center justify-center">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                  <Send className="size-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-300">
                  Start a test chat
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ask about prices, delivery, availability, opening hours, or
                  send a mixed unrelated question to test refusal behavior.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) => {
                const isCustomer = message.role === 'customer';
                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      isCustomer ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[82%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                        isCustomer
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : message.content.startsWith('Test error:')
                            ? 'border-destructive/30 bg-destructive/10 text-destructive border'
                            : 'rounded-bl-sm border border-slate-800 bg-slate-900 text-slate-100'
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-lg rounded-bl-sm border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                    <Loader2 className="size-3.5 animate-spin" />
                    Bot is typing
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
          className="border-t border-slate-800 bg-slate-900 p-3"
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              placeholder="Type a customer WhatsApp message..."
              disabled={loading}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon-lg"
              aria-label="Send test message"
              disabled={loading || draft.trim().length === 0}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </form>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-white">Current reply</h3>
          <p className="mt-1 text-xs text-slate-400">
            {providerLabel
              ? `Provider: ${providerLabel}`
              : 'Send a message to see provider/model details.'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-white">Prompt Preview</h3>
          {systemPrompt ? (
            <pre className="mt-3 max-h-[460px] overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-xs whitespace-pre-wrap text-slate-300">
              {systemPrompt}
            </pre>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              The business-scoped system prompt appears here after the first
              test reply.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
