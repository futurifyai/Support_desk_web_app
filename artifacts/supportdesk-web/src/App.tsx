import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import {
  useLogin, useGetProfile, useGetAdminAnalytics, useGetAdminTickets, useCreateTicket,
  useGetAdminTicketDetail, useGetAdminAgents, useUpdateTicketStatus,
  useUpdateTicketPriority, useAssignTicket, useCreateTicketReply,
  useGetTickets, useGetUserTicketDetail, useCreateUserTicketReply,
  useRateTicket, useGetAdminUserTicketStats, useGetAdminUsers,
  useGetHelpArticles, useGetAuditLogs, useUpdateProfile,
  useExportAnalyticsCsv, useExportAnalyticsPdf,
  getGetAdminTicketsQueryKey, getGetAdminTicketDetailQueryKey,
  getGetTicketsQueryKey, getGetUserTicketDetailQueryKey,
  getGetAdminAnalyticsQueryKey, getGetAdminUserTicketStatsQueryKey,
  getGetAdminUsersQueryKey, getGetHelpArticlesQueryKey,
  getGetAuditLogsQueryKey, getGetProfileQueryKey,
  getExportAnalyticsCsvQueryKey, getExportAnalyticsPdfQueryKey,
} from '@workspace/api-client-react';
import type { AdminAnalytics, AdminTicket, AdminTicketDetail, Agent, Ticket, TicketReply, UserTicketDetail } from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Redirect, Router as WouterRouter } from 'wouter';
import {
  Activity, AlertCircle, ArrowLeft, ArrowUpRight, BarChart3, Bell, BookOpen,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Download, Inbox,
  LayoutDashboard, LogOut, Menu, MessageCircle, MoreHorizontal, Plus, Search,
  Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Tag,
  Paperclip, Ticket as TicketIcon, TrendingUp, Users, X, Zap,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
const TOKEN_KEY = 'supportdesk.web.token';

setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

type Profile = { id: string; name: string; email: string; role: 'user' | 'admin' };

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}
function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}
function initials(name = 'SupportDesk') {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}
function displayStatus(status?: string) { return status === 'in-progress' ? 'In progress' : status ? status[0].toUpperCase() + status.slice(1) : 'Unknown'; }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'The service is unavailable right now.'; }

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-95 shadow-sm',
    soft: 'bg-secondary text-secondary-foreground hover:bg-muted',
    ghost: 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:brightness-95',
  };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

function StatusBadge({ status }: { status?: string }) {
  const tone = status === 'resolved' ? 'bg-accent text-accent-foreground' : status === 'in-progress' ? 'bg-[#fff0cc] text-[#805b17]' : 'bg-[#ffe0d8] text-[#9a3f2d]';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{displayStatus(status)}</span>;
}
function PriorityBadge({ priority }: { priority?: string }) {
  const tone = priority === 'critical' ? 'text-destructive bg-[#f9d9d4]' : priority === 'high' ? 'text-[#ad5a28] bg-[#ffead4]' : priority === 'medium' ? 'text-[#866a21] bg-[#fff1c9]' : 'text-muted-foreground bg-muted';
  return <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${tone}`}>{priority || 'none'}</span>;
}
function Avatar({ name, small = false }: { name?: string | null; small?: boolean }) {
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#f1c2b3] font-bold text-[#873c32] ${small ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'}`}>{initials(name || 'User')}</span>;
}
function LoadingRows({ count = 4 }: { count?: number }) {
  return <div className="space-y-2">{Array.from({ length: count }).map((_, i) => <div className="skeleton h-[68px] rounded-lg" key={i} />)}</div>;
}
function DataState({ loading, error, empty, children, retry }: { loading?: boolean; error?: unknown; empty?: boolean; children: ReactNode; retry?: () => void }) {
  if (loading) return <LoadingRows />;
  if (error) return <div className="rounded-xl border border-[#efc2bb] bg-[#fff4f1] p-8 text-center"><AlertCircle className="mx-auto mb-3 text-destructive" size={24} /><p className="font-semibold">We could not load this view.</p><p className="mt-1 text-sm text-muted-foreground">{errorText(error)}</p>{retry && <Button variant="soft" className="mt-4" onClick={retry}>Try again</Button>}</div>;
  if (empty) return <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center"><Inbox className="mx-auto mb-3 text-muted-foreground" size={28} /><p className="font-semibold">Nothing here yet</p><p className="mt-1 text-sm text-muted-foreground">New activity will appear in this space.</p></div>;
  return <>{children}</>;
}

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, admin: true },
  { href: '/tickets', label: 'Tickets', icon: TicketIcon },
  { href: '/customers', label: 'Customers', icon: Users, admin: true },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, admin: true },
  { href: '/help', label: 'Help center', icon: BookOpen },
];

