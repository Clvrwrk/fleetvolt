# FleetVolt Local Visual Handoff Protocol

## Purpose

Every FleetVolt change made on a local branch must be made visible and reviewed
before Chris is asked to evaluate it. This prevents a committed local fix from
being mistaken for a staging or production release.

## Required sequence

1. **Identify the review surface.** List the routes, states, user roles, and
   responsive sizes affected by the change.
2. **Run automated checks.** Use the narrowest relevant lint, type, unit, and
   browser gates. Record pass, fail, and intentionally skipped checks.
3. **Serve the exact branch.** Start the app from the repository containing the
   reviewed commit. Use `http://localhost:3000` unless the port is occupied.
4. **Agent visual review.** Open each affected route in the browser. Inspect the
   changed behavior and its surrounding layout. For responsive work, check at
   least desktop and 390px mobile. Do not hand off a known material defect.
5. **Capture every documented change with ScreenshotOne.** Build a change-to-
   screenshot matrix from the PR description, repair order, or local change
   receipt. Call `SCREENSHOTONE_TAKE_SCREENSHOT` for every row. A screenshot
   entry must document: the fix shown, why it passes the agent visual test, and
   what Chris is required to inspect at the localhost URL. Browser-native
   screenshots do not replace this evidence.
   ScreenshotOne is an external service and cannot directly browse a private
   localhost address. Obtain Chris's explicit informed approval before sending
   unpublished page content or creating a temporary public tunnel. Record the
   approved method in the receipt.
6. **Keep localhost available.** Leave the reviewed server running. The issue
   link and the running process are one handoff artifact.
7. **Create the human gate.** Create a sub-issue under FLE-1, assign it directly
   to Chris Hussey, and use the receipt below. Ask for `Pass` or `Needs changes`.
8. **Reconcile the ledgers.** Update cw-codex's existing FLE-1 and CLE-6
   comments in place with the handoff issue and current local/deploy status.

## ScreenshotOne evidence matrix

Create one row for every documented visual change. No row may be omitted merely
because multiple changes appear on the same route; reuse a capture only when it
clearly proves each listed change and carries a separate explanation per change.

| Documented change | Route + viewport | ScreenshotOne artifact | Why agent review passes | What Chris must review |
|---|---|---|---|---|
| `<change>` | `http://localhost:<port>/<route>` · `<size>` | `<cache_url or attached file>` | `<visible acceptance evidence>` | `<specific visual/interaction check>` |

## Linear sub-issue template

```markdown
Local visual acceptance — <change>

Requester: cw-codex
Reviewer/assignee: Chris Hussey

Branch: <branch>
Commit: <full or short SHA>
Localhost: http://localhost:<port>/<route>
Server state: running on Chris's machine as of <ISO timestamp>

Agent review: PASS | FAIL
Reviewed surfaces:
- <route> — <viewport> — <what was checked>

ScreenshotOne evidence:
- Approved capture method: <public preview/tunnel or transmitted HTML, with approval reference>
- <documented change> — <artifact URL/file>
  - Fix shown: <what changed>
  - Agent pass rationale: <why it passes visually>
  - Chris must review: <specific check at localhost>

Automated receipt:
- <command>: <result>

Known limitations:
- <none, or explicit limitation>

Deployment state:
- Local only. Not staging. Not production.

Chris acceptance requested:
- Pass — local visual result is accepted.
- Needs changes — comment with the route, state, and observed problem.
```

## Failure and lifecycle rules

- If agent visual review fails, fix and re-run before creating the sub-issue.
- If ScreenshotOne is unavailable or unconnected, stop before human handoff and
  record the gate as blocked. Do not substitute another capture mechanism.
- If localhost stops, the review request is stale until the same URL is restored
  and the sub-issue is updated.
- A local `Pass` does not authorize or imply deployment.
- After staging deployment, perform a separate staging visual review. Repeat for
  production after production deployment.
