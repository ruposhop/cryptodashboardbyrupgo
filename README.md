# Crypto Dashboard by Rupgo

🇬🇧 **English** · 🇪🇸 [Español](README.es.md)

**Your own crypto investment dashboard: private, free and yours.** It brings your Coinbase account and your wallets together on one screen and answers what actually matters:

- 💵 **What is everything I own worth today**, and how much have I put in? Total return, annualized return (IRR) and 24h / 7d / 30d change. **In dollars or euros**: it uses your Coinbase account's currency.
- 💸 **How much have fees cost me?** Purchase fees, price spread, coin-to-coin swaps and gas, plus where every dollar (or euro) you put in comes from.
- 📈 **How has it evolved?** Day-by-day chart since your first transaction, rebuilt automatically.
- 🪙 **Am I winning or losing with each coin?** Result per coin, price chart with your buys and sells marked, and all its transactions.
- 🔁 **Did my swaps between coins pay off?** Each swap compared with what you'd have if you hadn't made it, and how much went to fees.
- 🎯 **Am I above or below my break-even?** For the whole portfolio and for each coin: how far it could fall before you lose money, or how much it needs to rise.
- 🧾 **Tax report** using FIFO, per year, with a CSV for your accountant.
- 🔔 **Email alerts** for price targets, new wallet transactions and failed syncs.
- 🙈 Privacy mode, installable as a phone app, dark theme.

> **Read-only and private.** It can never move funds, it never asks for private keys or seed phrases, and everyone installs it with **their own** accounts (Supabase, Vercel, Coinbase…). Nobody else sees your data, not even the author of this repo.

> **Language:** the app's interface is in Spanish for now. Amounts are shown in your currency.

---

## 🎓 Made by Rubén Benarroch · [rupgo.com](https://rupgo.com)

