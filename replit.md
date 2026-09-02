# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) — SupportDesk app

## Artifacts

- **api-server** — Express 5 REST API serving `/api`
- **supportdesk** — Expo mobile app at `/` (SupportDesk ticket manager)

## SupportDesk Mobile App

A production-ready mobile ticket management system with:
- JWT authentication with admin-created accounts and login using `SESSION_SECRET`
- Admin/user role separation, ticket assignment, and agent workload summaries
- Ticket creation for administrator-approved products, with description, category, priority, and compressed image attachments
- Camera and gallery attachment capture; images are limited to 5 MB and stored as base64 data URLs
- Ticket history with stats, status filtering, admin search, sorting, bounded pagination, and detail views
- Push-token registration plus ticket/reply/status notification delivery through Expo’s push endpoint
- Configurable SLA due dates (Critical 4h, High 24h, Medium 72h, Low 168h) and a 15-minute overdue escalation check
- Resolution ratings (1–5) and optional feedback, with average agent ratings in the admin user-activity view
- Status types: `open`, `in-progress`, `resolved`
- Design: Deep navy (#1e3a5f) primary, blue (#3b82f6) accent, slate background

### Screens
- `(auth)/login` — Login with email + password, show/hide toggle
- `(tabs)/index` — New Ticket form with validation + success toast
- `(tabs)/history` — Ticket list with stats row, filter chips, skeleton loading, pull-to-refresh
- `(tabs)/user-ticket/[id]` — Ticket conversation, attachments, and resolution feedback
- `(admin)/dashboard` — Ticket operations with SLA indicators, search, filters, and sorting
- `(admin)/ticket/[id]` — Assignment, replies, status updates, and attachment review
- `(admin)/user-stats` — Customer activity plus agent open-ticket and rating summaries
- `(admin)/access` — User search, customer account creation, and product access approval controls

## Database Schema

- **users** — `id`, `name`, `email`, `passwordHash`, `role`, `pushToken`, `createdAt`
- **tickets** — ticket details, status, priority, category, assignee, SLA fields, resolution timestamp, rating, and feedback
- **ticket_replies** — role-stamped ticket conversations
- **attachments** — image metadata and data URLs linked to tickets
- **user_products** — customer product grants with pending/approved/disapproved status, optional access dates, and approver metadata

## Android Builds

- `artifacts/supportdesk/app.json` contains the Android package, adaptive-icon, permission, and version-code configuration.
- `artifacts/supportdesk/eas.json` defines a `preview` APK profile for internal testing and a `production` Android App Bundle profile.
- The current app is available through the Expo workflow for development and Expo Go testing.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Environment Secrets Required

- `SESSION_SECRET` — Used for JWT signing (min 32 chars)
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
