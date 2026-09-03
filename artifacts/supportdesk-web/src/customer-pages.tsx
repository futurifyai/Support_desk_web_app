import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateTicket,
  useCreateUserTicketReply,
  useGetHelpArticles,
  useGetMyProducts,
  useGetSuggestedArticles,
  useGetTicketSatisfaction,
  useGetTickets,
  useGetUserTicketDetail,
  useRateTicket,
  useUpdateProfile,
  useUploadTicketAttachment,
  getGetTicketSatisfactionQueryKey,
  getGetSuggestedArticlesQueryKey,
  getGetTicketsQueryKey,
  getGetUserTicketDetailQueryKey,
  getGetProfileQueryKey,
} from '@workspace/api-client-react';
import type {
  GetTicketsParams,
  HelpArticle,
  TicketReply,
  UserProduct,
} from '@workspace/api-client-react';
import { Link, useLocation, useParams } from 'wouter';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileImage,
  Inbox,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

export type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
};

type AttachmentDraft = {
  fileName: string;
  mimeType: string;
  fileSize: number;
  base64Data: string;
};

const statusOptions = ['open', 'in-progress', 'resolved'] as const;
const priorityOptions = ['critical', 'high', 'medium', 'low'] as const;
const categoryOptions = ['general', 'bug', 'feature', 'billing', 'account', 'other'] as const;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function displayStatus(status?: string) {
  return status === 'in-progress' ? 'In progress' : status ? status[0].toUpperCase() + status.slice(1) : 'Unknown';
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'The service is unavailable right now.';
}

