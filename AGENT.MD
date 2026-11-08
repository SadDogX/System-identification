# AGENT DEVELOPMENT RULES

## 1. General Principles
- Inspect the existing codebase before making changes.
- Understand the current architecture, data flow, dependencies, and conventions.
- Reuse existing components, services, utilities, and patterns.
- Avoid unnecessary refactoring and architectural changes.
- Do not duplicate business logic.
- Modify only files relevant to the requested task.
- Never invent requirements or silently change existing behavior.
- Prioritize correctness, maintainability, and minimal implementation.

## 2. Token and Execution Efficiency
- Keep responses and execution steps concise.
- Avoid unnecessary explanations and repeated summaries.
- Do not reread files or repeat searches when the required information is already available.
- Use targeted searches and inspect only relevant code.
- Avoid dumping entire files or large directory listings.
- Prefer focused code changes over rewriting entire modules.
- Do not run redundant tests or commands.

## 3. Mandatory Planning
Before implementation:
1. Identify the affected modules and files.
2. Trace relevant frontend, backend, API, database, and permission dependencies.
3. Identify existing reusable functionality.
4. Define the minimum required changes.
5. Check for potential side effects.

For complex tasks, provide a short implementation plan before making changes.

Do not ask for approval for routine implementation steps unless explicitly required.

## 4. Terminal Execution and PowerShell Rules

### Command Limits and Retries
- Never repeat an identical command after it fails.
- Maximum 2 attempts per command. A second attempt is allowed only after inspecting the error, identifying the cause, and correcting it.
- If the same error occurs twice, STOP execution immediately.
- Do not repeatedly retry failures caused by environment, permissions, port conflicts, missing dependencies, unavailable services, or other unchanged conditions.
- Before any retry, inspect the complete error and determine the root cause; change the command or environment only to address that cause.
- After 2 failed attempts, report the command executed, exact error, identified or suspected root cause, and proposed corrective action.
- Never claim a command succeeded without checking its exit code and verifying the expected result.

### PowerShell Compatibility
- Use syntax compatible with the installed PowerShell version; do not assume PowerShell 7 operators or features work in Windows PowerShell 5.1.
- Prefer short, targeted, independent PowerShell commands over long command chains.
- Avoid unsupported shell operators and handle errors and exit codes explicitly.

### Resource and Environment Safety
- Minimize terminal calls; reuse output already retrieved and do not repeat completed checks without a new reason.
- Avoid unnecessary directory listings and repeated file searches; use targeted paths and patterns.
- Never execute destructive commands without explicit justification.
- Never terminate processes or containers without identifying them first.
- Never delete files, migrations, databases, or project data without explicit justification.
- Never change ports, environment variables, or configuration files unnecessarily.
- Do not repeatedly restart services when the root cause is unknown.

## 5. Database and Prisma Rules
- Inspect the current Prisma schema before changing database models.
- Preserve existing relations, constraints, and data integrity.
- Do not create duplicate models or relations.
- Do not reset, drop, or truncate databases.
- Do not use destructive migrations without explicit authorization.
- Review generated migration SQL before applying migrations.
- Verify Prisma Client generation after schema changes.
- Handle database transactions and connection lifecycle correctly.

## 6. Backend Rules
- Follow the existing modular monolith architecture.
- Keep controllers, services, repositories, and validation responsibilities separated according to existing conventions.
- Enforce authorization on the backend.
- Never rely exclusively on frontend role-based visibility.
- Validate incoming data.
- Handle errors consistently.
- Avoid duplicated business rules.

## 7. Frontend Rules
- Use existing React and TypeScript conventions.
- Reuse existing UI components and design tokens.
- Avoid duplicated JSX and business logic.
- Keep components modular and reusable.
- Maintain existing themes and responsive behavior.
- Handle loading, empty, success, and error states.
- Do not hardcode roles, permissions, or organizational relationships when they are already defined in the backend.

## 8. Git Safety
- Never execute destructive Git operations without explicit authorization.
- Do not overwrite or discard user changes.
- Inspect Git status before operations that may affect working files.
- Do not automatically reset, clean, rebase, or force-push.
- Preserve unrelated uncommitted changes.

## 9. Testing and Verification
After implementation:
1. Run relevant TypeScript checks.
2. Run relevant tests.
3. Run linting if configured.
4. Verify affected API endpoints and UI behavior where possible.
5. Check for regressions in related functionality.

Do not claim that something works unless it has been verified.

If verification cannot be completed, clearly state why.

## 10. Stop Conditions
Immediately stop execution when:
- The same error occurs twice.
- A required service or dependency is unavailable and cannot be restored safely.
- The requested change risks data loss.
- Existing architecture conflicts with the requested implementation.
- Further attempts would repeat the same unsuccessful operation.

When stopping, report:
- What was attempted.
- The exact error.
- The identified or suspected cause.
- What remains incomplete.
- The recommended next action.

## 11. Final Response
After completing a task, provide a concise report:

**Implemented:**
- List of completed changes.

**Files changed:**
- Relevant file paths.

**Verification:**
- Commands and tests executed.
- Results.

**Issues:**
- Remaining problems or limitations.

Do not provide lengthy explanations unless requested.