function Shell({ user, children }: { user: Profile; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const isAdmin = user.role === 'admin';
  const logout = () => { localStorage.removeItem(TOKEN_KEY); queryClient.clear(); setLocation('/login'); };
  return <div className="noise flex min-h-[100dvh] bg-background">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-lg font-black text-sidebar-primary-foreground">S</span>
        <div><div className="text-[15px] font-bold tracking-tight">support<span className="text-sidebar-primary">desk</span></div><div className="mono mt-0.5 text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/45">ops console</div></div>
      </div>
      <div className="px-4 pb-3 pt-7"><div className="mono mb-2 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/40">Workspace</div>
        <nav className="space-y-1">{nav.filter((item) => !item.admin || isAdmin).map((item) => { const Icon = item.icon; const active = location === item.href || (item.href === '/tickets' && location.startsWith('/tickets/')); return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Icon size={17} strokeWidth={active ? 2.5 : 1.8} /><span>{item.label}</span>{item.label === 'Tickets' && <span className={`ml-auto rounded px-1.5 py-0.5 mono text-[10px] ${active ? 'bg-sidebar-primary-foreground/15' : 'bg-sidebar-accent'}`}>queue</span>}</Link>; })}</nav>
      </div>
      <div className="mt-auto px-4 pb-4">
        <Link href="/new-ticket" onClick={() => setOpen(false)} className="mb-4 flex items-center justify-center gap-2 rounded-md border border-sidebar-primary/50 bg-sidebar-primary/10 px-3 py-2.5 text-xs font-bold text-sidebar-primary transition-colors hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"><Plus size={15} />Submit a ticket</Link>
        <div className="border-t border-sidebar-border pt-4"><Link href="/settings" className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-sidebar-accent"><Avatar name={user.name} small /><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{user.name}</div><div className="truncate text-[10px] text-sidebar-foreground/45">{isAdmin ? 'Administrator' : 'Customer'}</div></div><Settings size={15} className="text-sidebar-foreground/45" /></Link><button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-md px-2 py-2 text-xs font-semibold text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut size={15} /> Sign out</button></div>
      </div>
    </aside>
    {open && <button className="fixed inset-0 z-20 bg-[#171d2b]/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" />}
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-10 flex h-[76px] items-center gap-4 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-7">
        <button className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        <div className="relative hidden max-w-[420px] flex-1 sm:block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setLocation(`/tickets${quickSearch ? `?search=${encodeURIComponent(quickSearch)}` : ''}`)} placeholder="Search tickets, customers, articles..." className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary" /></div>
        <div className="relative ml-auto flex items-center gap-2"><Link href="/help" className="hidden items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted sm:flex"><CircleHelp size={16} /> Help</Link><button onClick={() => setShowNotifications((value) => !value)} className="relative rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Notifications"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" /></button>{showNotifications && <div className="absolute right-0 top-12 z-40 w-64 rounded-lg border border-border bg-card p-4 shadow-lg"><div className="flex items-center gap-2 text-xs font-bold"><Bell size={14} className="text-primary" /> Notifications</div><p className="mt-2 text-xs leading-5 text-muted-foreground">You are all caught up. New ticket activity will appear here.</p><button className="mt-3 text-[11px] font-bold text-primary hover:underline" onClick={() => setShowNotifications(false)}>Dismiss</button></div>}<div className="ml-2 h-7 w-px bg-border" /><div className="hidden text-right sm:block"><div className="text-xs font-bold">{user.name}</div><div className="text-[10px] text-muted-foreground">{user.email}</div></div><Avatar name={user.name} small /></div>
      </header>
      <div key={location} className="page-enter mx-auto max-w-[1440px] p-4 sm:p-7">{children}</div>
    </main>
  </div>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mono mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</div><h1 className="text-[26px] font-bold tracking-[-.03em] sm:text-[32px]">{title}</h1>{description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}</div>;
}

function AuthPage() {
  const [, setLocation] = useLocation();
  const token = localStorage.getItem(TOKEN_KEY);
  const profile = useGetProfile({ query: { enabled: Boolean(token), queryKey: getGetProfileQueryKey(), retry: false } });
  useEffect(() => { if (profile.data?.data) setLocation(profile.data.data.role === 'admin' ? '/dashboard' : '/tickets'); else if (!token && !profile.isLoading) setLocation('/login'); }, [profile.data, profile.isLoading, token, setLocation]);
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#222a3c] px-6"><div className="text-center text-[#f8f2e7]"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-black text-primary-foreground">S</div><p className="mono text-[10px] uppercase tracking-[.2em] text-primary">Restoring your desk</p><div className="mx-auto mt-5 h-1 w-28 overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/2 animate-pulse rounded-full bg-primary" /></div></div></div>;
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); setNotice(''); login.mutate({ data: { email, password } }, { onSuccess: (res) => { localStorage.setItem(TOKEN_KEY, res.data.token); queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() }); setLocation(res.data.user.role === 'admin' ? '/dashboard' : '/tickets'); }, onError: (err) => setNotice(errorText(err)) }); };
  return <div className="noise flex min-h-[100dvh] bg-[#222a3c] text-[#f8f2e7]"><div className="hidden w-[42%] flex-col justify-between bg-[#1c2333] p-10 lg:flex"><div><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-black text-primary-foreground">S</span><span className="text-[15px] font-bold">support<span className="text-primary">desk</span></span></div><div className="mt-28 max-w-[360px]"><div className="mono mb-5 text-[10px] uppercase tracking-[.2em] text-primary">A calmer support queue</div><h1 className="text-5xl font-bold leading-[1.02] tracking-[-.05em]">Good support<br /><span className="text-primary">starts here.</span></h1><p className="mt-6 text-[15px] leading-7 text-[#b4b7c0]">A focused workspace for the moments that matter to your customers and your team.</p></div></div><div className="flex items-center gap-2 text-xs text-[#7c8495]"><ShieldCheck size={15} className="text-accent" /> Private workspace · secure session</div></div><div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12"><div className="w-full max-w-[390px]"><div className="mb-10 lg:hidden"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-black text-primary-foreground">S</div></div><div className="mb-8"><div className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">Welcome back</div><h2 className="text-3xl font-bold tracking-[-.04em]">Sign in to supportdesk</h2><p className="mt-2 text-sm text-[#aeb4c0]">Your queue is waiting.</p></div><form onSubmit={submit} className="space-y-5"><label className="block"><span className="mb-2 block text-xs font-semibold text-[#d8d8d7]">Work email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-12 w-full rounded-md border border-white/15 bg-white/[.06] px-4 text-sm text-white outline-none transition-colors focus:border-primary" /></label><label className="block"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-[#d8d8d7]">Password</span><button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setNotice('Password reset is managed by your workspace administrator.')}>Forgot password?</button></div><input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-md border border-white/15 bg-white/[.06] px-4 text-sm text-white outline-none transition-colors focus:border-primary" /></label>{notice && <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-[#ffd5cb]">{notice}</div>}<button disabled={login.isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary font-bold text-primary-foreground transition-all hover:brightness-95 disabled:opacity-60">{login.isPending ? 'Checking credentials…' : 'Continue'}<ArrowUpRight size={16} /></button></form><p className="mt-8 text-center text-xs text-[#7e8696]">Need access? Contact your workspace administrator.</p></div></div></div>;
}

