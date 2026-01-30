# Tolstoy AI Auto-Optimizer

## Overview

This is a high-end e-commerce video A/B testing dashboard called "Tolstoy AI Auto-Optimizer." The application enables brands to run and analyze video A/B tests to optimize conversion rates. Users can create tests with multiple video variants, track performance metrics over time, and receive AI-powered insights on which variants perform best.

The platform follows a modern full-stack architecture with a React frontend and Express backend, connected to a PostgreSQL database for persistent storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion for UI transitions
- **Build Tool**: Vite

The frontend is organized in `client/src/` with:
- `pages/` - Route-level components (Dashboard, TestDetail)
- `components/` - Reusable UI components including shadcn/ui primitives
- `hooks/` - Custom React hooks for data fetching and state
- `lib/` - Utility functions and query client configuration

### Backend Architecture
- **Framework**: Express 5 on Node.js
- **Language**: TypeScript with tsx for development
- **API Design**: RESTful JSON API under `/api/` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL dialect

The server is organized in `server/` with:
- `index.ts` - Express app setup and middleware
- `routes.ts` - API route handlers
- `storage.ts` - Database access layer implementing IStorage interface
- `db.ts` - Database connection pool

### Data Layer
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` - shared between frontend and backend
- **Migrations**: Drizzle Kit with `drizzle-kit push` command

Core tables:
- `tests` - A/B test configurations and summary stats
- `variants` - Video variants for each test
- `analytics` - Time-series performance data per variant

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts` - Drizzle table definitions and Zod validation schemas
- `routes.ts` - API route contracts with Zod schemas for type-safe requests/responses

### Build System
- Development: `tsx server/index.ts` with Vite dev server middleware
- Production: Custom build script using esbuild (server) and Vite (client)
- Output: `dist/` directory with `index.cjs` (server) and `public/` (static assets)

## External Dependencies

### Database
- **PostgreSQL** - Primary data store, connection via `DATABASE_URL` environment variable
- **connect-pg-simple** - Session storage (available but not currently used)

### AI Integrations (Replit-specific)
Located in `server/replit_integrations/`:
- OpenAI API for chat completions and image generation
- Voice/audio processing utilities
- Batch processing with rate limiting

Environment variables:
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`

### UI Component Libraries
- Radix UI primitives (dialogs, menus, tabs, etc.)
- shadcn/ui components built on Radix
- Lucide React icons

### Data Handling
- Zod for runtime validation
- drizzle-zod for schema-to-validation integration
- date-fns for date formatting