function initials(name = 'User') {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
}) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-95 shadow-sm',
    soft: 'bg-secondary text-secondary-foreground hover:bg-muted',
    ghost: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:brightness-95',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mono mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</div>
        <h1 className="text-[26px] font-bold tracking-[-.03em] sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function DataState({
  loading,
  error,
  empty,
  children,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  children: ReactNode;
  retry?: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((item) => <div className="skeleton h-[68px] rounded-lg" key={item} />)}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-[#efc2bb] bg-[#fff4f1] p-8 text-center">
        <AlertCircle className="mx-auto mb-3 text-destructive" size={24} />
        <p className="font-semibold">We could not load this view.</p>
        <p className="mt-1 text-sm text-muted-foreground">{errorText(error)}</p>
        {retry && <Button variant="soft" className="mt-4" onClick={retry}>Try again</Button>}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <Inbox className="mx-auto mb-3 text-muted-foreground" size={28} />
        <p className="font-semibold">Nothing here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">New activity will appear in this space.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function StatusBadge({ status }: { status?: string }) {
  const tone = status === 'resolved'
    ? 'bg-accent text-accent-foreground'
    : status === 'in-progress'
      ? 'bg-[#fff0cc] text-[#805b17]'
      : 'bg-[#ffe0d8] text-[#9a3f2d]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {displayStatus(status)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  const tone = priority === 'critical'
    ? 'text-destructive bg-[#f9d9d4]'
    : priority === 'high'
      ? 'text-[#ad5a28] bg-[#ffead4]'
      : priority === 'medium'
        ? 'text-[#866a21] bg-[#fff1c9]'
        : 'text-muted-foreground bg-muted';
  return <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${tone}`}>{priority || 'none'}</span>;
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-[128px] appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-xs font-semibold outline-none focus:border-primary disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option value={option} key={option}>{displayStatus(option)}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-muted-foreground" />
    </div>
  );
}

function fileToAttachment(file: File): Promise<AttachmentDraft> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Please choose an image file.'));
  if (file.size > MAX_ATTACHMENT_BYTES) return Promise.reject(new Error('Please choose an image under 5 MB.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64Data = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      resolve({ fileName: file.name, mimeType: file.type || 'image/jpeg', fileSize: file.size, base64Data });
    };
    reader.readAsDataURL(file);
  });
}

function AttachmentPicker({
  attachment,
  onChange,
  disabled,
}: {
  attachment: AttachmentDraft | null;
  onChange: (attachment: AttachmentDraft | null, error?: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      onChange(await fileToAttachment(file));
    } catch (error) {
      onChange(null, errorText(error));
    }
  };
  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={choose} />
      {attachment ? (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-[#fff4f1] px-3 py-2.5">
          <FileImage size={17} className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{attachment.fileName}</span>
          <span className="text-[10px] text-muted-foreground">{Math.ceil(attachment.fileSize / 1024)} KB</span>
          <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-muted-foreground hover:bg-white" aria-label="Remove attachment"><X size={15} /></button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/60 bg-primary/[.04] px-3 py-3 text-xs font-bold text-primary transition hover:bg-primary/[.08] disabled:opacity-50"
        >
          <Upload size={15} /> Attach an image
        </button>
      )}
      <p className="mt-1.5 text-[11px] text-muted-foreground">PNG, JPG, or GIF · maximum 5 MB</p>
    </div>
  );
}

function SuggestedArticles({ description, category }: { description: string; category: string }) {
  const enabled = description.trim().length >= 20;
  const suggestions = useGetSuggestedArticles(
    enabled ? { category: category as 'bug' | 'feature' | 'billing' | 'account' | 'other' } : undefined,
    { query: { enabled, queryKey: getGetSuggestedArticlesQueryKey(enabled ? { category: category as 'bug' | 'feature' | 'billing' | 'account' | 'other' } : undefined) } },
  );
  const articles = suggestions.data?.data?.slice(0, 3) || [];
  if (!enabled || !articles.length) return null;
  return (
    <div className="rounded-lg border border-primary/20 bg-[#fff8f4] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-primary"><MessageCircle size={15} /> Suggested answers</div>
      <div className="space-y-2">
        {articles.map((article) => (
          <Link href={`/help/${article.slug}`} key={article.id} className="block rounded-md border border-primary/10 bg-white/70 px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:text-primary">
            {article.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CustomerNewTicketPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const create = useCreateTicket();
  const upload = useUploadTicketAttachment();
  const productsQuery = useGetMyProducts();
  const products = (productsQuery.data?.data || []) as UserProduct[];
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('other');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!products.some((product) => product.productName === productName)) {
      setError('Choose one of your approved products before submitting.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }
    try {
      const result = await create.mutateAsync({
        data: {
          productName,
          description: description.trim(),
          category: category as 'bug' | 'feature' | 'billing' | 'account' | 'other',
          priority: priority as 'low' | 'medium' | 'high' | 'critical',
        },
      });
      if (attachment && result.data?.id) {
        try {
          await upload.mutateAsync({ ticketId: result.data.id, data: attachment });
        } catch {
          setNotice('Ticket created, but the image could not be uploaded. You can attach it from the ticket page.');
        }
      }
      await queryClient.invalidateQueries({ queryKey: getGetTicketsQueryKey() });
      setLocation(`/tickets/${result.data.id}`);
    } catch (submitError) {
      setError(errorText(submitError));
    }
  };

  return (
    <div className="mx-auto max-w-[850px]">
      <Link href="/tickets" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Back to tickets</Link>
      <PageHeader eyebrow="Customer support" title="Tell us what happened." description="Choose an approved product, add the details, and our team will respond shortly." />
      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-bold">Approved product <span className="text-primary">*</span></span>
            <select
              required
              value={productName}
              disabled={productsQuery.isLoading || productsQuery.isError || products.length === 0}
              onChange={(event) => setProductName(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">{productsQuery.isLoading ? 'Loading product access…' : productsQuery.isError ? 'Could not load products' : products.length ? 'Choose an approved product' : 'No approved products'}</option>
              {products.map((product) => <option value={product.productName} key={product.productName}>{product.productName}</option>)}
            </select>
            {productsQuery.isError && <button type="button" onClick={() => productsQuery.refetch()} className="mt-1 text-[11px] font-bold text-primary hover:underline">Try loading products again</button>}
            {!productsQuery.isLoading && !productsQuery.isError && !products.length && <p className="mt-1 text-[11px] text-muted-foreground">Contact your administrator to request product access.</p>}
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold">Category</span>
            <Select value={category} onChange={setCategory} options={categoryOptions.filter((item) => item !== 'general')} placeholder="Choose a category" />
          </label>
        </div>
        <div className="mt-5">
          <div className="mb-2 text-xs font-bold">Priority</div>
          <div className="flex flex-wrap gap-2">
            {priorityOptions.slice().reverse().map((value) => (
              <button type="button" key={value} onClick={() => setPriority(value)} className={`rounded-md border px-3 py-2 text-xs font-bold capitalize transition ${priority === value ? 'border-primary bg-[#fff0ea] text-primary' : 'border-border bg-background hover:border-primary/40'}`}>{value}</button>
            ))}
          </div>
        </div>
        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-bold">Issue description <span className="text-primary">*</span></span>
          <textarea required minLength={10} value={description} onChange={(event) => setDescription(event.target.value)} rows={8} placeholder="Include what you expected, what happened, and any steps to reproduce the issue." className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" />
        </label>
        <div className="mt-5">
          <div className="mb-2 text-xs font-bold">Attachment <span className="font-normal text-muted-foreground">(optional)</span></div>
          <AttachmentPicker attachment={attachment} onChange={(next, pickerError) => { setAttachment(next); setError(pickerError || ''); }} disabled={create.isPending || upload.isPending} />
        </div>
        <SuggestedArticles description={description} category={category} />
        {notice && <div className="mt-5 rounded-md border border-[#e7d1a1] bg-[#fff9e9] p-3 text-sm text-[#805b17]">{notice}</div>}
        {error && <div className="mt-5 rounded-md border border-[#efc2bb] bg-[#fff4f1] p-3 text-sm text-destructive">{error}</div>}
        <div className="mt-7 flex items-center justify-end gap-3">
          <Link href="/tickets" className="rounded-md px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted">Cancel</Link>
          <Button disabled={create.isPending || upload.isPending || productsQuery.isLoading || productsQuery.isError || !products.length}>
            {create.isPending || upload.isPending ? 'Submitting…' : 'Submit request'} <Send size={15} />
          </Button>
        </div>
      </form>
    </div>
  );
}

type SavedView = {
  id: string;
  name: string;
  filters: TicketHistoryFilters;
};

type TicketHistoryFilters = {
  search: string;
  status: string;
  priority: string;
  category: string;
  product: string;
  startDate: string;
  endDate: string;
};

const emptyFilters: TicketHistoryFilters = {
  search: '',
  status: '',
  priority: '',
  category: '',
  product: '',
  startDate: '',
  endDate: '',
};

export function CustomerTicketHistoryPage() {
  const [filters, setFilters] = useState<TicketHistoryFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState('');
  const [viewError, setViewError] = useState('');
  const productsQuery = useGetMyProducts();
  const products = (productsQuery.data?.data || []) as UserProduct[];
  const params = useMemo<GetTicketsParams>(() => ({
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.status ? { status: filters.status as 'open' | 'in-progress' | 'resolved' } : {}),
    ...(filters.priority ? { priority: filters.priority as 'low' | 'medium' | 'high' | 'critical' } : {}),
    ...(filters.category && filters.category !== 'general' ? { category: filters.category as 'bug' | 'feature' | 'billing' | 'account' | 'other' } : {}),
    ...(filters.startDate ? { startDate: filters.startDate } : {}),
    ...(filters.endDate ? { endDate: filters.endDate } : {}),
    page,
    pageSize: 100,
  }), [filters, page]);
  const ticketsQuery = useGetTickets(params, { query: { queryKey: getGetTicketsQueryKey(params) } });
  const tickets = ticketsQuery.data?.data || [];
  const filteredTickets = filters.product ? tickets.filter((ticket) => ticket.productName === filters.product) : tickets;
  const totalPages = filters.product ? 1 : (ticketsQuery.data?.meta.totalPages || 1);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('supportdesk.web.saved-ticket-views') || '[]') as SavedView[];
      if (Array.isArray(parsed)) setSavedViews(parsed.slice(0, 10));
    } catch {
      setSavedViews([]);
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, filters.priority, filters.category, filters.product, filters.startDate, filters.endDate]);

  const updateFilter = (key: keyof TicketHistoryFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters(emptyFilters);
  const saveView = () => {
    const name = viewName.trim();
    setViewError('');
    if (name.length < 2) {
      setViewError('Name this view with at least 2 characters.');
      return;
    }
    if (savedViews.some((view) => view.name.toLowerCase() === name.toLowerCase())) {
      setViewError('A saved view already uses that name.');
      return;
    }
    const next = [...savedViews, { id: `${Date.now()}-${name}`, name, filters }].slice(-10);
    setSavedViews(next);
    localStorage.setItem('supportdesk.web.saved-ticket-views', JSON.stringify(next));
    setViewName('');
  };
  const deleteView = (id: string) => {
    const next = savedViews.filter((view) => view.id !== id);
    setSavedViews(next);
    localStorage.setItem('supportdesk.web.saved-ticket-views', JSON.stringify(next));
  };

  return (
    <>
      <PageHeader
        eyebrow="My support"
        title="Your requests"
        description="Search, filter, and revisit every conversation with the support team."
        action={<Link href="/new-ticket" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-95"><Plus size={16} /> New ticket</Link>}
      />
      <section className="mb-5 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search tickets, replies, or ticket ID" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filters.status} onChange={(value) => updateFilter('status', value)} options={[...statusOptions]} placeholder="All statuses" />
            <Select value={filters.priority} onChange={(value) => updateFilter('priority', value)} options={[...priorityOptions]} placeholder="All priorities" />
            <Select value={filters.category} onChange={(value) => updateFilter('category', value)} options={[...categoryOptions]} placeholder="All categories" />
            <select value={filters.product} onChange={(event) => updateFilter('product', event.target.value)} className="h-10 min-w-[150px] rounded-md border border-input bg-background px-3 text-xs font-semibold outline-none focus:border-primary">
              <option value="">All products</option>
              {products.map((product) => <option value={product.productName} key={product.productName}>{product.productName}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">From <input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={(event) => updateFilter('startDate', event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground" /></label>
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">To <input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={(event) => updateFilter('endDate', event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground" /></label>
          {(activeFilterCount > 0) && <Button variant="ghost" className="h-9" onClick={clearFilters}><X size={15} /> Clear filters</Button>}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={14} /> {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</div>
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-bold"><ShieldCheck size={15} className="text-primary" /> Saved views</div>
          <div className="flex min-w-0 flex-1 gap-2">
            <input value={viewName} onChange={(event) => setViewName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveView()} placeholder="Save the current filters as…" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary" />
            <Button variant="soft" className="h-9 shrink-0" onClick={saveView}><Plus size={14} /> Save view</Button>
          </div>
          {viewError && <span className="text-[11px] text-destructive">{viewError}</span>}
        </div>
        {savedViews.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {savedViews.map((view) => (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold" key={view.id}>
                <button type="button" onClick={() => setFilters(view.filters)} className="hover:text-primary">{view.name}</button>
                <button type="button" onClick={() => deleteView(view.id)} className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-destructive" aria-label={`Delete ${view.name}`}><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Inbox size={14} /> {filters.product ? filteredTickets.length : (ticketsQuery.data?.meta.total ?? filteredTickets.length)} conversations</div>
        <Button variant="ghost" className="h-8 px-2" onClick={() => ticketsQuery.refetch()} disabled={ticketsQuery.isFetching}><RefreshCw size={14} className={ticketsQuery.isFetching ? 'animate-spin' : ''} /> Refresh</Button>
      </div>
      <DataState loading={ticketsQuery.isLoading} error={ticketsQuery.error} empty={!filteredTickets.length} retry={() => ticketsQuery.refetch()}>
        <div className="overflow-hidden rounded-xl border border-border bg-card px-4 shadow-sm">
          {filteredTickets.map((ticket) => (
            <Link href={`/tickets/${ticket.id}`} key={ticket.id} className="group flex items-center gap-3 border-b border-border py-4 last:border-b-0 transition-colors hover:bg-muted/50">
              <div className="mono w-[66px] shrink-0 text-[10px] font-bold text-muted-foreground">#{ticket.id.slice(0, 7)}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold group-hover:text-primary">{ticket.description.split('\n')[0] || 'Untitled request'}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{ticket.productName}</span><span className="h-1 w-1 rounded-full bg-border" /><span>{formatDate(ticket.createdAt)}</span></div></div>
              <PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /><ArrowRight size={15} className="hidden text-muted-foreground group-hover:text-primary sm:block" />
            </Link>
          ))}
        </div>
      </DataState>
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-xs">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2"><Button variant="soft" disabled={page === 1} onClick={() => setPage((current) => current - 1)}><ArrowLeft size={14} /> Previous</Button><Button variant="soft" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next <ArrowRight size={14} /></Button></div>
        </div>
      )}
    </>
  );
}

function Stars({ rating, size = 17 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={size} fill={value <= Math.round(rating) ? 'currentColor' : 'none'} className={value <= Math.round(rating) ? 'text-[#e8a51a]' : 'text-border'} />)}
    </div>
  );
}

export function CustomerSatisfactionPage() {
  const satisfactionQuery = useGetTicketSatisfaction({ query: { queryKey: getGetTicketSatisfactionQueryKey() } });
  const satisfaction = satisfactionQuery.data?.data;
  const maxDistribution = Math.max(...(satisfaction?.distribution.map((item) => item.count) || []), 1);
  return (
    <>
      <PageHeader eyebrow="My support" title="My ratings" description="See how your support feedback adds up across resolved requests." action={<Button variant="soft" onClick={() => satisfactionQuery.refetch()} disabled={satisfactionQuery.isFetching}><RefreshCw size={15} className={satisfactionQuery.isFetching ? 'animate-spin' : ''} /> Refresh</Button>} />
      <DataState loading={satisfactionQuery.isLoading} error={satisfactionQuery.error} empty={!satisfaction} retry={() => satisfactionQuery.refetch()}>
        {satisfaction && (satisfaction.ratedTicketCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff1c9] text-[#e8a51a]"><Star size={27} fill="currentColor" /></div>
            <h2 className="mt-5 text-lg font-bold">No ratings yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">When a ticket is resolved, you can rate the support you received. Your feedback helps improve future requests.</p>
            <Link href="/tickets" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Inbox size={15} /> View my tickets</Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
              <section className="rounded-xl bg-primary p-6 text-primary-foreground shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><Star size={23} fill="currentColor" /></div>
                <div className="mt-6 text-sm font-semibold text-primary-foreground/75">Your average rating</div>
                <div className="mt-1 text-5xl font-bold tracking-[-.05em]">{satisfaction.averageRating?.toFixed(1) || '—'}</div>
                <Stars rating={satisfaction.averageRating || 0} />
                <div className="mt-3 text-xs text-primary-foreground/75">Based on {satisfaction.ratedTicketCount} rated ticket{satisfaction.ratedTicketCount === 1 ? '' : 's'}</div>
              </section>
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="font-bold">Rating distribution</h2>
                <p className="mt-1 text-xs text-muted-foreground">How you rated your resolved requests</p>
                <div className="mt-6 space-y-3">
                  {[...satisfaction.distribution].reverse().map((item) => (
                    <div className="flex items-center gap-3" key={item.rating}><span className="w-3 text-xs font-bold">{item.rating}</span><Star size={14} className="text-[#e8a51a]" fill="currentColor" /><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#e8a51a]" style={{ width: `${item.count / maxDistribution * 100}%` }} /></div><span className="w-5 text-right text-xs text-muted-foreground">{item.count}</span></div>
                  ))}
                </div>
              </section>
            </div>
            <section className="mt-6">
              <div className="mb-4 flex items-center gap-2"><MessageCircle size={17} className="text-primary" /><h2 className="font-bold">Recent feedback</h2></div>
              {satisfaction.recentFeedback.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {satisfaction.recentFeedback.map((feedback) => (
                    <Link href={`/tickets/${feedback.ticketId}`} className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50" key={feedback.ticketId}>
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0 truncate text-sm font-bold">{feedback.productName}</div><Stars rating={feedback.rating} size={14} /></div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{feedback.feedbackText || 'No written feedback provided.'}</p>
                      <div className="mt-4 text-[11px] text-muted-foreground">{formatDate(feedback.resolvedAt || feedback.createdAt)}</div>
                    </Link>
                  ))}
                </div>
              ) : <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Your ratings do not include written feedback yet.</div>}
            </section>
          </>
        ))}
      </DataState>
    </>
  );
}

function Conversation({
  replies,
  user,
}: {
  replies: TicketReply[];
  user: CustomerProfile;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4"><div className="flex items-center gap-2 text-sm font-bold"><MessageCircle size={17} className="text-primary" /> Conversation <span className="text-xs font-normal text-muted-foreground">({replies.length})</span></div></div>
      <div className="space-y-5 p-5">
        {replies.length ? replies.map((reply) => (
          <div className="flex gap-3" key={reply.id}>
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1c2b3] text-[10px] font-bold text-[#873c32]">{initials(reply.authorName)}</span>
            <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-xs font-bold">{reply.authorName}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{reply.authorRole}</span><span className="text-[10px] text-muted-foreground">{formatDate(reply.createdAt)} · {formatTime(reply.createdAt)}</span></div><div className="rounded-lg rounded-tl-none border border-border bg-background px-4 py-3 text-sm leading-6">{reply.message}</div></div>
          </div>
        )) : <div className="py-6 text-center text-sm text-muted-foreground">No replies yet. Start the conversation below.</div>}
      </div>
    </section>
  );
}

function AttachmentList({ attachments }: { attachments?: { id: string; fileName: string; fileSize: number; url: string }[] }) {
  if (!attachments?.length) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Paperclip size={16} className="text-primary" /> Attachments</div>
      <div className="space-y-2">{attachments.map((attachment) => <a href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id} className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:border-primary/50 hover:bg-muted"><FileImage size={16} className="text-primary" /><span className="min-w-0 flex-1 truncate font-semibold">{attachment.fileName}</span><span className="text-[10px] text-muted-foreground">{Math.ceil(attachment.fileSize / 1024)} KB</span></a>)}</div>
    </section>
  );
}

export function CustomerTicketDetailPage({ user }: { user: CustomerProfile }) {
  const { ticketId = '' } = useParams<{ ticketId: string }>();
  const queryClient = useQueryClient();
  const detailQuery = useGetUserTicketDetail(ticketId, { query: { enabled: Boolean(ticketId), queryKey: getGetUserTicketDetailQueryKey(ticketId) } });
  const reply = useCreateUserTicketReply();
  const upload = useUploadTicketAttachment();
  const rate = useRateTicket();
  const ticket = detailQuery.data?.data;
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!message.trim() && !attachment) {
      setError('Write a reply or attach an image first.');
      return;
    }
    try {
      if (message.trim()) await reply.mutateAsync({ ticketId, data: { message: message.trim() } });
      if (attachment) await upload.mutateAsync({ ticketId, data: attachment });
      setMessage('');
      setAttachment(null);
      setNotice('Your update was sent.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetUserTicketDetailQueryKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: getGetTicketsQueryKey() }),
      ]);
    } catch (sendError) {
      setError(errorText(sendError));
    }
  };

  const submitRating = async () => {
    if (!rating) {
      setError('Choose a rating from 1 to 5.');
      return;
    }
    setError('');
    try {
      await rate.mutateAsync({ ticketId, data: { rating, feedbackText: feedback.trim() || null } });
      setNotice('Thanks — your feedback helps us improve.');
      await queryClient.invalidateQueries({ queryKey: getGetUserTicketDetailQueryKey(ticketId) });
      await queryClient.invalidateQueries({ queryKey: getGetTicketSatisfactionQueryKey() });
    } catch (ratingError) {
      setError(errorText(ratingError));
    }
  };

  return (
    <>
      <Link href="/tickets" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Back to requests</Link>
      <DataState loading={detailQuery.isLoading} error={detailQuery.error} empty={!ticket} retry={() => detailQuery.refetch()}>
        {ticket && (
          <>
            <PageHeader eyebrow={`Request #${ticket.id.slice(0, 8)}`} title={ticket.description.split('\n')[0] || 'Support request'} description={`${ticket.productName} · opened ${formatDate(ticket.createdAt)}`} action={<StatusBadge status={ticket.status} />} />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{ticket.description}</p></section>
                <Conversation replies={ticket.replies || []} user={user} />
                <form onSubmit={sendReply} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Send size={16} className="text-primary" /> Continue the conversation</div>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a reply…" rows={4} className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" />
                  <div className="mt-4"><AttachmentPicker attachment={attachment} onChange={(next, pickerError) => { setAttachment(next); setError(pickerError || ''); }} disabled={reply.isPending || upload.isPending} /></div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-[11px] text-muted-foreground">Replying as {user.name}</span><Button disabled={reply.isPending || upload.isPending}>{reply.isPending || upload.isPending ? 'Sending…' : 'Send update'} <Send size={14} /></Button></div>
                </form>
                <AttachmentList attachments={ticket.attachments} />
                {ticket.status === 'resolved' && (
                  <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    {ticket.rating ? (
                      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-accent-foreground" size={20} /><div><h3 className="font-bold">Thanks for your feedback</h3><Stars rating={ticket.rating} /><p className="mt-2 text-sm text-muted-foreground">{ticket.feedbackText || 'You rated this resolution.'}</p></div></div>
                    ) : (
                      <div><div className="flex items-start gap-3"><Star className="mt-0.5 text-[#e8a51a]" size={20} /><div><h3 className="font-bold">How did we do?</h3><p className="mt-1 text-sm text-muted-foreground">Rate the support you received and leave optional feedback.</p></div></div><div className="mt-4 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`Rate ${value} out of 5`} className={`flex h-10 w-10 items-center justify-center rounded-md border transition hover:border-primary ${rating === value ? 'border-primary bg-[#ffe0d8] text-primary' : 'border-border'}`}><Star size={18} fill={rating >= value ? 'currentColor' : 'none'} /></button>)}</div><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Optional written feedback" rows={3} className="mt-4 w-full resize-y rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary" /><Button className="mt-3" onClick={submitRating} disabled={rate.isPending}>{rate.isPending ? 'Saving…' : 'Send feedback'} <Check size={14} /></Button></div>
                    )}
                  </section>
                )}
                {(error || notice) && <div className={`rounded-md border p-3 text-sm ${error ? 'border-[#efc2bb] bg-[#fff4f1] text-destructive' : 'border-accent bg-accent/40 text-accent-foreground'}`}>{error || notice}</div>}
              </div>
              <aside className="space-y-4">
                <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Request details</h3><dl className="space-y-4 text-sm"><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</dt><dd><StatusBadge status={ticket.status} /></dd></div><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Priority</dt><dd><PriorityBadge priority={ticket.priority} /></dd></div><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</dt><dd className="font-semibold capitalize">{ticket.category}</dd></div><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Created</dt><dd className="font-semibold">{formatDate(ticket.createdAt)}</dd></div></dl></section>
              </aside>
            </div>
          </>
        )}
      </DataState>
    </>
  );
}

