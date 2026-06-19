import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function contactPhoneUpdateBlocks(fileSource: string) {
  const matches = fileSource.matchAll(
    /from\('contacts'\)[\s\S]{0,160}?update\(\{ phone: workingPhone \}\)[\s\S]{0,220}?\.eq\('account_id',/g
  );
  return Array.from(matches);
}

describe('service-role tenant guards', () => {
  it('keeps automation contact phone self-heal updates account-scoped', () => {
    const fileSource = source('src/lib/automations/meta-send.ts');

    expect(contactPhoneUpdateBlocks(fileSource)).toHaveLength(1);
  });

  it('keeps flow contact phone self-heal updates account-scoped', () => {
    const fileSource = source('src/lib/flows/meta-send.ts');

    expect(contactPhoneUpdateBlocks(fileSource)).toHaveLength(3);
  });
});

describe('sensitive media responses', () => {
  it('does not mark authenticated WhatsApp media as publicly cacheable', () => {
    const fileSource = source('src/app/api/whatsapp/media/[mediaId]/route.ts');

    expect(fileSource).toContain(
      "'Cache-Control': 'private, no-store, max-age=0'"
    );
    expect(fileSource).not.toContain("'Cache-Control': 'public");
  });
});

describe('WhatsApp webhook replay handling', () => {
  it('ignores duplicate inbound Meta message ids before side effects continue', () => {
    const fileSource = source('src/app/api/whatsapp/webhook/route.ts');

    expect(fileSource).toContain('isUniqueViolation(msgError)');
    expect(fileSource).toContain('duplicate inbound message ignored');
    expect(fileSource).toMatch(
      /if \(msgError\) \{[\s\S]*?isUniqueViolation\(msgError\)[\s\S]*?return;[\s\S]*?\}/
    );
  });
});

describe('AI usage reservation', () => {
  it('reserves quota before AI test provider calls and refunds provider failures', () => {
    const fileSource = source('src/app/api/ai-test/chat/route.ts');

    expect(fileSource).toContain('reserveAccountAiReply(');
    expect(fileSource).toContain('generateBusinessScopedChatReply({');
    expect(fileSource).toContain(
      "'AI usage check failed. Make sure the latest Supabase migrations are applied and the service role key is configured.'"
    );
    expect(fileSource.indexOf('reserveAccountAiReply(')).toBeLessThan(
      fileSource.indexOf('generateBusinessScopedChatReply({')
    );
    expect(fileSource).toContain('refundAccountAiReply(serviceRole');
  });

  it('reserves quota before inbound WhatsApp AI provider calls and refunds failed sends', () => {
    const fileSource = source('src/lib/ai/whatsapp-bot.ts');

    expect(fileSource).toContain(
      'const reservation = await reserveAccountAiReply('
    );
    expect(fileSource).toContain('generateAiResponse(prompt)');
    expect(
      fileSource.indexOf('const reservation = await reserveAccountAiReply(')
    ).toBeLessThan(fileSource.indexOf('generateAiResponse(prompt)'));
    expect(fileSource).toContain('refundAccountAiReply(');
  });
});
