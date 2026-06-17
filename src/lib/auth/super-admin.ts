import { createClient as createAdminClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

export class SuperAdminForbiddenError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'SuperAdminForbiddenError';
  }
}

function parseCsvEnv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

function configuredSuperAdminEmails(): Set<string> {
  return parseCsvEnv(process.env.SUPER_ADMIN_EMAILS);
}

export async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    throw new SuperAdminForbiddenError();
  }

  const allowedEmails = configuredSuperAdminEmails();
  if (!allowedEmails.has(user.email.toLowerCase())) {
    throw new SuperAdminForbiddenError();
  }

  return { user };
}

export function createSuperAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