export function CustomerSettingsPage({ user }: { user: CustomerProfile }) {
  const queryClient = useQueryClient();
  const update = useUpdateProfile();
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword && !currentPassword) {
      setError('Enter your current password to set a new one.');
      return;
    }
    const data: { name?: string; currentPassword?: string; newPassword?: string } = {};
    if (name.trim() !== user.name) data.name = name.trim();
    if (newPassword) {
      data.currentPassword = currentPassword;
      data.newPassword = newPassword;
    }
    if (!Object.keys(data).length) {
      setNotice('No changes to save.');
      return;
    }
    try {
      const result = await update.mutateAsync({ data });
      queryClient.setQueryData(getGetProfileQueryKey(), result);
      if (result.data.token) localStorage.setItem('supportdesk.web.token', result.data.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Profile updated successfully.');
    } catch (saveError) {
      setError(errorText(saveError));
    }
  };

  return (
    <>
      <PageHeader eyebrow="Workspace / account" title="Settings" description="Manage your profile and sign-in credentials." />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={save} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-7 flex items-center gap-4 border-b border-border pb-6"><span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f1c2b3] text-sm font-bold text-[#873c32]">{initials(user.name)}</span><div><h2 className="font-bold">{user.name}</h2><p className="text-xs text-muted-foreground">{user.email}</p></div></div>
          <label className="block max-w-md"><span className="mb-2 block text-xs font-bold">Display name</span><input required value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label>
          <div className="mt-5 max-w-md"><span className="mb-2 block text-xs font-bold">Email address</span><div className="flex h-11 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">{user.email}<span className="ml-auto text-[10px] font-bold uppercase">Managed</span></div><p className="mt-1 text-[11px] text-muted-foreground">Contact your administrator if your email needs to change.</p></div>
          <div className="mt-7 border-t border-border pt-6"><h3 className="mb-4 text-sm font-bold">Change password</h3><div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="mb-2 block text-[11px] font-bold">Current password</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label><label className="block"><span className="mb-2 block text-[11px] font-bold">New password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label><label className="block"><span className="mb-2 block text-[11px] font-bold">Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label></div></div>
          {error && <div className="mt-5 rounded-md border border-[#efc2bb] bg-[#fff4f1] p-3 text-sm text-destructive">{error}</div>}
          {notice && <div className="mt-5 rounded-md border border-accent bg-accent/40 p-3 text-sm text-accent-foreground">{notice}</div>}
          <Button className="mt-7" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'} <Check size={15} /></Button>
        </form>
        <aside className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-accent-foreground" /> Secure account</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Password changes refresh your browser session automatically. Sign out when using a shared computer.</p><Link href="/help" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline">Visit help center <ArrowRight size={13} /></Link></aside>
      </div>
    </>
  );
}