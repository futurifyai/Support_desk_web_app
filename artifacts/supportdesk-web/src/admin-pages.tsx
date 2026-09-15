import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Inbox,
  RefreshCw,
  Search,
  Shield,
  Star,
  Ticket as TicketIcon,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  getGetAdminTicketDetailQueryKey,
  getGetAdminTicketsQueryKey,
  getGetAdminUserTicketStatsQueryKey,
  getGetAuditLogsQueryKey,
  useGetAdminAgents,
  useGetAdminTicketDetail,
  useGetAdminTickets,
  useGetAdminUserTicketStats,
  useGetAuditLogs,
  type AdminTicket,
  type AuditLog,
  type UserTicketStat,
} from '@workspace/api-client-react';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
}

function displayStatus(value?: string | null) {
  return value === 'in-progress'
    ? 'In progress'
    : value
      ? value[0].toUpperCase() + value.slice(1)
      : 'Unknown';
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'The service is unavailable right now.';
}

function PageTitle({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
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

function StatusBadge({ status }: { status?: string }) {
  const tone = status === 'resolved'
    ? 'bg-accent text-accent-foreground'
    : status === 'in-progress'
      ? 'bg-[#fff0cc] text-[#805b17]'
      : 'bg-[#ffe0d8] text-[#9a3f2d]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{displayStatus(status)}
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

function Avatar({ name }: { name?: string | null }) {
  const initials = (name || 'User').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1c2b3] text-xs font-bold text-[#873c32]">{initials}</span>;
}

function DataState({ loading, error, empty, retry, children }: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  retry?: () => void;
  children: React.ReactNode;
}) {
  if (loading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((item) => <div className="skeleton h-[68px] rounded-lg" key={item} />)}</div>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-[#efc2bb] bg-[#fff4f1] p-8 text-center">
        <AlertCircle className="mx-auto mb-3 text-destructive" size={24} />
        <p className="font-semibold">We could not load this view.</p>
        <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
        {retry && <button type="button" onClick={retry} className="mt-4 rounded-md bg-secondary px-3 py-2 text-xs font-bold">Try again</button>}
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

type QueueSort = 'createdAt' | 'userName' | 'productName' | 'status';

function AdminTicketPreview({ ticketId }: { ticketId: string | null }) {
  const detail = useGetAdminTicketDetail(ticketId || '', {
    query: {
      enabled: Boolean(ticketId),
      queryKey: getGetAdminTicketDetailQueryKey(ticketId || ''),
    },
  });
  const ticket = detail.data?.data;

  if (!ticketId) {
    return <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Select a ticket to preview it here.</div>;
  }
  if (detail.isLoading) return <div className="skeleton min-h-[420px] rounded-xl" />;
  if (detail.error || !ticket) return <div className="rounded-xl border border-[#efc2bb] bg-[#fff4f1] p-8 text-center text-sm text-destructive">{errorMessage(detail.error)}</div>;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ticket preview</div>
          <h2 className="mt-2 text-lg font-bold">{ticket.productName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{ticket.userName} · {ticket.userEmail}</p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={ticket.priority} />
        <span className="text-xs text-muted-foreground">{ticket.category}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</span>
      </div>
      <p className="mt-5 whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-6 text-foreground/80">{ticket.description}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conversation</div>
          <div className="mt-1 text-lg font-bold">{ticket.replies?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground">replies</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Customer rating</div>
          <div className="mt-1 text-lg font-bold">{ticket.rating ? `${ticket.rating} / 5` : '—'}</div>
          <div className="text-xs text-muted-foreground">{ticket.feedbackText ? 'Written feedback received' : 'No written feedback'}</div>
        </div>
      </div>
      <Link href={`/tickets/${ticket.id}`} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline">Open full ticket <ArrowUpRight size={14} /></Link>
    </div>
  );
}

export function AdminTicketQueuePage() {
  const tickets = useGetAdminTickets({}, { query: { queryKey: getGetAdminTicketsQueryKey({}), retry: false } });
  const allTickets = tickets.data?.data ?? [];
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortKey, setSortKey] = useState<QueueSort>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = allTickets.filter((ticket) => {
      const matchesStatus = !status || ticket.status === status;
      const matchesSearch = !query || [ticket.id, ticket.userName, ticket.userEmail, ticket.productName, ticket.description]
        .some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
    return rows.sort((left, right) => {
      const a = sortKey === 'createdAt' ? new Date(left.createdAt).getTime() : String(left[sortKey] ?? '').toLowerCase();
      const b = sortKey === 'createdAt' ? new Date(right.createdAt).getTime() : String(right[sortKey] ?? '').toLowerCase();
      const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
      return sortDirection === 'asc' ? result : -result;
    });
  }, [allTickets, search, sortKey, sortDirection, status]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedTicketId(null);
      return;
    }
    if (!selectedTicketId || !filtered.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(filtered[0].id);
    }
  }, [filtered, selectedTicketId]);

  const openCount = allTickets.filter((ticket) => ticket.status === 'open').length;
  const inProgressCount = allTickets.filter((ticket) => ticket.status === 'in-progress').length;
  const resolvedCount = allTickets.filter((ticket) => ticket.status === 'resolved').length;

  const toggleSort = (next: QueueSort) => {
    if (sortKey === next) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(next);
      setSortDirection('desc');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="Operations / queue"
        title="Ticket queue"
        description="Search, sort, filter, and preview every customer conversation from one workspace."
        action={<Link href="/new-ticket" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-95"><TicketIcon size={16} /> New ticket</Link>}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ['Open', openCount, 'text-[#a84a39]', 'bg-[#ffe0d8]'],
          ['In progress', inProgressCount, 'text-[#866a21]', 'bg-[#fff1c9]'],
          ['Resolved', resolvedCount, 'text-[#23705e]', 'bg-accent'],
        ].map(([label, value, color, background]) => (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm" key={String(label)}>
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">{label}</span><span className={`rounded-md px-2 py-1 text-xs font-bold ${background} ${color}`}>{value}</span></div>
            <div className="mt-3 text-xs text-muted-foreground">of {allTickets.length} total conversations</div>
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search user, product, ticket ID, or message" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['', 'open', 'in-progress', 'resolved'].map((value) => <button type="button" key={value || 'all'} onClick={() => setStatus(value)} className={`rounded-md px-3 py-2 text-xs font-bold ${status === value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}>{value ? displayStatus(value) : 'All statuses'}</button>)}
          {(search || status) && <button type="button" onClick={() => { setSearch(''); setStatus(''); }} className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"><X size={14} /> Clear</button>}
        </div>
      </div>
      <DataState loading={tickets.isLoading} error={tickets.error} empty={!allTickets.length} retry={() => tickets.refetch()}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)]">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div><h2 className="font-bold">All conversations</h2><p className="mt-1 text-xs text-muted-foreground">{filtered.length} shown</p></div>
              <div className="flex flex-wrap gap-1">
                {([['createdAt', 'Recent'], ['userName', 'Customer'], ['productName', 'Product'], ['status', 'Status']] as [QueueSort, string][]).map(([key, label]) => <button type="button" key={key} onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold ${sortKey === key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>{label}{sortKey === key && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button>)}
              </div>
            </div>
            {filtered.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No tickets match these filters.</div> : <div className="divide-y divide-border">{filtered.map((ticket) => <button type="button" key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40 ${selectedTicketId === ticket.id ? 'bg-primary/5' : ''}`}><div className="mono w-16 shrink-0 text-[10px] font-bold text-muted-foreground">#{ticket.id.slice(-6)}</div><Avatar name={ticket.userName} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{ticket.productName}</div><div className="mt-1 truncate text-xs text-muted-foreground">{ticket.userName} · {formatDate(ticket.createdAt)}</div></div><div className="hidden items-center gap-2 sm:flex"><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /></div><ArrowUpRight size={15} className="text-muted-foreground" /></button>)}</div>}
          </section>
          <AdminTicketPreview ticketId={selectedTicketId} />
        </div>
      </DataState>
    </>
  );
}

export function AdminUserActivityPage() {
  const statsQuery = useGetAdminUserTicketStats({ query: { queryKey: getGetAdminUserTicketStatsQueryKey() } });
  const agentsQuery = useGetAdminAgents({ query: { queryKey: ['/api/admin/agents'] } });
  const stats = (statsQuery.data?.data ?? []) as UserTicketStat[];
  const agents = (agentsQuery.data?.data ?? []) as Array<{ id: string; name: string; email: string; openTicketCount?: number; averageRating?: number | null }>;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'tickets' | 'recent' | 'name'>('tickets');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = stats.filter((item) => !query || item.userName.toLowerCase().includes(query) || item.userEmail.toLowerCase().includes(query));
    return [...filtered].sort((a, b) => sort === 'tickets' ? b.ticketCount - a.ticketCount : sort === 'recent' ? new Date(b.lastTicketAt).getTime() - new Date(a.lastTicketAt).getTime() : a.userName.localeCompare(b.userName));
  }, [search, sort, stats]);
  const totalTickets = stats.reduce((sum, item) => sum + item.ticketCount, 0);

  return (
    <>
      <PageTitle eyebrow="Operations / people" title="User activity" description={`${stats.length} users · ${totalTickets} total tickets`} action={<button type="button" onClick={() => void statsQuery.refetch()} className="inline-flex items-center gap-2 rounded-md bg-secondary px-3.5 py-2.5 text-sm font-bold"><RefreshCw size={15} className={statsQuery.isFetching ? 'animate-spin' : ''} /> Refresh</button>} />
      {agents.length > 0 && <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Users size={16} className="text-primary" /><h2 className="font-bold">Agent performance</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{agents.map((agent) => <div className="flex items-center gap-3 rounded-lg border border-border p-3" key={agent.id}><Avatar name={agent.name} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{agent.name}</div><div className="text-xs text-muted-foreground">{agent.openTicketCount ?? 0} open tickets</div></div><div className="flex items-center gap-1 text-xs font-bold text-[#b7791f]"><Star size={13} fill="currentColor" />{agent.averageRating?.toFixed(1) ?? '—'}</div></div>)}</div></section>}
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row"><div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></div><div className="flex flex-wrap gap-2"><span className="self-center text-xs text-muted-foreground">Sort by</span>{[['tickets', 'Most tickets'], ['recent', 'Most recent'], ['name', 'Name']].map(([value, label]) => <button type="button" key={value} onClick={() => setSort(value as typeof sort)} className={`rounded-md px-3 py-2 text-xs font-bold ${sort === value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}>{label}</button>)}</div></div>
      <DataState loading={statsQuery.isLoading} error={statsQuery.error} empty={!rows.length} retry={() => statsQuery.refetch()}><div className="space-y-3">{rows.map((stat) => { const expanded = expandedId === stat.userId; return <section className="rounded-xl border border-border bg-card shadow-sm" key={stat.userId}><button type="button" onClick={() => setExpandedId(expanded ? null : stat.userId)} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40"><Avatar name={stat.userName} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{stat.userName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{stat.userEmail} · Last ticket {formatDate(stat.lastTicketAt)}</span></span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{stat.ticketCount} tickets</span>{expanded ? <ChevronUp size={17} className="text-muted-foreground" /> : <ChevronDown size={17} className="text-muted-foreground" />}</button><div className="flex flex-wrap gap-2 border-t border-border px-5 py-3 text-[11px] text-muted-foreground"><span className="rounded bg-[#ffe0d8] px-2 py-1 text-[#9a3f2d]">{stat.tickets.filter((ticket) => ticket.status === 'open').length} open</span><span className="rounded bg-[#fff1c9] px-2 py-1 text-[#866a21]">{stat.tickets.filter((ticket) => ticket.status === 'in-progress').length} in progress</span><span className="rounded bg-accent px-2 py-1 text-accent-foreground">{stat.tickets.filter((ticket) => ticket.status === 'resolved').length} resolved</span><span className="ml-auto inline-flex items-center gap-1"><Clock3 size={12} /> First ticket {formatDate(stat.firstTicketAt)}</span></div>{expanded && <div className="border-t border-border bg-muted/20 px-5 py-4"><div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Ticket history</div><div className="divide-y divide-border rounded-lg border border-border bg-card">{stat.tickets.map((ticket) => <Link href={`/tickets/${ticket.id}`} key={ticket.id} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/40"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{ticket.productName}</div><div className="mt-1 text-[11px] text-muted-foreground">#{ticket.id.slice(-8)} · {formatDate(ticket.createdAt)}</div></div><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /></Link>)}</div></div>}</section>; })}</div></DataState>
    </>
  );
}

const auditFilters = [
  ['', 'All'],
  ['ticket_created', 'Created'],
  ['ticket_status_update', 'Status'],
  ['ticket_assigned', 'Assigned'],
  ['admin_reply', 'Reply'],
  ['login', 'Login'],
  ['profile_update', 'Profile'],
];

function auditLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const pageSize = 20;
  const query = useGetAuditLogs({ page, pageSize, ...(action ? { action } : {}) }, { query: { queryKey: getGetAuditLogsQueryKey({ page, pageSize, ...(action ? { action } : {}) }) } });
  const logs = (query.data?.data ?? []) as AuditLog[];
  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => [log.action, log.actorEmail, log.resourceType, log.resourceId].some((value) => value?.toLowerCase().includes(term)));
  }, [logs, search]);

  return (
    <>
      <PageTitle eyebrow="Workspace / security" title="Audit log" description="Review account, ticket, access, and profile activity across the workspace." action={<button type="button" onClick={() => void query.refetch()} className="inline-flex items-center gap-2 rounded-md bg-secondary px-3.5 py-2.5 text-sm font-bold"><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''} /> Refresh</button>} />
      <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm"><div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, actor, resource, or ID" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></div><div className="flex flex-wrap gap-2">{auditFilters.map(([value, label]) => <button type="button" key={value || 'all'} onClick={() => { setAction(value); setPage(1); }} className={`rounded-md px-3 py-2 text-xs font-bold ${action === value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}>{label}</button>)}</div></div>
      <DataState loading={query.isLoading} error={query.error} empty={!visibleLogs.length} retry={() => query.refetch()}><section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><span>{visibleLogs.length} events on page {page}</span><Shield size={15} /></div><div className="divide-y divide-border">{visibleLogs.map((log) => <div className="flex gap-3 px-5 py-4" key={log.id}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Shield size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-bold">{auditLabel(log.action)}</div><div className="text-[11px] text-muted-foreground">{formatDateTime(log.createdAt)}</div></div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{log.actorEmail || 'System'}</span><span>·</span><span>{auditLabel(log.resourceType)}</span>{log.resourceId && <><span>·</span><span className="mono">#{log.resourceId.slice(-8)}</span></>}</div></div></div>)}</div></section><div className="mt-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">Page {page}</span><div className="flex gap-2"><button type="button" disabled={page === 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50">Previous</button><button type="button" disabled={logs.length < pageSize || query.isFetching} onClick={() => setPage((value) => value + 1)} className="rounded-md bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50">Next</button></div></div></DataState>
    </>
  );
}