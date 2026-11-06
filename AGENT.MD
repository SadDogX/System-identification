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

## 4. PowerShell Execution Rules

### Command Limits
- Maximum 2 attempts for the same command.
- Never repeat an identical failed command without changing its arguments or correcting the identified cause.
- After 2 failures, STOP and report the problem.
- Never enter an infinite retry loop.

### Error Handling
When a command fails:
1. Read the complete error message.
2. Identify the actual cause.
3. Determine whether the problem is related to syntax, permissions, environment, dependencies, ports, or services.
4. Select a different diagnostic or corrective action.
5. Retry only if there is a justified change.

If the same error occurs twice, stop execution and request intervention when necessary.

### PowerShell Compatibility
- Check the installed PowerShell version when shell compatibility is relevant.
- Use syntax compatible with the installed version.
- Do not assume PowerShell 7 features are available in Windows PowerShell 5.1.
- Prefer simple, independent commands over complex command chains.
- Check exit codes and command results explicitly.

### Environment Safety
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