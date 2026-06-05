# Branch Workflow Notes

Use this workflow to keep changes isolated from `main`.

## Branch Rules

- Do feature or documentation work on a topic branch.
- Keep `main` reserved for reviewed and merged work.
- Fetch before starting a new change set.
- Push only the active branch.

## Local Commands

```bash
git fetch origin
git switch dias
git status -sb
```

## Commit Hygiene

- Keep commits focused on one logical change.
- Use clear prefixes such as `docs:`, `fix:`, `test:`, or `chore:`.
- Review `git diff --staged` before each commit.
- Run relevant checks before pushing.

## Push

```bash
git push origin dias
```