function Dashboard() {
  const analytics = useGetAdminAnalytics({ query: { queryKey: getGetAdminAnalyticsQueryKey() } });
  const tickets = useGetAdminTickets({}, { query: { queryKey: getGetAdminTicketsQueryKey({}), retry: false } });
  const a = analytics.data?.data;
  return <><PageTitle eyebrow="Monday · support operations" title="Good morning, keep the queue moving." description="The signal from your support desk, at a glance." action={<Link href="/tickets" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-95"><Inbox size={16} /> Open queue <ArrowUpRight size={15} /></Link>} /><DataState loading={analytics.isLoading} error={analytics.error} retry={() => analytics.refetch()} empty={!a}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Open', a?.openCount, 'needs attention', 'text-[#a84a39]', 'bg-[#ffe0d8]'], ['In progress', a?.inProgressCount, 'being handled', 'text-[#866a21]', 'bg-[#fff1c9]'], ['Resolved', a?.resolvedCount, 'this period', 'text-[#23705e]', 'bg-accent'], ['Critical', a?.criticalCount, 'SLA watch', 'text-[#9d3b48]', 'bg-[#f9d9d4]']].map(([label, value, sub, text, bg]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">{label}</span><span className={`rounded-md p-2 ${String(bg)}`}><Activity size={16} className={String(text)} /></span></div><div className="mt-5 text-3xl font-bold tracking-[-.04em]">{value ?? '—'}</div><div className="mt-1 text-xs text-muted-foreground">{sub}</div></div>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]"><section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Queue pulse</h2><p className="mt-1 text-xs text-muted-foreground">Latest tickets entering the desk</p></div><Link href="/tickets" className="text-xs font-bold text-primary hover:underline">View all</Link></div><DataState loading={tickets.isLoading} error={tickets.error} empty={!tickets.data?.data?.length} retry={() => tickets.refetch()}><div className="divide-y divide-border">{(tickets.data?.data || []).slice(0, 5).map((ticket) => <TicketRow key={ticket.id} ticket={ticket} admin />)}</div></DataState></section><section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Weekly flow</h2><p className="mt-1 text-xs text-muted-foreground">Tickets created per day</p></div><TrendingUp size={17} className="text-accent-foreground" /></div><MiniChart values={a?.weeklyTrend?.map((item) => item.count) || []} labels={a?.weeklyTrend?.map((item) => item.date) || []} /></section></div></DataState></>;
}

