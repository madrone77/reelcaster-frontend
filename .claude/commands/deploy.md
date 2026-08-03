Deploy the current branch to production. Follow these steps exactly in order.
Do NOT ask for confirmation at any step — run the full pipeline automatically.

**Read this first — the two facts that make this command work:**

1. The GitHub repo is `madrone77/reelcaster-frontend`. **Merging to `main` does
   NOT deploy anything.** There is no Vercel git integration. If you stop after
   merging, nothing ships. Step 7 is the deploy.
2. `www.reelcaster.com` is served by Vercel project **`reelcaster-frontend`**
   under scope **`casey-1425s-projects`**. There is a decoy project,
   `reelcaster-frontend-web` under `reelcaster-devs-projects`, which looks right
   (old prod deploys, `-git-main-` aliases, and its project id appears in
   CLAUDE.md and any committed `.vercel/project.json`). Deploying to the decoy
   succeeds and changes nothing on the live domain.

Do NOT `gh auth switch` to `reelcasterdev` — that account is not configured in
`gh` on this machine and never has been. Stay as `madrone77`, which owns the
repo. Do NOT try to push to `reelcasterdev/reelcaster-frontend`; it is a stale
mirror and this machine has no credential for it.

1. **Stop local dev server** on port 3004:
   - Run: `lsof -ti:3004 | xargs kill -9 2>/dev/null || true`

2. **Typecheck** (the cheap gate):
   - Run: `npx tsc --noEmit`
   - Fix any errors before continuing.
   - Note: a local `pnpm build` needs placeholder env vars
     (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`,
     `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`) or it dies at "Collecting page
     data" on module-scope clients. That failure is environmental, not a code
     defect — Vercel's build has the real env.

3. **Create a feature branch** from the current branch:
   - Generate a branch name from the changes (e.g. `feat/prediction-accuracy`).
   - Run: `git checkout -b <branch-name>`
   - Stage the relevant changes and commit with a descriptive message.

4. **Push and open a PR** against main:
   - Run: `git push -u origin <branch-name>`
   - `gh pr create --repo madrone77/reelcaster-frontend --base main --title "<short title>" --body "<description>"`
   - Show the PR URL.

5. **Merge the PR** immediately (do NOT wait for confirmation):
   - `gh pr merge --repo madrone77/reelcaster-frontend --merge --delete-branch`

6. **Update local main**:
   - `git checkout main && git pull origin main`
   - If `main` is checked out in another worktree, skip the checkout and just
     fetch — do not stash or discard anyone's uncommitted work to force it.

7. **Deploy to production** — this is the step that actually ships:
   - Clone main fresh into a scratch dir (never deploy from a working checkout;
     `vercel link` overwrites `.env.local`):
     ```
     git clone --depth 1 --branch main https://github.com/madrone77/reelcaster-frontend.git <scratch>/vbuild
     cd <scratch>/vbuild && pnpm install --frozen-lockfile
     npx vercel@latest link --yes --scope casey-1425s-projects --project reelcaster-frontend
     npx vercel@latest deploy --prod --yes --scope casey-1425s-projects
     ```
   - The CLI is already authenticated on this machine as `reelcasterdev-1258`
     (`npx vercel@latest whoami` to confirm). It can see both scopes.
   - Confirm the link landed on the right project before deploying:
     `npx vercel ls` must print `casey-1425s-projects/reelcaster-frontend`.
     `--scope` alone does not override an existing wrong link.
   - If the domain doesn't follow the deploy:
     `npx vercel@latest promote <deployment-url> --scope casey-1425s-projects --yes`

8. **Verify on the real domain** (not the deployment URL, which is auth-walled):
   - `curl -s -o /dev/null -w "%{http_code}\n" https://www.reelcaster.com/<changed-route>`
   - For a signed-in route, a 200 or a redirect to `/login` both mean it shipped.
   - To confirm a client-component change, grep the App Router page chunk from
     the served HTML (`grep -o 'static/chunks/app/[^"]*\.js'`) and curl that —
     the top-level `<script src>` tags are only framework chunks.

9. **Restart the dev server**: `pnpm dev --port 3004` in the background.

10. **Report**: PR URL, merge commit, production deployment URL, and the verified
    HTTP status on `www.reelcaster.com`. Do not claim something is live until
    step 8 has actually returned a non-404 on the real domain.
