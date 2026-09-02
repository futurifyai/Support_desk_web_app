import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminUserProductsQueryKey,
  getGetAdminUsersQueryKey,
  getGetDistinctProductNamesQueryKey,
  useCreateAdminUser,
  useCreateAdminUserProduct,
  useDeleteAdminUserProduct,
  useGetAdminUserProducts,
  useGetAdminUsers,
  useGetDistinctProductNames,
  useUpdateAdminUserProduct,
  type AdminUser,
  type UserProduct,
} from '@workspace/api-client-react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value?: string | null) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function isValidDateRange(startDate: string, endDate: string) {
  return !startDate || !endDate || endDate > startDate;
}

function statusLabel(status: UserProduct['status']) {
  return status[0].toUpperCase() + status.slice(1);
}

function statusClass(status: UserProduct['status']) {
  if (status === 'approved') return 'bg-accent text-accent-foreground';
  if (status === 'disapproved') return 'bg-[#ffe0d8] text-[#9a3f2d]';
  if (status === 'expired') return 'bg-muted text-muted-foreground';
  return 'bg-[#fff1c9] text-[#866a21]';
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-xs font-bold">{children}</span>;
}

function AccessStatus({ status }: { status: UserProduct['status'] }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

function ProductAccessPanel({ user, expanded, productNames }: { user: AdminUser; expanded: boolean; productNames: string[] }) {
  const queryClient = useQueryClient();
  const products = useGetAdminUserProducts(user.id, { query: { queryKey: getGetAdminUserProductsQueryKey(user.id), enabled: expanded } });
  const addProduct = useCreateAdminUserProduct();
  const updateProduct = useUpdateAdminUserProduct();
  const deleteProduct = useDeleteAdminUserProduct();
  const [productName, setProductName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editError, setEditError] = useState('');

  const invalidateProducts = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetAdminUserProductsQueryKey(user.id) });
    await queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetDistinctProductNamesQueryKey() });
  };

  const handleAddProduct = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (productName.trim().length < 2) {
      setError('Enter a product name of at least 2 characters.');
      return;
    }
    if (!isValidDateRange(startDate, endDate)) {
      setError('End date must be after the start date.');
      return;
    }
    try {
      await addProduct.mutateAsync({
        userId: user.id,
        data: {
          productName: productName.trim(),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        },
      });
      setProductName('');
      setStartDate('');
      setEndDate('');
      await invalidateProducts();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to add product access.'));
    }
  };

  const beginEdit = (product: UserProduct) => {
    setEditingProductId(product.id);
    setEditStartDate(dateInputValue(product.startDate));
    setEditEndDate(dateInputValue(product.endDate));
    setEditStatus(product.status === 'approved' || product.status === 'disapproved' ? product.status : '');
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingProductId(null);
    setEditStartDate('');
    setEditEndDate('');
    setEditStatus('');
    setEditError('');
  };

  const saveEdit = async (product: UserProduct) => {
    setEditError('');
    if (!isValidDateRange(editStartDate, editEndDate)) {
      setEditError('End date must be after the start date.');
      return;
    }
    try {
      await updateProduct.mutateAsync({
        userId: user.id,
        productId: product.id,
        data: {
          startDate: editStartDate || null,
          endDate: editEndDate || null,
          ...(editStatus === 'approved' || editStatus === 'disapproved' ? { status: editStatus } : {}),
        },
      });
      cancelEdit();
      await invalidateProducts();
    } catch (requestError) {
      setEditError(getErrorMessage(requestError, 'Unable to update product access.'));
    }
  };

  const removeProduct = async (product: UserProduct) => {
    if (!window.confirm(`Remove ${product.productName} access for ${user.name}?`)) return;
    setError('');
    try {
      await deleteProduct.mutateAsync({ userId: user.id, productId: product.id });
      await invalidateProducts();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to remove product access.'));
    }
  };

  const rows = products.data?.data ?? [];

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Product access</div>
          <p className="mt-1 text-xs text-muted-foreground">Grant, approve, edit, or remove this user&apos;s access windows.</p>
        </div>
        {products.isFetching && <RefreshCw size={15} className="animate-spin text-muted-foreground" />}
      </div>

      <form onSubmit={handleAddProduct} className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Plus size={16} className="text-primary" /> Add product access</div>
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
          <label>
            <FieldLabel>Product name</FieldLabel>
            <input list={`product-names-${user.id}`} value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Start typing a product" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            <datalist id={`product-names-${user.id}`}>{productNames.map((name) => <option value={name} key={name} />)}</datalist>
          </label>
          <label>
            <FieldLabel>Start date <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          </label>
          <label>
            <FieldLabel>End date <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          </label>
          <button type="submit" disabled={addProduct.isPending} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:brightness-95 disabled:opacity-50"><Plus size={15} /> {addProduct.isPending ? 'Adding…' : 'Add access'}</button>
        </div>
        {error && <p className="mt-3 text-xs font-semibold text-destructive">{error}</p>}
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <div className="hidden grid-cols-[1.3fr_1fr_140px_120px] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground md:grid">
          <span>Product</span><span>Access period</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        {products.isLoading ? <div className="space-y-2 p-4"><div className="skeleton h-14 rounded-md" /><div className="skeleton h-14 rounded-md" /></div>
          : products.error ? <div className="p-5 text-sm text-destructive">{getErrorMessage(products.error, 'Unable to load product access.')}</div>
          : rows.length === 0 ? <div className="p-7 text-center text-sm text-muted-foreground">No product access has been granted yet.</div>
          : rows.map((product) => {
            const editing = editingProductId === product.id;
            return <div key={product.id} className="border-b border-border p-4 last:border-b-0">
              {!editing ? <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_140px_120px] md:items-center">
                <div><div className="text-sm font-bold">{product.productName}</div><div className="mt-1 text-[11px] text-muted-foreground">Created {formatDate(product.createdAt)}</div></div>
                <div className="text-xs text-muted-foreground">{formatDate(product.startDate)} <span className="px-1 text-border">→</span> {formatDate(product.endDate)}</div>
                <div><AccessStatus status={product.status} /></div>
                <div className="flex justify-start gap-1 md:justify-end"><button type="button" onClick={() => beginEdit(product)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={13} /> Edit</button><button type="button" onClick={() => void removeProduct(product)} disabled={deleteProduct.isPending} className="rounded-md p-2 text-muted-foreground hover:bg-[#ffe0d8] hover:text-destructive disabled:opacity-50" aria-label={`Remove ${product.productName} access`}><Trash2 size={14} /></button></div>
              </div> : <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="mb-3 flex items-center justify-between"><div className="text-sm font-bold">Edit {product.productName}</div><button type="button" onClick={cancelEdit} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Cancel editing"><X size={15} /></button></div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label><FieldLabel>Start date</FieldLabel><input type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>
                  <label><FieldLabel>End date</FieldLabel><input type="date" value={editEndDate} onChange={(event) => setEditEndDate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>
                  <label><FieldLabel>Approval status</FieldLabel><select value={editStatus} onChange={(event) => setEditStatus(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"><option value="">Keep current ({statusLabel(product.status)})</option><option value="approved">Approved</option><option value="disapproved">Disapproved</option></select></label>
                </div>
                {editError && <p className="mt-3 text-xs font-semibold text-destructive">{editError}</p>}
                <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={cancelEdit} className="rounded-md px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">Cancel</button><button type="button" onClick={() => void saveEdit(product)} disabled={updateProduct.isPending} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:brightness-95 disabled:opacity-50"><Check size={14} /> {updateProduct.isPending ? 'Saving…' : 'Save changes'}</button></div>
              </div>}
            </div>;
          })}
      </div>
    </div>
  );
}

export default function AccessControlPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createError, setCreateError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const createUser = useCreateAdminUser();
  const usersQuery = useGetAdminUsers({ search: search.trim() || undefined, page, pageSize: 20 });
  const productNamesQuery = useGetDistinctProductNames();
  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;
  const productNames = productNamesQuery.data?.data ?? [];
  const pageLabel = useMemo(() => meta ? `Page ${meta.page} of ${Math.max(meta.totalPages, 1)}` : '', [meta]);

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError('');
    setCreatedCredentials(null);
    if (name.trim().length < 2 || !email.includes('@') || password.length < 8) {
      setCreateError('Enter a name, a valid email, and a password with at least 8 characters.');
      return;
    }
    try {
      const result = await createUser.mutateAsync({ data: { name: name.trim(), email: email.trim(), password } });
      setCreatedCredentials({ email: result.data.user.email, password: result.data.temporaryPassword });
      setName('');
      setEmail('');
      setPassword('');
      await queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
    } catch (requestError) {
      setCreateError(getErrorMessage(requestError, 'Unable to create the user.'));
    }
  };

  const copyCredentials = async () => {
    if (!createdCredentials || !navigator.clipboard) return;
    await navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`);
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mono mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary">Workspace / administration</div><h1 className="text-3xl font-bold tracking-[-.04em]">Access control</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create customer accounts and manage the products they can access.</p></div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><KeyRound size={15} className="text-primary" /> Admin only</div>
    </div>

    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <section className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3"><span className="rounded-lg bg-primary/15 p-2.5 text-primary"><UserPlus size={18} /></span><div><h2 className="font-bold">Create user</h2><p className="mt-1 text-xs text-muted-foreground">Give a customer their workspace login.</p></div></div>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <label><FieldLabel>Full name</FieldLabel><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Priya Sharma" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>
          <label><FieldLabel>Work email</FieldLabel><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@company.com" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>
          <label><FieldLabel>Temporary password</FieldLabel><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /><span className="mt-2 block text-[11px] text-muted-foreground">The user can change this later in Settings.</span></label>
          {createError && <div className="rounded-md border border-[#efc2bb] bg-[#fff4f1] p-3 text-xs font-semibold text-destructive">{createError}</div>}
          <button type="submit" disabled={createUser.isPending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-95 disabled:opacity-50"><UserPlus size={16} /> {createUser.isPending ? 'Creating…' : 'Create account'}</button>
        </form>
        {createdCredentials && <div className="mt-5 rounded-lg border border-accent bg-accent/40 p-4"><div className="flex items-center justify-between gap-3"><div className="text-xs font-bold text-accent-foreground">Account created</div><button type="button" onClick={() => void copyCredentials()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-accent-foreground hover:bg-accent" title="Copy credentials"><Clipboard size={13} /> Copy</button></div><p className="mt-2 text-xs text-accent-foreground">Share these credentials securely with the customer.</p><div className="mt-3 space-y-1 font-mono text-[11px] text-accent-foreground"><div className="break-all">Email: {createdCredentials.email}</div><div>Password: {createdCredentials.password}</div></div></div>}
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Users and product access</h2><p className="mt-1 text-xs text-muted-foreground">{meta?.total ?? 0} accounts · Expand a user to manage their grants.</p></div><div className="relative w-full sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name or email" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />{search && <button type="button" onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search"><X size={14} /></button>}</div></div>
        {usersQuery.isLoading ? <div className="space-y-3 p-5"><div className="skeleton h-16 rounded-lg" /><div className="skeleton h-16 rounded-lg" /><div className="skeleton h-16 rounded-lg" /></div>
          : usersQuery.error ? <div className="p-8 text-center"><p className="font-semibold">We could not load users.</p><p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(usersQuery.error, 'The service is unavailable right now.')}</p><button type="button" onClick={() => void usersQuery.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-bold"><RefreshCw size={14} /> Try again</button></div>
          : users.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No users match this search.</div>
          : <div className="divide-y divide-border">{users.map((user) => { const expanded = expandedUserId === user.id; return <div key={user.id}><button type="button" aria-expanded={expanded} onClick={() => setExpandedUserId(expanded ? null : user.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1c2b3] text-xs font-bold text-[#873c32]">{user.name[0]?.toUpperCase() ?? 'U'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{user.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{user.email}</span></span><span className="hidden rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground sm:inline-flex">{user.role}</span>{expanded ? <ChevronUp size={17} className="text-muted-foreground" /> : <ChevronDown size={17} className="text-muted-foreground" />}</button><ProductAccessPanel user={user} expanded={expanded} productNames={productNames} /></div>; })}</div>}
        {meta && meta.totalPages > 1 && <div className="flex items-center justify-between border-t border-border px-5 py-4"><span className="text-xs text-muted-foreground">{pageLabel}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || usersQuery.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50">Previous</button><button type="button" disabled={page >= meta.totalPages || usersQuery.isFetching} onClick={() => setPage((value) => value + 1)} className="rounded-md bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50">Next</button></div></div>}
      </section>
    </div>
  </div>;
}