function MiniChart({ values, labels, large = false }: { values: number[]; labels: string[]; large?: boolean }) {
  const max = Math.max(...values, 1);
  if (!values.length) return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No trend data available.</div>;
  return <div className={`${large ? 'h-60' : 'h-40'} flex items-end gap-2 pt-5`}>{values.map((value, i) => <div className="group flex min-w-0 flex-1 flex-col items-center gap-2" key={`${labels[i]}-${i}`}><div className="relative flex h-full w-full items-end"><div className="w-full rounded-t-sm bg-primary/75 transition-all duration-300 group-hover:bg-primary" style={{ height: `${Math.max(5, value / max * 100)}%` }}><span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[9px] text-background group-hover:block">{value}</span></div></div><span className="max-w-full truncate text-[9px] text-muted-foreground">{labels[i] ? labels[i].slice(5, 10) : ''}</span></div>)}</div>;
}

function TicketRow({ ticket, admin = false }: { ticket: AdminTicket | Ticket; admin?: boolean }) {
  const subject = ticket.description?.split('\n')[0] || 'Untitled request';
  return <Link href={`/tickets/${ticket.id}`} className="group flex items-center gap-3 py-3.5 transition-colors hover:bg-muted/50"><div className="mono w-[66px] shrink-0 text-[10px] font-bold text-muted-foreground">#{ticket.id.slice(0, 7)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold group-hover:text-primary">{subject}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><span>{admin && 'userName' in ticket ? ticket.userName : ticket.productName}</span><span className="h-1 w-1 rounded-full bg-border" /><span>{formatDate(ticket.createdAt)}</span></div></div><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /><ArrowUpRight size={15} className="hidden text-muted-foreground group-hover:text-primary sm:block" /></Link>;
}

function TicketsPage({ user }: { user: Profile }) {
  const admin = user.role === 'admin';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const adminParams = useMemo(() => ({ ...(search ? { search } : {}), ...(status ? { status: status as 'open' | 'in-progress' | 'resolved' } : {}), ...(priority ? { priority: priority as 'low' | 'medium' | 'high' | 'critical' } : {}), ...(category ? { category: category as 'bug' | 'feature' | 'billing' | 'account' | 'other' } : {}) }), [search, status, priority, category]);
  const userParams = useMemo(() => ({ ...(search ? { search } : {}), ...(status ? { status: status as 'open' | 'in-progress' | 'resolved' } : {}), ...(priority ? { priority: priority as 'low' | 'medium' | 'high' | 'critical' } : {}), ...(category ? { category: category as 'bug' | 'feature' | 'billing' | 'account' | 'other' } : {}) }), [search, status, priority, category]);
  const adminTickets = useGetAdminTickets(adminParams, { query: { queryKey: getGetAdminTicketsQueryKey(adminParams), enabled: admin } });
  const userTickets = useGetTickets(userParams, { query: { queryKey: getGetTicketsQueryKey(userParams), enabled: !admin } });
  const q = admin ? adminTickets : userTickets;
  const clear = () => { setSearch(''); setStatus(''); setPriority(''); setCategory(''); };
  return <><PageTitle eyebrow={admin ? 'Operations / queue' : 'My support'} title={admin ? 'Ticket queue' : 'Your requests'} description={admin ? 'Triage the next conversation that needs a human.' : 'Track every conversation with the support team.'} action={<Link href="/new-ticket" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-95"><Plus size={16} /> New ticket</Link>} /><div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm lg:flex-row"><div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by subject, product, or customer..." className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></div><div className="flex flex-wrap gap-2"><Select value={status} onChange={setStatus} placeholder="All statuses" options={['open', 'in-progress', 'resolved']} /><Select value={priority} onChange={setPriority} placeholder="All priorities" options={['critical', 'high', 'medium', 'low']} /><Select value={category} onChange={setCategory} placeholder="All categories" options={['bug', 'feature', 'billing', 'account', 'other']} />{(search || status || priority || category) && <Button variant="ghost" className="h-10" onClick={clear}><X size={15} /> Clear</Button>}</div></div><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs text-muted-foreground"><SlidersHorizontal size={14} /> {q.data?.data?.length ?? 0} conversations</div><div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Newest first</div></div><DataState loading={q.isLoading} error={q.error} empty={!q.data?.data?.length} retry={() => q.refetch()}><div className="overflow-hidden rounded-xl border border-border bg-card px-4 shadow-sm">{q.data?.data?.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} admin={admin} />)}</div></DataState></>;
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return <div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-[128px] appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-xs font-semibold outline-none focus:border-primary"><option value="">{placeholder}</option>{options.map((option) => <option value={option} key={option}>{displayStatus(option)}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-muted-foreground" /></div>;
}

function TicketDetailPage({ user }: { user: Profile }) {
  const { ticketId = '' } = useParams<{ ticketId: string }>();
  return user.role === 'admin' ? <AdminTicketDetailPage ticketId={ticketId} /> : <UserTicketDetailPage ticketId={ticketId} />;
}

function Conversation({ replies, user, onReply, pending }: { replies: TicketReply[]; user: Profile; onReply: (message: string) => void; pending: boolean }) {
  const [message, setMessage] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); if (!message.trim()) return; onReply(message.trim()); setMessage(''); };
  return <section className="rounded-xl border border-border bg-card shadow-sm"><div className="border-b border-border px-5 py-4"><div className="flex items-center gap-2 text-sm font-bold"><MessageCircle size={17} className="text-primary" /> Conversation <span className="text-xs font-normal text-muted-foreground">({replies.length})</span></div></div><div className="space-y-5 p-5">{replies.length ? replies.map((reply) => <div className={`flex gap-3 ${reply.authorRole === user.role ? '' : ''}`} key={reply.id}><Avatar name={reply.authorName} small /><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-xs font-bold">{reply.authorName}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{reply.authorRole}</span><span className="text-[10px] text-muted-foreground">{formatDate(reply.createdAt)} · {formatTime(reply.createdAt)}</span></div><div className="rounded-lg rounded-tl-none border border-border bg-background px-4 py-3 text-sm leading-6">{reply.message}</div></div></div>) : <div className="py-6 text-center text-sm text-muted-foreground">No replies yet. Start the conversation below.</div>}</div><form onSubmit={submit} className="border-t border-border bg-muted/30 p-4"><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write a reply..." rows={3} className="w-full resize-none rounded-md border border-input bg-card p-3 text-sm outline-none focus:border-primary" /><div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-muted-foreground">Replying as {user.name}</span><Button disabled={pending || !message.trim()}>{pending ? 'Sending…' : 'Send reply'}<Send size={14} /></Button></div></form></section>;
}

function AttachmentsList({ attachments }: { attachments?: { id: string; fileName: string; fileSize: number; url: string }[] }) {
  if (!attachments?.length) return null;
  return <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><Paperclip size={16} className="text-primary" /> Attachments</div><div className="space-y-2">{attachments.map((attachment) => <a href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id} className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:border-primary/50 hover:bg-muted"><FileTypeIcon /><span className="min-w-0 flex-1 truncate font-semibold">{attachment.fileName}</span><span className="text-[10px] text-muted-foreground">{Math.ceil(attachment.fileSize / 1024)} KB</span></a>)}</div></section>;
}
function FileTypeIcon() { return <span className="flex h-7 w-7 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">FILE</span>; }

function TicketMeta({ ticket, admin, agents, onStatus, onPriority, onAssign }: { ticket: AdminTicketDetail | UserTicketDetail; admin: boolean; agents?: Agent[]; onStatus?: (value: string) => void; onPriority?: (value: string) => void; onAssign?: (value: string) => void }) {
  const assignedName = 'assignedToName' in ticket ? ticket.assignedToName : undefined;
  return <aside className="space-y-4"><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ticket details</h3><MoreHorizontal size={17} className="text-muted-foreground" /></div><dl className="space-y-4 text-sm"><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</dt><dd>{admin ? <Select value={ticket.status} onChange={onStatus || (() => undefined)} options={['open', 'in-progress', 'resolved']} placeholder="Status" /> : <StatusBadge status={ticket.status} />}</dd></div><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Priority</dt><dd>{admin ? <Select value={ticket.priority} onChange={onPriority || (() => undefined)} options={['critical', 'high', 'medium', 'low']} placeholder="Priority" /> : <PriorityBadge priority={ticket.priority} />}</dd></div><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</dt><dd className="flex items-center gap-2 font-semibold"><Tag size={14} className="text-muted-foreground" />{ticket.category}</dd></div><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Created</dt><dd className="font-semibold">{formatDate(ticket.createdAt)}</dd></div><div><dt className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SLA due</dt><dd className={`font-semibold ${ticket.slaEscalated ? 'text-destructive' : ''}`}>{ticket.slaEscalated ? 'Escalated · ' : ''}{formatDate(ticket.slaDueAt)}</dd></div></dl></div>{admin && <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned agent</h3><div className="mb-3 flex items-center gap-3"><Avatar name={assignedName || 'Unassigned'} small /><div><div className="text-sm font-bold">{assignedName || 'Unassigned'}</div><div className="text-[11px] text-muted-foreground">{ticket.assignedTo ? 'Current owner' : 'Needs an owner'}</div></div></div><Select value={ticket.assignedTo || ''} onChange={onAssign || (() => undefined)} options={agents?.map((agent) => agent.id) || []} placeholder="Assign to…" /></div>}</aside>;
}

function AdminTicketDetailPage({ ticketId }: { ticketId: string }) {
  const detail = useGetAdminTicketDetail(ticketId, { query: { enabled: Boolean(ticketId), queryKey: getGetAdminTicketDetailQueryKey(ticketId) } });
  const agents = useGetAdminAgents({ query: { queryKey: ['/api/admin/agents'] } });
  const statusMutation = useUpdateTicketStatus();
  const priorityMutation = useUpdateTicketPriority();
  const assignMutation = useAssignTicket();
  const replyMutation = useCreateTicketReply();
  const ticket = detail.data?.data;
  const updateStatus = (status: string) => statusMutation.mutate({ ticketId, data: { status: status as 'open' | 'in-progress' | 'resolved' } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetAdminTicketDetailQueryKey(ticketId) }); queryClient.invalidateQueries({ queryKey: getGetAdminTicketsQueryKey({}) }); } });
  const updatePriority = (priority: string) => priorityMutation.mutate({ ticketId, data: { priority: priority as 'low' | 'medium' | 'high' | 'critical' } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAdminTicketDetailQueryKey(ticketId) }) });
  const assign = (agentId: string) => assignMutation.mutate({ ticketId, data: { agentId: agentId || null } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAdminTicketDetailQueryKey(ticketId) }) });
  const send = (message: string) => replyMutation.mutate({ ticketId, data: { message } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAdminTicketDetailQueryKey(ticketId) }) });
  return <><Link href="/tickets" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Back to queue</Link><DataState loading={detail.isLoading} error={detail.error} empty={!ticket} retry={() => detail.refetch()}>{ticket && <><PageTitle eyebrow={`Ticket #${ticket.id.slice(0, 8)}`} title={ticket.description?.split('\n')[0] || 'Support request'} description={`${ticket.userName} · ${ticket.userEmail} · ${ticket.productName}`} /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-5"><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-3 flex items-center gap-3"><Avatar name={ticket.userName} /><div><div className="text-sm font-bold">{ticket.userName}</div><div className="text-xs text-muted-foreground">{ticket.userEmail}</div></div></div><p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{ticket.description}</p></div><Conversation replies={ticket.replies || []} user={{ id: 'admin', name: 'Support agent', email: '', role: 'admin' }} onReply={send} pending={replyMutation.isPending} /><AttachmentsList attachments={ticket.attachments} /></div><TicketMeta ticket={ticket} admin agents={agents.data?.data} onStatus={updateStatus} onPriority={updatePriority} onAssign={assign} /></div></>}</DataState></>;
}

