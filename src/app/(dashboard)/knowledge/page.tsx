import { revalidatePath } from 'next/cache';

import { getCurrentAccount, requireRole } from '@/lib/auth/account';
import { hasMinRole } from '@/lib/auth/roles';
import type { KnowledgeEntry } from '@/lib/knowledge/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function createKnowledgeEntry(formData: FormData) {
  'use server';

  const ctx = await requireRole('agent');
  const title = textField(formData, 'title');
  const content = textField(formData, 'content');
  if (!title) throw new Error('Question/title is required');
  if (!content) throw new Error('Answer/content is required');

  const { error } = await ctx.supabase
    .from('account_knowledge_entries')
    .insert({
      account_id: ctx.accountId,
      title,
      content,
      category: textField(formData, 'category'),
      is_active: formData.get('is_active') === 'on',
    });

  if (error) throw error;

  revalidatePath('/knowledge');
  revalidatePath('/ai-test');
}

async function updateKnowledgeEntry(formData: FormData) {
  'use server';

  const ctx = await requireRole('agent');
  const id = textField(formData, 'id');
  const title = textField(formData, 'title');
  const content = textField(formData, 'content');
  if (!id) throw new Error('Missing knowledge entry id');
  if (!title) throw new Error('Question/title is required');
  if (!content) throw new Error('Answer/content is required');

  const { error } = await ctx.supabase
    .from('account_knowledge_entries')
    .update({
      title,
      content,
      category: textField(formData, 'category'),
      is_active: formData.get('is_active') === 'on',
    })
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) throw error;

  revalidatePath('/knowledge');
  revalidatePath('/ai-test');
}

async function deleteKnowledgeEntry(formData: FormData) {
  'use server';

  const ctx = await requireRole('agent');
  const id = textField(formData, 'id');
  if (!id) throw new Error('Missing knowledge entry id');

  const { error } = await ctx.supabase
    .from('account_knowledge_entries')
    .delete()
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) throw error;

  revalidatePath('/knowledge');
  revalidatePath('/ai-test');
}

export default async function KnowledgePage() {
  const ctx = await getCurrentAccount();
  const canEdit = hasMinRole(ctx.role, 'agent');

  const { data, error } = await ctx.supabase
    .from('account_knowledge_entries')
    .select('*')
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const entries = (data ?? []) as KnowledgeEntry[];
  const activeCount = entries.filter((entry) => entry.is_active).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">FAQs & Knowledge</h1>
          <p className="mt-1 text-sm text-slate-400">
            Add answers the chatbot can safely reuse for customer questions.
          </p>
        </div>
        <Badge variant="secondary">{activeCount} active entries</Badge>
      </div>

      {canEdit && (
        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle>Add FAQ or Knowledge Entry</CardTitle>
            <CardDescription>
              Use short, direct answers. The bot will not guess beyond these
              entries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createKnowledgeEntry} className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                  Question or title
                  <Input
                    name="title"
                    placeholder="Do you deliver in Gaborone?"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                  Category
                  <Input name="category" placeholder="Delivery, payment..." />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                Answer or content
                <Textarea name="content" rows={4} required />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" name="is_active" defaultChecked />
                Active in chatbot
              </label>
              <Button type="submit" className="w-fit">
                Add entry
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
          <CardDescription>
            Active rows are included in the AI test prompt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question / title</TableHead>
                <TableHead>Answer</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className="align-top">
                  <TableCell className="min-w-72 whitespace-normal">
                    <form
                      id={`knowledge-${entry.id}`}
                      action={updateKnowledgeEntry}
                      className="flex flex-col gap-3"
                    >
                      <input type="hidden" name="id" value={entry.id} />
                      <Input name="title" defaultValue={entry.title} required />
                      <Input
                        name="category"
                        defaultValue={entry.category ?? ''}
                        placeholder="Category"
                      />
                    </form>
                  </TableCell>
                  <TableCell className="min-w-96 whitespace-normal">
                    <Textarea
                      form={`knowledge-${entry.id}`}
                      name="content"
                      defaultValue={entry.content}
                      rows={4}
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        form={`knowledge-${entry.id}`}
                        type="checkbox"
                        name="is_active"
                        defaultChecked={entry.is_active}
                      />
                      {entry.is_active ? 'Active' : 'Inactive'}
                    </label>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Button
                          form={`knowledge-${entry.id}`}
                          type="submit"
                          size="sm"
                        >
                          Save
                        </Button>
                        <form action={deleteKnowledgeEntry}>
                          <input type="hidden" name="id" value={entry.id} />
                          <Button type="submit" variant="destructive" size="sm">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {entries.length === 0 && (
            <p className="pt-4 text-sm text-slate-400">
              No FAQs or knowledge entries added yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
