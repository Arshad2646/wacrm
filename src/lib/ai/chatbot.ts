import type { SupabaseClient } from '@supabase/supabase-js';

import { loadBusinessKnowledge } from '@/lib/knowledge/load';
import { buildBusinessScopedPrompt } from './prompt';
import { generateAiResponse, type AiResponse } from './provider';

export interface ChatbotPreviewResult extends AiResponse {
  systemPrompt: string;
}

export async function generateBusinessScopedPreviewReply({
  supabase,
  accountId,
  customerMessage,
}: {
  supabase: SupabaseClient;
  accountId: string;
  customerMessage: string;
}): Promise<ChatbotPreviewResult> {
  const message = customerMessage.trim();
  if (!message) throw new Error('Enter a customer message to test.');

  const bundle = await loadBusinessKnowledge(supabase, accountId);
  const prompt = buildBusinessScopedPrompt(bundle, message);
  const response = await generateAiResponse(prompt);

  return {
    ...response,
    systemPrompt: prompt.system,
  };
}