function UserTicketDetailPage({ ticketId }: { ticketId: string }) {
  const [, setLocation] = useLocation();
  const detail = useGetUserTicketDetail(ticketId, { query: { enabled: Boolean(ticketId), queryKey: getGetUserTicketDetailQueryKey(ticketId) } });
  const replyMutation = useCreateUserTicketReply();
  const rateMutation = useRateTicket();
  const ticket = detail.data?.data;
  const profile = useGetProfile({ query: { enabled: Boolean(localStorage.getItem(TOKEN_KEY)), queryKey: getGetProfileQueryKey() } });
  const send = (message: string) => replyMutation.mutate({ ticketId, data: { message } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserTicketDetailQueryKey(ticketId) }) });
  const rate = (rating: number) => rateMutation.mutate({ ticketId, data: { rating } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserTicketDetailQueryKey(ticketId) }) });
  return <><Link href="/tickets" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Back to requests</Link><DataState loading={detail.isLoading} error={detail.error} empty={!ticket} retry={() => detail.refetch()}>{ticket && <><PageTitle eyebrow={`Request #${ticket.id.slice(0, 8)}`} title={ticket.description?.split('\n')[0] || 'Support request'} description={`${ticket.productName} · opened ${formatDate(ticket.createdAt)}`} /><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-5"><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{ticket.description}</p></div><Conversation replies={ticket.replies || []} user={profile.data?.data || { id: '', name: 'You', email: '', role: 'user' }} onReply={send} pending={replyMutation.isPending} /><AttachmentsList attachments={ticket.attachments} />{ticket.status === 'resolved' && <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-accent-foreground" size={20} /><div className="flex-1"><h3 className="font-bold">How did we do?</h3><p className="mt-1 text-sm text-muted-foreground">A quick rating helps us improve future support.</p><div className="mt-4 flex gap-2">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} onClick={() => rate(rating)} className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-bold transition hover:border-primary hover:bg-[#fff0ea] ${ticket.rating === rating ? 'border-primary bg-[#ffe0d8] text-primary' : 'border-border'}`}>{rating}</button>)}</div></div></div></div>}</div><TicketMeta ticket={ticket} admin={false} /></div></>}</DataState></>;
}

