import { revalidatePath } from 'next/cache';

import { getCurrentAccount, requireRole } from '@/lib/auth/account';
import { hasMinRole } from '@/lib/auth/roles';
import type { AccountProduct } from '@/lib/knowledge/types';
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

async function createProduct(formData: FormData) {
  'use server';

  const ctx = await requireRole('agent');
  const name = textField(formData, 'name');
  if (!name) throw new Error('Product/service name is required');

  const { count, error: countError } = await ctx.supabase
    .from('account_products')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', ctx.accountId);
  if (countError) throw countError;

  const { data: account, error: accountError } = await ctx.supabase
    .from('accounts')
    .select('product_limit')
    .eq('id', ctx.accountId)
    .single();
  if (accountError) throw accountError;

  if ((count ?? 0) >= account.product_limit) {
    throw new Error('You have reached your product limit for this package.');
  }

  const { error } = await ctx.supabase.from('account_products').insert({
    account_id: ctx.accountId,
    name,
    price_text: textField(formData, 'price_text'),
    description: textField(formData, 'description'),
    availability_text: textField(formData, 'availability_text'),
    category: textField(formData, 'category'),
    is_active: formData.get('is_active') === 'on',
  });

  if (error) throw error;

  revalidatePath('/products');
  revalidatePath('/ai-test');
}

async function updateProduct(formData: FormData) {
  'use server';

  const ctx = await requireRole('agent');
  const id = textField(formData, 'id');
  const name = textField(formData, 'name');
  if (!id) throw new Error('Missing product id');
  if (!name) throw new Error('Product/service name is required');

  const { error } = await ctx.supabase
    .from('account_products')
    .update({
      name,
      price_text: textField(formData, 'price_text'),
      description: textField(formData, 'description'),
      availability_text: textField(formData, 'availability_text'),
      category: textField(formData, 'category'),
      is_active: formData.get('is_active') === 'on',
    })
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) throw error;

  revalidatePath('/products');
  revalidatePath('/ai-test');
}

async function deleteProduct(formData: FormData) {
  'use server';

  const ctx = await requireRole('agent');
  const id = textField(formData, 'id');
  if (!id) throw new Error('Missing product id');

  const { error } = await ctx.supabase
    .from('account_products')
    .delete()
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) throw error;

  revalidatePath('/products');
  revalidatePath('/ai-test');
}

export default async function ProductsPage() {
  const ctx = await getCurrentAccount();
  const canEdit = hasMinRole(ctx.role, 'agent');

  const [productsResult, accountResult, countResult] = await Promise.all([
    ctx.supabase
      .from('account_products')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false }),
    ctx.supabase
      .from('accounts')
      .select('package_type, product_limit')
      .eq('id', ctx.accountId)
      .single(),
    ctx.supabase
      .from('account_products')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', ctx.accountId),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (accountResult.error) throw accountResult.error;
  if (countResult.error) throw countResult.error;

  const products = (productsResult.data ?? []) as AccountProduct[];
  const productCount = countResult.count ?? products.length;
  const productLimit = accountResult.data.product_limit;
  const limitReached = productCount >= productLimit;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products & Services</h1>
          <p className="mt-1 text-sm text-slate-400">
            Add the items the chatbot can answer questions about.
          </p>
        </div>
        <Badge variant={limitReached ? 'destructive' : 'secondary'}>
          {productCount} / {productLimit} products
        </Badge>
      </div>

      {limitReached && (
        <Card className="border border-slate-800 bg-slate-900">
          <CardContent className="pt-4 text-sm text-slate-300">
            You have reached your product limit for this package. Update or
            remove existing products, or ask the SaaS admin to increase your
            limit.
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card className="border border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle>Add Product or Service</CardTitle>
            <CardDescription>
              Starter businesses can still edit products; the package controls
              only the product count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createProduct} className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                  Name
                  <Input name="name" disabled={limitReached} required />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                  Price
                  <Input
                    name="price_text"
                    disabled={limitReached}
                    placeholder="P1199, from P250..."
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                  Category
                  <Input
                    name="category"
                    disabled={limitReached}
                    placeholder="Projectors, repairs..."
                  />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                  Availability
                  <Input
                    name="availability_text"
                    disabled={limitReached}
                    placeholder="In stock, pre-order, limited..."
                  />
                </label>
                <label className="flex items-center gap-2 pt-7 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked
                    disabled={limitReached}
                  />
                  Active in chatbot
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
                Description
                <Textarea name="description" disabled={limitReached} rows={3} />
              </label>
              <Button type="submit" className="w-fit" disabled={limitReached}>
                Add product/service
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Active rows are included in the AI test prompt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product/service</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} className="align-top">
                  <TableCell className="min-w-80 whitespace-normal">
                    <form
                      id={`product-${product.id}`}
                      action={updateProduct}
                      className="flex flex-col gap-3"
                    >
                      <input type="hidden" name="id" value={product.id} />
                      <Input name="name" defaultValue={product.name} required />
                      <Input
                        name="category"
                        defaultValue={product.category ?? ''}
                        placeholder="Category"
                      />
                      <Textarea
                        name="description"
                        defaultValue={product.description ?? ''}
                        rows={3}
                        placeholder="Description"
                      />
                    </form>
                  </TableCell>
                  <TableCell>
                    <Input
                      form={`product-${product.id}`}
                      name="price_text"
                      defaultValue={product.price_text ?? ''}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      form={`product-${product.id}`}
                      name="availability_text"
                      defaultValue={product.availability_text ?? ''}
                    />
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        form={`product-${product.id}`}
                        type="checkbox"
                        name="is_active"
                        defaultChecked={product.is_active}
                      />
                      {product.is_active ? 'Active' : 'Inactive'}
                    </label>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Button
                          form={`product-${product.id}`}
                          type="submit"
                          size="sm"
                        >
                          Save
                        </Button>
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={product.id} />
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
          {products.length === 0 && (
            <p className="pt-4 text-sm text-slate-400">
              No products or services added yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
