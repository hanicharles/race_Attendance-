# Cloudflare Pages Deployment Guide

We have pushed your code to your GitHub repository: [race_Attendance-](https://github.com/hanicharles/race_Attendance-). Since Cloudflare Pages runs in a serverless environment (read-only filesystem), you need to connect it to a hosted SQLite database (such as Turso).

Here is exactly how to set it up:

---

## Step 1: Create a Turso Database (Free)
Cloudflare requires a hosted database because serverless Workers cannot store dynamic files locally. Turso is a serverless SQLite database with a generous free tier.

1. Go to [Turso](https://turso.tech) and sign up.
2. Create a new database (e.g., name it `race-attendance`).
3. Copy your database connection details:
   * **Connection URL**: e.g., `libsql://race-attendance-yourname.turso.io`
   * **Auth Token**: Generate a token from the Turso dashboard or CLI.

---

## Step 2: Deploy to Cloudflare Pages
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **Workers & Pages** -> **Create** -> **Pages** (under the Pages tab).
3. Click **Connect to Git** and select your repository: `hanicharles/race_Attendance-`.
4. Set up the **Build Settings**:
   * **Framework Preset**: Choose **Vite** (or `Other` / `None`).
   * **Build command**: `npm run build`
   * **Build output directory**: `.output/public`
5. Click **Save and Deploy**.

---

## Step 3: Add Database Environment Variables in Cloudflare
After the first build starts, add the database keys so the app can initialize:

1. In your Cloudflare Pages project, go to the **Settings** tab.
2. Go to **Variables and Secrets** (under Environment Variables).
3. Click **Add variable** and define the following variables under both **Production** and **Preview**:
   * `TURSO_CONNECTION_URL` = (Your Turso connection URL, e.g., `libsql://...`)
   * `TURSO_AUTH_TOKEN` = (Your Turso Auth Token)
4. Go to **Settings** -> **Functions** -> **Compatibility flags** and ensure that `nodejs_compat` is enabled (needed for database connections).
5. Go to **Deployments**, click the three dots next to your latest deployment, and click **Retry deployment**.

---

Once completed, the app will automatically create all tables, seed the teacher account (`RACE@reva.edu.in`), seed the 26 student logins, and insert the 2,500+ attendance records into your new Turso database!
