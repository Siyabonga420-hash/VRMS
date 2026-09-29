# Pace Car Rental — Vehicle Rental Management System (VRMS)

A full-stack web app: vanilla HTML/CSS/JS frontend, Node.js/Express backend,
Neon (serverless Postgres) database. Both frontend and backend run as
**one** Node app, so they deploy together as a single Render Web Service.

## What's included

- **Customers** can register, log in, browse vehicles, book, pay (simulated),
  and see their own bookings and notifications.
- **Staff/Admin** can manage vehicles, update booking statuses, record
  returns, schedule/complete maintenance, send announcements, and view a
  revenue/booking report.
- Roles: `customer`, `staff`, `admin` (stored in the `users` table).

## Project structure

```
VRMS/
  server.js            <- Express app entry point (serves API + frontend)
  db.js                <- Neon Postgres connection pool
  schema.sql            <- Run this once against your Neon database
  .env.example          <- Copy to .env for local development
  middleware/auth.js    <- JWT login check + role check
  routes/               <- One file per feature (auth, vehicles, bookings, ...)
  public/               <- The whole frontend (plain HTML/CSS/JS)
```

## 1. Set up your Neon database

1. Go to https://neon.tech and create a free account / project.
2. In your project dashboard, open **SQL Editor**.
3. Paste the entire contents of `schema.sql` and run it. This creates all
   the tables and adds three sample vehicles.
4. Go to **Connection Details** (or "Connect") and copy the connection
   string. It looks like:
   ```
   postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require
   ```
   Keep this handy — it's your `DATABASE_URL`.

## 2. Run it locally (optional, but recommended before deploying)

1. Install [Node.js](https://nodejs.org) 18+ if you don't have it.
2. In the `VRMS` folder:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in:
   ```
   DATABASE_URL=<your Neon connection string>
   JWT_SECRET=<any long random string>
   ```
4. Start the app:
   ```
   npm start
   ```
5. Open http://localhost:3000 in your browser.

## 3. Create your first admin account

New sign-ups through the website always become `customer` accounts (this is
intentional — the public shouldn't be able to make themselves an admin).
To create your first staff/admin account, run this once in Neon's SQL Editor
**after** registering that account normally through the website:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Log out and log back in afterward so your login token picks up the new role.

## 4. Push the code to GitHub

Render deploys from a Git repository.

```
git init
git add .
git commit -m "Initial VRMS commit"
```
Create a new repository on GitHub, then follow GitHub's instructions to
push (`git remote add origin ...`, `git push -u origin main`).

Make sure `.env` is NOT committed — it's already listed in `.gitignore`.

## 5. Deploy on Render

1. Go to https://render.com and sign in (GitHub login is easiest).
2. Click **New +** → **Web Service**.
3. Connect the GitHub repository you just pushed.
4. Fill in:
   - **Name:** `pace-car-rental` (or anything you like)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables**, add:
   - `DATABASE_URL` = your Neon connection string
   - `JWT_SECRET` = the same long random string you used locally (or a new one)
   - Do **not** set `PORT` — Render provides this automatically.
6. Click **Create Web Service**.

Render will install dependencies, start the server, and give you a public
URL like `https://pace-car-rental.onrender.com`. Since `server.js` serves
both the API and the frontend, that one URL is your whole website.

## 6. After deploying

- Visit your Render URL, register an account, then promote it to `admin`
  using the SQL command in step 3 (run it in Neon's SQL Editor, same as
  before — it's the same database either way).
- Add real vehicles through the Admin Panel instead of the sample data.

## Notes on scope / things to extend later

- **Payments** are simulated (no real card processor). To take real
  payments, swap the logic in `routes/payments.js` for a provider like
  Stripe or PayFast — the rest of the app (booking status flow, database
  schema) doesn't need to change.
- **Vehicle images** currently use plain URLs. For real photo uploads,
  you'd add a file-upload endpoint and store images somewhere like
  Cloudinary or an S3-compatible bucket, then save the returned URL into
  `vehicles.image_url`.
- **Free tier note:** both Render's and Neon's free tiers can "sleep"
  after inactivity — the first request after a while may take a few
  seconds to wake up. This is normal.
