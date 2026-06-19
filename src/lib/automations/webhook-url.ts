import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

type LookupAddress = {
  address: string;
  family?: number;
};

function normalizedHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function configuredAllowedHosts(): string[] {
  return (process.env.AUTOMATION_WEBHOOK_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => normalizedHostname(host))
    .filter(Boolean);
}

function hostMatchesPattern(hostname: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return hostname !== suffix && hostname.endsWith(`.${suffix}`);
  }

  return hostname === pattern;
}

function hostIsAllowedByConfig(hostname: string): boolean {
  const allowedHosts = configuredAllowedHosts();
  if (allowedHosts.length === 0) return true;
  return allowedHosts.some((pattern) => hostMatchesPattern(hostname, pattern));
}

function parseIPv4(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const parsed = parts.map((part) => Number(part));
  if (
    parsed.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return parsed;
}

function isPrivateIPv4(address: string): boolean {
  const parts = parseIPv4(address);
  if (!parts) return true;
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  ) {
    return true;
  }

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return false;
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

export function validateAutomationWebhookUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'webhook URL is required';
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'webhook URL is not a valid URL';
  }

  if (url.protocol !== 'https:') {
    return 'webhook URL must use https';
  }

  if (url.username || url.password) {
    return 'webhook URL must not include credentials';
  }

  const hostname = normalizedHostname(url.hostname);
  if (
    PRIVATE_HOSTS.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    (isIP(hostname) !== 0 && isPrivateAddress(hostname))
  ) {
    return 'webhook URL must use a public hostname';
  }

  if (!hostIsAllowedByConfig(hostname)) {
    return 'webhook URL host is not allowed';
  }

  return null;
}

export async function assertSafeAutomationWebhookUrl(
  value: string
): Promise<URL> {
  const validationError = validateAutomationWebhookUrl(value);
  if (validationError) throw new Error(validationError);

  const url = new URL(value);
  const hostname = normalizedHostname(url.hostname);
  const addresses: LookupAddress[] = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });

  if (
    addresses.length === 0 ||
    addresses.some((address) => isPrivateAddress(address.address))
  ) {
    throw new Error('webhook URL resolves to a private or local address');
  }

  return url;
}
