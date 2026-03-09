# BudgetFlow — AI-Powered Household Budget Tracker

Chat your spending. AI categorizes it automatically.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database + Auth**: Supabase (Postgres + Row Level Security)
- **AI**: Claude Sonnet via Anthropic API (server-side)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (free tier)

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/budgetflow.git
cd budgetflow
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name, set a database password, pick a region close to you
3. Wait for the project to finish setting up (~2 min)

### 3. Run the Database Schema

1. In Supabase Dashboard → **SQL Editor** → **New Query**
2. Copy the entire contents of `supabase/schema.sql` and paste it
3. Click **Run** — this creates all tables, indexes, RLS policies, and triggers

### 4. Configure Auth

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Make sure **Email** is enabled (it is by default)
3. Optional: Under **Authentication** → **Settings**, disable "Confirm email" for faster testing

### 5. Get Your API Keys

**Supabase:**
1. Dashboard → **Settings** → **API**
2. Copy `Project URL` and `anon/public` key

**Anthropic:**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key

### 6. Set Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-api...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 7. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/budgetflow.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel domain)
4. Click **Deploy**

### 3. Update Supabase Auth Settings

After deploying, go to Supabase → **Authentication** → **URL Configuration**:
- Set **Site URL** to your Vercel domain: `https://budgetflow.vercel.app`
- Add `https://budgetflow.vercel.app/**` to Redirect URLs

---

## Project Structure

```
budgetflow/
├── app/
│   ├── (auth)/              # Login & Signup pages
│   │   ├── login/page.js
│   │   └── signup/page.js
│   ├── (dashboard)/         # Authenticated pages (shared layout with nav)
│   │   ├── layout.js        # Nav bar, user avatar, logout
│   │   ├── dashboard/page.js
│   │   ├── budget/page.js   # Chat + category overview
│   │   ├── history/page.js  # Transaction history
│   │   └── setup/page.js    # Settings
│   ├── api/
│   │   ├── auth/
│   │   │   ├── signup/route.js
│   │   │   ├── login/route.js
│   │   │   └── logout/route.js
│   │   └── parse-spending/route.js  # Claude API (server-side)
│   ├── lib/
│   │   ├── supabase-server.js    # Server-side Supabase client
│   │   ├── supabase-browser.js   # Client-side Supabase client
│   │   └── db.js                 # All database query functions
│   ├── globals.css
│   ├── layout.js
│   └── page.js              # Redirects to /dashboard
├── supabase/
│   ├── schema.sql            # Full database schema (run this first!)
│   └── seed.sql              # Reference for default data
├── middleware.js              # Auth middleware (redirects)
├── tailwind.config.js
├── package.json
└── .env.local.example
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (name, income, onboarding status) |
| `categories` | Budget categories per user (slug, name, emoji, budget, color) |
| `transactions` | All spending entries (amount, category, date, description) |
| `recurring_expenses` | Monthly bills that auto-populate |

All tables have Row Level Security — users can only access their own data.

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| Vercel (Hobby) | $0 |
| Supabase (Free) | $0 |
| Anthropic API | ~$0.01-0.05/user/month |
| **Total (solo use)** | **~$0-1/month** |

## Next Steps to Complete

The dashboard page is fully built. The remaining pages (Budget/Chat, History, Setup)
need their UI components ported from the prototype. The architecture is ready —
they just need to call the functions in `lib/db.js` instead of `window.storage`.

Key remaining work:
- [ ] Port the chat interface to Budget page (use `/api/parse-spending`)
- [ ] Port history view with month filter + edit/delete
- [ ] Port setup page (categories, recurring, income)
- [ ] Build onboarding wizard as a page/modal for new users
- [ ] Add email verification flow (optional)
