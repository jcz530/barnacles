# Command palette: feedback and staying open

Covers `barnacles-qd0` (inline status line) and `barnacles-c5z` (keep the
palette open for actions whose result you'd want to see).

## The problem

Commands report almost nothing. Three of them toast — `copyText`, and the two
set-default actions in `useCommandRegistry.ts` — and the rest are silent:
`killPort`, `openExternal`, `revealInFinder`, `rescanAll`, `newWindow`, and
every process start/stop.

Worse, the three that do toast are the ones the toast reaches least. `<Toaster>`
lives in `App.vue:111`, and `/command-palette` is a top-level route under the
same root component, so the floating window does mount a toaster. But every
command ends in `ctx.dismiss()`, which for that surface calls
`window.electron.commandPalette.close()` → `paletteWindow.hide()`. The toast is
painted into a window that is hidden a frame or two later. In-app the toast
survives, but the palette disappearing at the same instant pulls the eye away
from the corner where it lands.

So the feedback and the closing are one problem, not two. Fixing the message
without fixing the dismissal just relocates the silence.

## Two findings that shape the design

### 1. `ctx.dismiss()` races the await

Look at the shape every command uses:

```ts
run: async ctx => {
  await deps.copyText(url);
  ctx.dismiss();
}
```

The status message has to be written *before* `dismiss()`, and the palette has
to still be there to show it. This is why the status line and the stay-open
change land together — a status line alone would be written into a surface
that's already closing.

### 2. Blur-hide makes "stay open" free in the floating window

`command-palette-manager.ts:186` hides the window whenever it blurs. That is
exactly what we want for the stay-open commands: copy, kill port, start process
and toggle theme all keep focus inside the palette, so nothing blurs and the
window stays put. The moment the person clicks away or hits the hotkey, it
hides as it always did. No new window-management work.

The exception worth knowing: `openExternal` (Open in Browser) *does* blur,
because the browser takes focus. It's already a dismissing command, so this
costs nothing — but it rules out "stay open for everything" as a policy.

## Design

### `CommandContext` gains two things

```ts
export interface CommandContext {
  surface: CommandSurface;
  navigate: (path: string) => void | Promise<void>;
  dismiss: () => void;
  pop?: () => void;
  /**
   * Report the outcome of a command in the palette itself.
   *
   * Not a toast: the floating window is hidden a frame after dismiss(), so a
   * toast fired there is painted into a window nobody sees. This renders
   * inside the palette, which is the surface being looked at in both cases.
   */
  status: (message: string, kind?: 'success' | 'error') => void;
}
```

`pop?.()` already exists as the "finish in place" primitive but is used exactly
once (`projects.ts:284`, Set Default) and is `undefined` at the root — so
Toggle Theme, a root-level command, currently *cannot* stay open. Rather than
adding a second concept, make `pop` always present and a no-op at depth 0.
`useLevelStack.pop()` already returns `false` there, so the component's
`pop` just stops caring about the return value.

Commands that stay open simply omit the `ctx.dismiss()` call. That is the whole
change at the provider level — no new verb to remember.

### Where the status line renders

Between the input and `ComboboxContent` in `CommandPalette.vue`. Reserved
height so the list doesn't reflow when a message appears and disappears —
the footer already takes this approach (`h-10 shrink-0`, always rendering
something) and the same reasoning applies.

```
┌──────────────────────────────┐
│ >                            │
├──────────────────────────────┤
│ ✓ Copied localhost:3000      │  ← new, reserved height
│                              │
│  Port 3000    vite           │
│  Port 5432    postgres       │
├──────────────────────────────┤
│ ports > Port 3000   Copy ⏎   │
└──────────────────────────────┘
```

Colors come from the theme's `success` and `danger` scales, per CLAUDE.md.

### When it clears

- On the next keystroke in the search box — a new search means the person has
  moved on
- After a timeout (~3s) — matches toast dwell time
- On `reset()`, so a reopened floating window never shows the last session's
  message

**Not** on level change. This was the original intent, but step 1 disproved it:
killing a port from inside that port's own action level collapses the level
back to the root (the rebuild watcher drops a level whose source item is gone).
Clearing on pop would therefore wipe the "Killed port 3000" message in exactly
the case it matters most. A message has to outlive the level it was raised in.

State lives in `CommandPalette.vue` alongside `highlightedId`, not in
`useLevelStack`. The stack is about navigation; this is about the last thing
that happened. Keeping them apart means the level-rebuild watcher can't
accidentally clobber a message.

### Which commands stay open

| Command | Behavior | Why |
|---|---|---|
| Copy path / port / URL | **stay** + status | Nothing visibly changed; closing gives no confirmation at all |
| Kill port | **stay** + status | The row leaving the list *is* the confirmation |
| Stop / start / restart process | **stay** + status | Row flips state in place; you often start several |
| Run script | **stay** + status | Same |
| Toggle theme | **stay** | The theme change is the feedback; lets you toggle back |
| Set default IDE / terminal | **stay** (already `pop`) | Move its toast to the status line |
| Open project / open in IDE / reveal in Finder | dismiss | You're leaving for another app |
| Open in browser | dismiss | Blurs anyway — see finding 2 |
| Navigate / new window / scan for projects | dismiss | Takes you to a different surface |

## Does the list actually refresh in place? — verified ✅

This was the assumption everything rests on, so it was checked first. Covered
by `src/frontend/commands/palette-refresh.test.ts`.

**No invalidation work is needed.** Both paths already work:

- **Kill port** — `useKillPortMutation`'s `onSuccess` does an optimistic
  `setQueryData` filter on `['ports']` (`useQueries.ts:1868`) rather than an
  invalidate. The row leaves as soon as the request resolves, with no refetch
  of `lsof` in between. Better than the plan assumed.
- **Process start/stop** — `invalidateProcessStatus()` invalidates
  `['process-status-all']` (`useQueries.ts:936`), exactly the key the registry
  queries. The row flips Start ↔ Stop.
- The registry's `commands` is a `computed` over `ports.value` and
  `processStatuses.value`, so both cache writes reach the list reactively.

**One risk was confirmed rather than ruled out.** Killing a port from inside
that port's *own* action level collapses the level back to the root: the
rebuild watcher drops any level whose source item has gone. That is defensible
on its own terms — there is nothing left to act on — but it is now pinned by a
test, and it constrains the status line's design: a message raised by the kill
has to survive being thrown back to the root. Hence the clearing rules above
no longer clear on level change.

This is adjacent to `barnacles-5ga` (a level dropped when its actions
*momentarily* return empty) but not the same bug, and fixing that stays out of
scope.

## Steps

1. ~~**Verify list refresh**~~ — **done.** Both paths already work with no
   invalidation changes needed; see the section above and
   `src/frontend/commands/palette-refresh.test.ts`.
2. **`CommandContext.status` + always-present `pop`** — `types.ts`, plus the
   three context builders (`CommandPalette.vue:119`,
   `CommandPaletteDialog.vue:37`, `CommandPaletteView.vue:33`) and the inert one
   in `useLevelStack.ts:34`.
3. **Status line UI** — `CommandPalette.vue`, reserved height, theme colors,
   clearing rules above.
4. **Move the existing toasts** — the three `toast.success` calls in
   `useCommandRegistry.ts` (lines 248, 252, 271) become status calls. Note
   `copyText` currently interpolates the copied text into the message; a long
   project path needs truncating in a single-line status.
5. **Update the providers** — drop `ctx.dismiss()` and add `ctx.status(...)` for
   the stay-open commands in `ports.ts`, `processes.ts`, `scripts.ts`,
   `projects.ts` (copy path), `app.ts` (toggle theme).
6. **Error paths** — `killPort` and process start/stop can fail. Currently the
   mutation rejects and the `await` throws before `dismiss()`, leaving the
   palette open with no explanation. Wrap and report as `'error'`.
7. **Tests** — provider tests already assert on a fake context
   (`ports.test.ts` etc.); extend the fake with `status` and assert both that
   it's called and that `dismiss` is *not*, for each stay-open command.
   `useLevelStack` tests cover `pop` at root.
8. **Gates** — `npm run type-check`, `npm run test:unit`, `npm run lint`,
   `npm run format`.

## Out of scope

- `barnacles-5ga` (level dropped on momentarily-empty actions) — observe only
- Native OS notifications — considered and set aside; the palette is the
  surface being looked at
- Undo affordances on destructive commands (kill port) — a separate idea
- `useProjectActions.copyPath` still has an `alert()` on failure and a
  `// Could add a toast notification here` comment; it's shared with the
  projects page, so changing it is a wider change than this plan