function NewTicketPage() {
  const [, setLocation] = useLocation();
  const create = useCreateTicket();
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('other');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate({ data: { productName, description, category: category as 'bug' | 'feature' | 'billing' | 'account' | 'other', priority: priority as 'low' | 'medium' | 'high' | 'critical' } }, { onSuccess: (res) => setLocation(`/tickets/${res.data.id}`) }); };
  return <div className="mx-auto max-w-[850px]"><Link href="/tickets" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Back to tickets</Link><PageTitle eyebrow="Customer support" title="Tell us what happened." description="Give the support team enough context to make the first reply useful." /><form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold">Product or workspace</span><input required value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Billing dashboard" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label><label className="block"><span className="mb-2 block text-xs font-bold">Category</span><Select value={category} onChange={setCategory} options={['bug', 'feature', 'billing', 'account', 'other']} placeholder="Choose a category" /></label></div><div className="mt-5"><div className="mb-2 text-xs font-bold">Priority</div><div className="flex flex-wrap gap-2">{['low', 'medium', 'high', 'critical'].map((value) => <button type="button" key={value} onClick={() => setPriority(value)} className={`rounded-md border px-3 py-2 text-xs font-bold capitalize transition ${priority === value ? 'border-primary bg-[#fff0ea] text-primary' : 'border-border bg-background hover:border-primary/40'}`}>{value}</button>)}</div></div><label className="mt-5 block"><span className="mb-2 block text-xs font-bold">What can we help with?</span><textarea required minLength={10} value={description} onChange={(e) => setDescription(e.target.value)} rows={8} placeholder="Include what you expected, what happened, and any steps to reproduce the issue." className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-primary" /></label>{create.error && <div className="mt-5 rounded-md border border-[#efc2bb] bg-[#fff4f1] p-3 text-sm text-destructive">{errorText(create.error)}</div>}<div className="mt-7 flex items-center justify-end gap-3"><Link href="/tickets" className="rounded-md px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted">Cancel</Link><Button disabled={create.isPending}>{create.isPending ? 'Sending request…' : 'Submit request'}<Send size={15} /></Button></div></form></div>;
}

function CustomersPage() {
  const [search, setSearch] = useState('');
  const params = useMemo(() => search ? { search, page: 1, pageSize: 50 } : { page: 1, pageSize: 50 }, [search]);
  const users = useGetAdminUsers(params, { query: { queryKey: getGetAdminUsersQueryKey(params) } });
  const stats = useGetAdminUserTicketStats({ query: { queryKey: getGetAdminUserTicketStatsQueryKey() } });
  const rows = users.data?.data || [];
  const statMap = useMemo(() => new Map((stats.data?.data || []).map((stat) => [stat.userId, stat.ticketCount])), [stats.data]);
  return <><PageTitle eyebrow="Operations / people" title="Customers" description="A view of the people behind the queue." /><div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"><Search size={16} className="ml-2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers by name or email..." className="h-10 flex-1 bg-transparent text-sm outline-none" /></div><DataState loading={users.isLoading} error={users.error} empty={!rows.length} retry={() => users.refetch()}><div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="hidden grid-cols-[1.5fr_1.5fr_.7fr_.9fr] gap-4 border-b border-border bg-muted/50 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:grid"><span>Customer</span><span>Contact</span><span>Tickets</span><span>Joined</span></div>{rows.map((row) => <div key={row.id} className="grid gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[1.5fr_1.5fr_.7fr_.9fr] sm:items-center sm:gap-4"><div className="flex items-center gap-3"><Avatar name={row.name} small /><div><div className="text-sm font-bold">{row.name}</div><div className="text-xs text-muted-foreground sm:hidden">{row.email}</div></div></div><div className="hidden text-sm text-muted-foreground sm:block">{row.email}</div><div className="text-xs font-bold">{statMap.get(row.id) ?? 0} <span className="font-normal text-muted-foreground">requests</span></div><div className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</div></div>)}</div></DataState></>;
}

