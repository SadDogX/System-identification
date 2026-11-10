# Rollout plan for interval-based employee schedule

## Current safety status

The repository does not contain any verified live backfill execution for `WorkScheduleEntry` -> `WorkScheduleInterval`. The script `app/api/prisma/backfill-work-schedule-intervals.ts` is intentionally dry-run by default; it only writes when `--apply` is passed.

No live `--apply` invocation was found in this checkout or in the recorded local execution path. Because of that, there are no reliable production counts for `sourceRows`, `intervalRows`, or the reduction percentage to report from real data.

## Unsafe rollout that must be avoided

If the app starts reading `WorkScheduleInterval` before a verified backfill completes, users with legacy daily rows will see an empty schedule in the UI. The code path is:

1. React reads `/api/.../work-schedule/intervals`
2. the API returns only `WorkScheduleInterval` rows
3. if `WorkScheduleInterval` has not been populated yet, the view is empty even though `WorkScheduleEntry` still contains data

This is why the rollout must remain staged and compatibility-safe.

## Required order

1. Dry run only
   - run `node prisma/backfill-work-schedule-intervals.ts`
   - confirm the script reports the expected `sourceRows`, `intervalRows`, and `estimatedReduction`
   - do not apply anything to production

2. Validate on a disposable copy
   - clone or snapshot the live database
   - run the backfill in that copy with `--apply`
   - compare `WorkScheduleEntry` and grouped interval output for the same user/year slice

3. Verify parity
   - compare daily rows vs interval-expanded rows for a sample of employees and years
   - check leap-year and year-bound behavior, deletions, split/merge logic, and permission checks

4. Enable interval reads only after parity is accepted
   - keep `WorkScheduleEntry` as the reference source until parity checks pass
   - keep the compatibility fallback in the API until the interval table is fully verified

5. Only then cut over production
   - enable interval reads for the target cohort
   - leave the legacy daily table intact as rollback until the final cutover is complete

## Active compatibility guard

The API does not assume the interval table is already populated. When no interval rows are present for the requested range, it falls back to the legacy `WorkScheduleEntry` rows and groups them into interval ranges for the same UI contract.

This prevents empty schedules during staged rollout, while allowing the system to switch to the interval model once the live data has been backfilled and verified.

## Acceptance gate before final cutover

The final production migration must be blocked until all of the following are true:

- dry run on a copy of production has been reviewed
- parity checks are green on a backup/test clone
- migration log and rollback procedure are stored in the operations notes
- no unexpected gaps or overlaps are present in interval data
- business and permission tests are green for the target cohort

## Counts and current status

No exact production counts are available for this repository state, because no real-data backfill or live-migration run was executed here. Any final `before/after` reduction numbers must be captured only from a validated snapshot or clone of the production database, not from the live system during rollout.

## Local demo data

For a disposable local/demo database, apply the additive schema migration first, then run the base and demo seeds:

1. `npm run db:migrate`
2. `npm run db:seed`
3. `npm run db:demo`

The demo seed creates sample interval schedules for selected demo employees. It skips an employee if either interval or legacy daily schedule rows already exist, so rerunning the demo seed does not overwrite that employee's schedule. These fixtures are for local/demo UI validation only and are not a production backfill.
