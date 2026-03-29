Deploy the current branch to production. Follow these steps exactly in order:

1. **Stop local dev server** on port 3004:
   - Run: `lsof -ti:3004 | xargs kill -9 2>/dev/null || true`

2. **Check the build** compiles cleanly:
   - Run: `pnpm build`
   - If build fails, read the errors, fix them, and re-run `pnpm build`. Repeat until it passes.
   - If you cannot fix a build error after 3 attempts, stop and report the issue to the user.

3. **Switch GitHub auth** to the deploy account:
   - Run: `gh auth switch --user reelcasterdev`
   - Confirm it switched by running: `gh auth status`

4. **Create a feature branch** from the current branch:
   - Generate a branch name from the staged/unstaged changes (e.g., `feat/prediction-accuracy-tracking`, `fix/tide-scoring-bug`)
   - Run: `git checkout -b <branch-name>`
   - Stage all relevant changes and create a commit with a descriptive message

5. **Push and create a PR** against main:
   - Run: `git push -u origin <branch-name>`
   - Create a PR with: `gh pr create --base main --title "<short title>" --body "<brief description of changes>"`
   - Show the PR URL to the user

6. **Merge the PR**:
   - Run: `gh pr merge --merge --delete-branch`
   - Confirm merge succeeded

7. **Switch back to main** and pull latest:
   - Run: `git checkout main && git pull origin main`

8. **Restart the dev server**:
   - Run: `pnpm dev --port 3004` in the background

9. **Report** the final status: PR URL, merge status, current branch/commit, and confirm dev server is running.

IMPORTANT: Ask the user for confirmation before step 6 (merging). Show them the PR URL first so they can review if needed.