function AnalyticsPage() {
  const analytics = useGetAdminAnalytics({ query: { queryKey: getGetAdminAnalyticsQueryKey() } });
  const exportCsv = useExportAnalyticsCsv({}, { query: { enabled: false, queryKey: getExportAnalyticsCsvQueryKey({}) } });
  const exportPdf = useExportAnalyticsPdf({ query: { enabled: false, queryKey: getExportAnalyticsPdfQueryKey() } });
  const a = analytics.data?.data as AdminAnalytics | undefined;
  const download = (content: string | Blob, filename: string, type?: string) => { const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/csv' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); };
  return <><PageTitle eyebrow="Operations / measurement" title="Analytics" description="Understand the pressure on the desk and where to make the next improvement." action={<div className="flex gap-2"><Button variant="soft" disabled={exportPdf.isFetching} onClick={() => exportPdf.refetch().then((result) => { if (result.data) download(result.data, 'supportdesk-report.pdf', 'application/pdf'); })}><Download size={15} /> PDF</Button><Button variant="soft" disabled={exportCsv.isFetching} onClick={() => exportCsv.refetch().then((result) => { if (result.data) download(result.data, 'supportdesk-export.csv'); })}><Download size={15} /> CSV</Button></div>} /><DataState loading={analytics.isLoading} error={analytics.error} empty={!a} retry={() => analytics.refetch()}>{a && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total tickets" value={a.totalTickets} note="all time" icon={TicketIcon} /><Metric label="Avg. resolution" value={a.avgResolutionHours ? `${a.avgResolutionHours.toFixed(1)}h` : '—'} note="across resolved tickets" icon={Clock3} /><Metric label="Satisfaction" value={a.satisfaction.averageRating ? `${a.satisfaction.averageRating.toFixed(1)} / 5` : '—'} note={`${a.satisfaction.ratedTicketCount} rated tickets`} icon={Sparkles} /><Metric label="Critical share" value={a.totalTickets ? `${((a.criticalCount / a.totalTickets) * 100).toFixed(1)}%` : '—'} note="of all tickets" icon={Zap} /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]"><section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-4"><h2 className="font-bold">Ticket volume</h2><p className="mt-1 text-xs text-muted-foreground">Last 30 days</p></div><MiniChart values={a.monthlyTrend?.map((d) => d.count) || []} labels={a.monthlyTrend?.map((d) => d.date) || []} large /></section><section className="rounded-xl border border-border bg-card p-5 shadow-sm"><h2 className="font-bold">By category</h2><p className="mt-1 text-xs text-muted-foreground">Where customers need help</p><div className="mt-6 space-y-4">{(a.byCategory || []).map((item) => <div key={item.category}><div className="mb-1.5 flex justify-between text-xs font-semibold"><span className="capitalize">{item.category}</span><span>{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.count / Math.max(...(a.byCategory || []).map((x) => x.count), 1) * 100)}%` }} /></div></div>)}</div></section></div><div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="rounded-xl border border-border bg-card p-5 shadow-sm"><h2 className="font-bold">Top agents</h2><div className="mt-4 divide-y divide-border">{(a.topAgents || []).map((agent, i) => <div className="flex items-center gap-3 py-3" key={agent.agentId || agent.agentName}><span className="mono w-5 text-[10px] text-muted-foreground">0{i + 1}</span><Avatar name={agent.agentName} small /><span className="flex-1 text-sm font-semibold">{agent.agentName}</span><span className="text-xs font-bold">{agent.resolvedCount} resolved</span></div>)}</div></section><section className="rounded-xl border border-border bg-card p-5 shadow-sm"><h2 className="font-bold">Recent feedback</h2><div className="mt-4 space-y-3">{(a.satisfaction.recentFeedback || []).slice(0, 4).map((feedback) => <div className="rounded-md bg-muted/60 p-3" key={feedback.ticketId}><div className="flex items-center justify-between"><span className="text-xs font-bold text-primary">{feedback.rating} / 5</span><span className="text-[10px] text-muted-foreground">{formatDate(feedback.createdAt)}</span></div><p className="mt-2 text-xs leading-5 text-foreground/75">{feedback.feedbackText}</p></div>)}</div></section></div></>}</DataState></>;
}
function Metric({ label, value, note, icon: Icon }: { label: string; value: ReactNode; note: string; icon: typeof Activity }) { return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><Icon size={18} className="text-primary" /><div className="mt-5 text-2xl font-bold tracking-[-.03em]">{value}</div><div className="mt-1 text-xs font-semibold">{label}</div><div className="mt-1 text-[11px] text-muted-foreground">{note}</div></div>; }

function HelpPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(category ? { category: category as 'bug' | 'feature' | 'billing' | 'account' | 'other' | 'general' } : {}) }), [search, category]);
  const articles = useGetHelpArticles(params, { query: { queryKey: getGetHelpArticlesQueryKey(params) } });
  return <><PageTitle eyebrow="Self-serve support" title="Help center" description="Short answers for the things that come up often." action={<Link href="/new-ticket" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-95"><MessageCircle size={16} /> Ask the team</Link>} /><div className="mb-7 rounded-xl bg-[#222a3c] p-6 text-[#f8f2e7] sm:p-8"><div className="mono text-[10px] uppercase tracking-[.2em] text-primary">Find your answer</div><h2 className="mt-3 text-2xl font-bold tracking-[-.03em]">What are you trying to do?</h2><div className="relative mt-5 max-w-xl"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9da4b4]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search help articles..." className="h-12 w-full rounded-md border border-white/10 bg-white/[.08] pl-10 pr-4 text-sm text-white outline-none focus:border-primary" /></div></div><div className="mb-5 flex gap-2 overflow-x-auto pb-1"><button onClick={() => setCategory('')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${!category ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>All topics</button>{['general', 'bug', 'billing', 'account', 'feature'].map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold capitalize ${category === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{item}</button>)}</div><DataState loading={articles.isLoading} error={articles.error} empty={!articles.data?.data?.length} retry={() => articles.refetch()}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{articles.data?.data?.map((article) => <Link href={`/help/${article.slug}`} key={article.id} className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"><div className="flex items-center justify-between"><span className="rounded bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">{article.category}</span><ArrowUpRight size={15} className="text-muted-foreground transition group-hover:text-primary" /></div><h3 className="mt-5 font-bold leading-5 group-hover:text-primary">{article.title}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{article.body}</p><div className="mt-5 text-[10px] text-muted-foreground">Updated {formatDate(article.updatedAt)}</div></Link>)}</div></DataState></>;
}

function CustomersOrAudit() { return null; }

function SettingsPage({ user }: { user: Profile }) {
  const update = useUpdateProfile();
  const audit = useGetAuditLogs({ page: 1, pageSize: 6 }, { query: { enabled: user.role === 'admin', queryKey: getGetAuditLogsQueryKey({ page: 1, pageSize: 6 }) } });
  const [name, setName] = useState(user.name);
  const [notice, setNotice] = useState('');
  const save = (e: FormEvent) => { e.preventDefault(); update.mutate({ data: { name } }, { onSuccess: (result) => { queryClient.setQueryData(getGetProfileQueryKey(), result); setNotice('Profile saved.'); } }); };
  return <><PageTitle eyebrow="Workspace / account" title="Settings" description="Your profile and session preferences." /><div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_280px]"><form onSubmit={save} className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="mb-7 flex items-center gap-4 border-b border-border pb-6"><Avatar name={user.name} /><div><h2 className="font-bold">{user.name}</h2><p className="text-xs text-muted-foreground">{user.email}</p></div></div><label className="block max-w-md"><span className="mb-2 block text-xs font-bold">Display name</span><input value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label><div className="mt-5 max-w-md"><span className="mb-2 block text-xs font-bold">Email address</span><div className="flex h-11 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">{user.email}<span className="ml-auto text-[10px] font-bold uppercase">Managed</span></div></div>{notice && <div className="mt-5 text-sm font-semibold text-accent-foreground">{notice}</div>}<Button className="mt-7" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save profile'}<Check size={15} /></Button></form><div className="space-y-6"><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><h2 className="font-bold">Session</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">You are signed in with a browser session. Sign out when using a shared computer.</p><Button variant="soft" className="mt-5 w-full" onClick={() => { localStorage.removeItem(TOKEN_KEY); queryClient.clear(); window.location.href = '/login'; }}><LogOut size={15} /> Sign out</Button><div className="mt-6 border-t border-border pt-5"><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={15} className="text-accent-foreground" /> Session protected</div><p className="mt-2 text-[11px] text-muted-foreground">Bearer token stored locally for same-origin requests.</p></div></div>{user.role === 'admin' && <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Recent activity</h2><Activity size={16} className="text-primary" /></div><DataState loading={audit.isLoading} error={audit.error} empty={!audit.data?.data?.length} retry={() => audit.refetch()}><div className="space-y-3">{audit.data?.data?.slice(0, 6).map((log) => <div key={log.id} className="border-l-2 border-primary/40 pl-3"><div className="text-xs font-semibold">{log.action.replaceAll('_', ' ')}</div><div className="mt-1 text-[10px] text-muted-foreground">{log.resourceType} · {formatDate(log.createdAt)}</div></div>)}</div></DataState></section>}</div></div></>;
}

