import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth/account';
import type { BotTone, BusinessProfile } from '@/lib/knowledge/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const BOT_TONES: BotTone[] = ['friendly', 'professional', 'salesy'];

function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toneField(formData: FormData): BotTone {
  const value = formData.get('bot_tone');
  return BOT_TONES.includes(value as BotTone) ? (value as BotTone) : 'friendly';
}

async function saveBusinessProfile(formData: FormData) {
  'use server';

  const ctx = await requireRole('admin');
  const fallback =
    textField(formData, 'fallback_message') ||
    'Thank you for your message. Our team will get back to you shortly.';

  const { error } = await ctx.supabase.from('account_business_profiles').upsert(
    {
      account_id: ctx.accountId,
      business_description: textField(formData, 'business_description'),
      location: textField(formData, 'location'),
      opening_hours: textField(formData, 'opening_hours'),
      services_summary: textField(formData, 'services_summary'),
      delivery_info: textField(formData, 'delivery_info'),
      payment_info: textField(formData, 'payment_info'),
      order_instructions: textField(formData, 'order_instructions'),
      fallback_message: fallback,
      bot_tone: toneField(formData),
    },
    { onConflict: 'account_id' }
  );

  if (error) {
    console.error('[business-info] save failed:', error);
    throw new Error('Failed to save business info');
  }

  revalidatePath('/business-info');
  revalidatePath('/ai-test');
}

export default async function BusinessInfoPage() {
  const ctx = await requireRole('admin');
  const { data, error } = await ctx.supabase
    .from('account_business_profiles')
    .select('*')
    .eq('account_id', ctx.accountId)
    .maybeSingle();

  if (error) throw error;

  const profile = data as BusinessProfile | null;
  const formKey = profile?.updated_at ?? 'new-business-profile';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Business Info</h1>
        <p className="mt-1 text-sm text-slate-400">
          This information teaches the chatbot how to answer about your
          business.
        </p>
      </div>

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Chatbot Profile</CardTitle>
          <CardDescription>
            Keep this simple and factual. The AI will use it only for your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            key={formKey}
            action={saveBusinessProfile}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
              Business description
              <Textarea
                name="business_description"
                defaultValue={profile?.business_description ?? ''}
                rows={4}
                placeholder="What does your business sell or do?"
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                Location
                <Input
                  name="location"
                  defaultValue={profile?.location ?? ''}
                  placeholder="Gaborone, Main Mall..."
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                Opening hours
                <Input
                  name="opening_hours"
                  defaultValue={profile?.opening_hours ?? ''}
                  placeholder="Mon-Sat 8:00-18:00"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
              Services summary
              <Textarea
                name="services_summary"
                defaultValue={profile?.services_summary ?? ''}
                rows={3}
                placeholder="Repairs, installations, consultations..."
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                Delivery info
                <Textarea
                  name="delivery_info"
                  defaultValue={profile?.delivery_info ?? ''}
                  rows={3}
                  placeholder="Delivery areas, fees, timing..."
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                Payment info
                <Textarea
                  name="payment_info"
                  defaultValue={profile?.payment_info ?? ''}
                  rows={3}
                  placeholder="Cash, bank transfer, mobile money..."
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
              Order instructions
              <Textarea
                name="order_instructions"
                defaultValue={profile?.order_instructions ?? ''}
                rows={3}
                placeholder="How customers should order or confirm availability."
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                Fallback message
                <Textarea
                  name="fallback_message"
                  defaultValue={profile?.fallback_message ?? ''}
                  rows={3}
                  placeholder="Thank you for your message. Our team will get back to you shortly."
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                Bot tone
                <select
                  name="bot_tone"
                  defaultValue={profile?.bot_tone ?? 'friendly'}
                  className="focus:border-primary h-8 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none"
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="salesy">Salesy</option>
                </select>
              </label>
            </div>

            <Button type="submit" className="w-fit">
              Save business info
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
