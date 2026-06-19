import { afterEach, describe, expect, it } from 'vitest';

import { validateAutomationWebhookUrl } from './webhook-url';

const originalAllowedHosts = process.env.AUTOMATION_WEBHOOK_ALLOWED_HOSTS;

afterEach(() => {
  if (originalAllowedHosts === undefined) {
    delete process.env.AUTOMATION_WEBHOOK_ALLOWED_HOSTS;
  } else {
    process.env.AUTOMATION_WEBHOOK_ALLOWED_HOSTS = originalAllowedHosts;
  }
});

describe('validateAutomationWebhookUrl', () => {
  it('accepts public HTTPS webhook URLs', () => {
    process.env.AUTOMATION_WEBHOOK_ALLOWED_HOSTS = '';

    expect(validateAutomationWebhookUrl('https://hooks.example.com/in')).toBe(
      null
    );
  });

  it('rejects non-HTTPS URLs and embedded credentials', () => {
    expect(validateAutomationWebhookUrl('http://hooks.example.com/in')).toBe(
      'webhook URL must use https'
    );
    expect(
      validateAutomationWebhookUrl('https://user:pass@hooks.example.com/in')
    ).toBe('webhook URL must not include credentials');
  });

  it('rejects local and private destinations before runtime fetch', () => {
    expect(validateAutomationWebhookUrl('https://localhost/in')).toBe(
      'webhook URL must use a public hostname'
    );
    expect(validateAutomationWebhookUrl('https://127.0.0.1/in')).toBe(
      'webhook URL must use a public hostname'
    );
    expect(validateAutomationWebhookUrl('https://10.0.0.5/in')).toBe(
      'webhook URL must use a public hostname'
    );
  });

  it('honors the optional host allowlist', () => {
    process.env.AUTOMATION_WEBHOOK_ALLOWED_HOSTS =
      'hooks.example.com,*.trusted.example';

    expect(validateAutomationWebhookUrl('https://hooks.example.com/in')).toBe(
      null
    );
    expect(
      validateAutomationWebhookUrl('https://team.trusted.example/in')
    ).toBe(null);
    expect(validateAutomationWebhookUrl('https://evil.example/in')).toBe(
      'webhook URL host is not allowed'
    );
  });
});