function CustomersRoute() { return null; }
function AdminRoute({ children, user }: { children: ReactNode; user: Profile }) { return user.role === 'admin' ? <>{children}</> : <Redirect to="/tickets" />; }

function ProtectedRouter({ user }: { user: Profile }) {
  return <Shell user={user}><Switch><Route path="/dashboard"><AdminRoute user={user}><Dashboard /></AdminRoute></Route><Route path="/tickets/:ticketId"><TicketDetailPage user={user} /></Route><Route path="/tickets"><TicketsPage user={user} /></Route><Route path="/customers"><AdminRoute user={user}><CustomersPage /></AdminRoute></Route><Route path="/analytics"><AdminRoute user={user}><AnalyticsPage /></AdminRoute></Route><Route path="/settings"><SettingsPage user={user} /></Route><Route path="/help"><HelpPage /></Route><Route path="/help/:slug"><HelpArticlePage /></Route><Route path="/new-ticket"><NewTicketPage /></Route><Route><Redirect to={user.role === 'admin' ? '/dashboard' : '/tickets'} /></Route></Switch></Shell>;
}

function HelpArticlePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const article = useGetHelpArticles({}, { query: { queryKey: getGetHelpArticlesQueryKey({}) } });
  const found = article.data?.data?.find((item) => item.slug === slug);
  return <><Link href="/help" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Back to help center</Link><DataState loading={article.isLoading} error={article.error} empty={!found} retry={() => article.refetch()}>{found && <article className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10"><div className="mb-5 flex items-center gap-3"><span className="rounded bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">{found.category}</span><span className="text-xs text-muted-foreground">Updated {formatDate(found.updatedAt)}</span></div><h1 className="text-3xl font-bold tracking-[-.04em]">{found.title}</h1><div className="prose prose-sm mt-8 max-w-none whitespace-pre-wrap leading-7 text-foreground/80">{found.body}</div></article>}</DataState></>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }

function Router() {
  const [location] = useLocation();
  const token = localStorage.getItem(TOKEN_KEY);
  const profile = useGetProfile({ query: { enabled: Boolean(token), queryKey: getGetProfileQueryKey(), retry: false } });
  void location;
  if (!token) return <Switch><Route path="/login" component={LoginPage} /><Route path="/" component={AuthPage} /><Route><Redirect to="/login" /></Route></Switch>;
  if (profile.isLoading) return <AuthPage />;
  if (profile.error || !profile.data?.data) return <Switch><Route path="/login" component={LoginPage} /><Route><SessionExpired /></Route></Switch>;
  return <Switch><Route path="/login"><Redirect to={profile.data.data.role === 'admin' ? '/dashboard' : '/tickets'} /></Route><Route path="/"><ProtectedRouter user={profile.data.data} /></Route></Switch>;
}
function SessionExpired() { const [, setLocation] = useLocation(); return <div className="flex min-h-[100dvh] items-center justify-center bg-[#222a3c] px-6 text-center text-[#f8f2e7]"><div className="max-w-sm"><AlertCircle size={30} className="mx-auto text-primary" /><h1 className="mt-5 text-2xl font-bold">Your session has ended.</h1><p className="mt-2 text-sm text-[#aeb4c0]">Sign in again to continue working in supportdesk.</p><Button className="mt-6" onClick={() => { localStorage.removeItem(TOKEN_KEY); setLocation('/login'); }}>Return to sign in</Button></div></div>; }

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Router /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;