I built this whole project with AI (Claude Code), without writing the code by hand. **At [rupgo.com](https://rupgo.com) I teach how to build real projects like this one with AI**, from the idea to a published product with a database, emails, payments and your own domain. If you like this dashboard and want to learn to build your own, [take a look at the courses](https://rupgo.com).

---

## ✨ Install it with your AI (recommended)

1. **Fork** this repo on GitHub (button at the top right) and clone it to your computer.
2. Open the folder with **Claude Code** (or another AI assistant) and tell it:

   > *I want to install my own Crypto Dashboard. Follow the guide in docs/INSTALAR-CON-IA.md.*

3. It will guide you step by step: create Supabase, get your Coinbase (read-only) and Zerion keys, add them to Vercel and log in for the first time. **Never paste keys into the chat**: they go straight into Vercel.

The guide your AI follows is [`docs/INSTALAR-CON-IA.md`](docs/INSTALAR-CON-IA.md) (in Spanish; your AI can follow it and talk to you in English). You can also follow it by hand.

## 🧰 What you need

Free accounts on [GitHub](https://github.com), [Vercel](https://vercel.com) (sign up with GitHub), [Supabase](https://supabase.com), [Resend](https://resend.com) and [Zerion API](https://zerion.io/api), plus your Coinbase account. **Cost: 0** on the free plans.

## 🛠️ Manual install (about 30 minutes)

1. **Copy the repo:** Fork it on GitHub.
2. **Supabase:** create a project, paste the whole [`supabase/schema.sql`](supabase/schema.sql) into **SQL Editor → Run** (once) and turn off **Authentication → Sign In / Providers → Allow new users to sign up**. Note the URL, the *publishable key* and the *secret key* (Project Settings → API Keys).
3. **Keys:**
   - **Coinbase:** [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) → API Keys → *secret API key* with **View only (read-only)** and *Opt-out of IP allowlisting*. Save the API key ID and the Secret (shown only once).
   - **Zerion:** an API key (free plan).
   - **Resend:** an API key. Without your own domain, use `onboarding@resend.dev` as the sender (it only delivers to your Resend account's email).
4. **Vercel:** import your fork and, before deploying, create the variables from [`.env.example`](.env.example) in **Settings → Environment Variables** (mark the secret ones as *Sensitive*):

| Variable | Value |
|---|---|
| `ALLOWED_EMAIL` | Your email (the only one that can log in) |
| `NEXT_PUBLIC_APP_NAME` | The name you want to see (optional) |
| `NEXT_PUBLIC_REPO_URL` | Link to the code on the home page (optional; defaults to this repo) |
| `CURRENCY` | `USD` or `EUR` (optional; if not set, it uses your Coinbase account's currency) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| `RESEND_API_KEY` | Your Resend key |
| `EMAIL_FROM` | `Name <you@yourdomain.com>` or `Name <onboarding@resend.dev>` |
| `COINBASE_API_KEY_NAME` | The Coinbase *API key ID* |
| `COINBASE_API_PRIVATE_KEY` | The Coinbase *Secret* |
| `ZERION_API_KEY` | Your Zerion key |
| `CRON_SECRET` | A long random string (`openssl rand -hex 32`) |

5. **Deploy and log in:** open your URL, request access with your email (you get a link and a code), add your wallet in **Ajustes** (Settings) and press **↻**. The first sync imports your whole history and rebuilds the chart.

On your phone you can install it: in Safari, **Share → Add to Home Screen**. In the installed app, log in with the **code** from the email.

## ⏱️ Hourly sync (optional, free)

Vercel syncs once a day on its own, and you can always press ↻. For hourly data, this repo includes a GitHub Actions workflow:

1. In your fork: **Actions** → enable workflows.
2. **Settings → Secrets and variables → Actions**: create `SYNC_URL` (`https://YOUR-DOMAIN/api/cron/sync`; it must be publicly reachable, e.g. your own domain) and `CRON_SECRET` (the same as in Vercel).
3. Test it in **Actions → Sincronización cada hora → Run workflow**.

## 🔄 Get the updates

This repo keeps getting new features. To get them:

1. In your GitHub fork, press **Sync fork → Update branch** (or ask your AI). Vercel redeploys automatically.
2. If an update changes the database, there will be a new file in [`supabase/updates/`](supabase/updates): run it once in Supabase → SQL Editor.

## 🧮 How it calculates

- **Currency:** your Coinbase account's currency (dollars, euros…), detected on the first sync. You can force it with `CURRENCY`. It's fixed: if you change it later, the history has to be imported again.
- **Money put in** = what you paid for your purchases (fees included) + incoming transfers from outside your accounts − sales to cash − outgoing transfers. Moving funds between your Coinbase and your wallet doesn't count.
- **Return** = value today − money put in. All fees are already included. **Annualized (IRR)** takes into account when you made each contribution.
- **Break-even** for each coin = what you paid for what you hold (FIFO) ÷ amount. Above it you're in profit; below it, at a loss.
- **Taxes:** FIFO per year; staking rewards count at their value when received. It's a guide only: check it with your tax advisor.

## 🔒 Security

- The Coinbase API key is **read-only** and lives in your Vercel variables; only the server uses it.
- Only your email can log in (one-time link or code, with rate limits). The database uses RLS: nobody else can read it.
- No key is stored in the code. If you see one in a fork, it's a mistake by whoever pushed it: rotate it.

## 💻 Development

```bash
npm install
```

```bash
vercel env pull .env.local
```

```bash
npm run dev
```

Stack: Next.js 16, TypeScript, Tailwind CSS v4, Recharts, Supabase, Vercel, Resend. If you develop with Claude Code, read [`CLAUDE.md`](CLAUDE.md).

## 📄 License

[MIT](LICENSE): you can use, modify and share it freely, keeping the copyright notice.

---

Found it useful? Give the repo a ⭐ and, if you want to learn to build projects like this with AI, see you at **[rupgo.com](https://rupgo.com)**. — *Rubén Benarroch*
