import { NextResponse } from 'next/server';

import { isConfiguredSuperAdminEmail } from '@/lib/auth/super-admin';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    isSuperAdmin: isConfiguredSuperAdminEmail(user?.email),
  });
}
