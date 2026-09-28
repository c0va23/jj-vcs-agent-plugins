---
name: jj-vcs
description: >
  How to correctly use the Jujutsu (jj) version control system CLI in
  non-interactive, automated, and agentic environments (Claude Code, shell
  scripts, CI). Use this skill whenever the repo contains a `.jj/` directory,
  the user mentions "jj", "jujutsu", or asks about commits/history/rebasing in
  a jj repo. Covers: non-interactive command patterns (critical — wrong usage
  blocks the process), jj-vs-git conceptual differences, and every common
  operation: creating commits, describing, editing mid-stack, splitting,
  squashing, rebasing, absorbing, abandoning, reading history, and reading
  diffs.
---

# Jujutsu (jj) VCS — Agent Reference

## 1. Non-Interactive Rules (Read First)

jj opens an editor for many commands by default. In a non-interactive agent
environment this **blocks the process**. Always apply one of these patterns:

### Environment: `JJ_EDITOR=false` and `JJ_PAGER=cat`

Every jj command must run with:

```bash
export JJ_EDITOR=false   # any command that wants an editor fails immediately
export JJ_PAGER=cat      # output never waits in a pager
```

The jj-vcs plugin for Claude Code / OpenCode sets both for every shell
command. Check with `echo "$JJ_EDITOR $JJ_PAGER"`. If they are not set, set
them in the environment (devenv/direnv shell) or prefix commands:
`JJ_EDITOR=false JJ_PAGER=cat jj …`.

- **Use `false`, not `cat`.** With `JJ_EDITOR=cat` jj reads the editor
  template back as the "edited" message and silently accepts it — e.g. a
  squash quietly concatenates both descriptions. With `false` jj stops with
  `Error: Failed to edit description … Editor 'false' exited with exit
  status: 1`; re-run the command with `-m` / `-u` (see below).
- `JJ_PAGER` is jj-only, so it doesn't affect other tools. jj only starts
  a pager when stdout is a terminal. `--no-pager` or
  `jj config set --repo ui.paginate never` also turn it off.

### Always pass `-m` or `--stdin` for messages

```bash
# Good — inline short message
jj describe -m "fix off-by-one in pagination"

# Good — multi-line or message with special characters (backticks, quotes, $vars)
jj describe --stdin <<'EOF'
Show how fast each assistant response actually was

Uses `timer.elapsed()` to record wall-clock ms per token and surfaces it
in the footer. Fixes the "0 ms" display bug.
EOF
```

> **Why `<<'EOF'` not `<<EOF`?** The single-quoted delimiter disables shell
> expansion, so backticks, `$vars`, and double-quotes inside the body are safe.

For messages that are too large for a single heredoc call, write to a
scratch file (use `.tmp/` if the repo has one, otherwise `/tmp/`) and pipe:

```bash
jj describe --stdin < /tmp/msg.txt
```

Only `jj describe` supports `--stdin`. `jj squash`, `jj split` and
`jj commit` take `-m` only. For a long message on those, pass a short `-m`
(or `-u` for squash), then fix it with `jj describe <id> --stdin`.

### Commands that open an editor unless told not to

| Command | Opens editor when | Non-interactive form |
|---|---|---|
| `jj describe`, `jj commit` | no `-m` | `-m "msg"` (describe also `--stdin`) |
| `jj split <paths>` | no `-m` | `-m "msg for selected part"` |
| `jj squash` (any form) | source **and** destination both have descriptions | `-m "msg"` or `-u` (keep destination's) |
| `jj split` / `jj squash` without paths, `-i`, `jj resolve` | always (terminal UI) | pass file paths; never `-i` |

### Never use interactive flags

`-i`, `--interactive`, `--tool` all require a terminal. Use file-path-based
alternatives instead (see Split and Squash sections below).

---

## 2. jj vs Git — Mental Model

| Concept | Git | jj |
|---|---|---|
| Unit of work | commit (SHA) | *change* (stable change-ID + current commit hash) |
| Staging area | yes — `git add` required | **none** — all edits are automatically part of `@` |
| Amending | `git commit --amend` (changes SHA) | just edit files; jj updates `@` in place |
| Working copy | dirty tree separate from HEAD | `@` **is** a real commit that tracks your edits |
| "Checkout" | `git checkout <sha>` | `jj edit <change-id>` — edits that commit in place |
| Branch | named pointer, must be explicit | anonymous by default; *bookmarks* are optional names |
| Rebase after amend | manual | **automatic** — descendants always rebase onto updated parents |
| Change ID stability | SHA changes on every amend | change-ID is stable; only the commit hash changes |
| Undo | `git reflog` + reset | `jj op log` + `jj op restore <op-id>` |

### The working-copy commit (`@`)

Every file edit you make is **automatically** part of `@` — there is no
`jj add`. Think of `@` as a commit that is perpetually being amended.

```
...─── parent ─── @ (your current edits, always a real commit)
```

When you are done with a logical unit of work:

1. `jj describe -m "message"` — name the change
2. `jj new` — open a fresh empty `@` on top of it

---

## 3. Core Operations

### 3.1 Starting and describing commits

```bash
# Describe the current working-copy commit (most common)
jj describe -m "add retry logic to HTTP client"

# Describe a specific commit by its short change-ID
jj describe abc12345 -m "updated message"

# Start a new empty change on top of current @ (after describing)
jj new

# Describe + open new in one flow
jj describe -m "feat: paginate results" && jj new
```

**Common mistake:** `jj new -m "msg"` puts the message on the new *empty*
change, NOT on the change that contains your edits. Always `jj describe`
first.

### 3.2 Reading history

```bash
# Compact log (default — shows change-ID, author, description)
jj log

# Limit output
jj log --limit 20

# Full git-style diff in log
jj log --git
```

Change-IDs in the log are short hex strings (e.g. `llrsqkor`). `@` always
refers to the current working copy; `@-` is its parent; `@--` grandparent.

### 3.3 Reading diffs

```bash
# Show current working-copy changes
jj diff --git

# Show a specific commit's diff (what that commit introduced)
jj show <change-id> --git

# Show last committed change
jj show @- --git

# Show diff between two commits
jj diff --from <A> --to <B> --git

# Summary (stats only — file names + lines changed, fast to scan)
jj diff --from <A> --to <B> --stat

# Working-copy status (modified/added/removed files)
jj status
```

**LLM-friendly reading pattern:** Use `--stat` first to see which files
changed, then `jj show <id> --git` only for files you need to
inspect. Avoids dumping huge diffs into context.

### 3.4 Editing a commit in the middle of a stack

`jj edit` checks out any commit for in-place modification. Descendants
**rebase automatically** when you move away.

```bash
jj edit <change-id>       # switch to that commit; @ now points here
# … make file edits …
jj describe -m "updated message if needed"
jj edit <another-id>      # switch away; changes are saved automatically
```

No explicit commit step needed. Edits are absorbed into whichever commit `@`
points to.

### 3.5 Abandoning (removing) a commit

```bash
# Remove a commit; its descendants rebase onto its parent
jj abandon <change-id>

# Abandon a range (revset syntax)
jj abandon <A>::<B>
```

If you abandon `@`, jj creates a new empty working-copy commit automatically.
Abandoning a commit with a bookmark also deletes that bookmark — be careful
before `jj git push`.

### 3.6 Squashing commits

```bash
# Squash @ into its parent (fold up)
jj squash -m "combined message"

# Squash a specific commit into its parent
jj squash -r <change-id> -m "combined message"

# Squash @ into an arbitrary ancestor (not the parent)
jj squash --into <target-change-id> -m "combined message"
```

> `-r` and `--into` are mutually exclusive. `-r` always squashes into the
> **parent** of the specified revision.

When both the source and the destination have descriptions, jj opens an
editor to combine them. Always pass one of:

- `-m "combined message"` — set the result's description explicitly
- `-u` / `--use-destination-message` — keep the destination's description,
  drop the source's (typical for "fold this fixup into X")

```bash
jj squash --into <target-change-id> -u
```

`jj squash` has no `--stdin`. For a long combined message, squash with `-u`,
then run `jj describe <target> --stdin <<'EOF' … EOF`.

### 3.7 Splitting a commit

`jj split` divides one commit into two sequential commits using **file paths**
to select what goes into the first commit; the remainder goes into the second.

```bash
# Split the current @ by file (non-interactive — safe for agents)
jj split path/to/a.ts path/to/b.ts -m "message for first part"
# @ now points to the second commit (remaining files)
jj describe -m "message for second part"
```

**Constraints:**
- You cannot split *within a single file* without `-i` (interactive). If two
  logical changes are mixed inside one file, you must manually revert one
  half, split, then redo it (see Escape Hatch below).
- Always `jj describe` the original commit before splitting — the `-m` on
  `jj split` applies to the *first* (selected) commit only; the second
  inherits the original description.

**Chaining splits** to produce N commits: run `jj split` N−1 times, selecting
the next batch of files each time.

**Escape hatch — split when changes share a file:**

1. `jj edit <combined-change>`
2. Manually revert the "B-half" edits inside the shared file (leave B's other
   files in the tree as-is).
3. `jj split <shared-file> <A-only-files> -m "A's message"`
4. On the resulting second commit, redo the B-half edits inside the shared
   file.
5. Verify at each step; descendants rebase cleanly because the final file
   state is identical to the original.

### 3.8 Rebasing

`jj rebase` moves revisions to different positions in the graph. It has two
independent axes of control: **which revisions to move** and **where to put
them**.

#### Which revisions to move

| Flag | What moves |
|---|---|
| *(nothing)* | same as `-b @` — the whole branch of `@` |
| `-b <rev>` | the topological branch rooted at `<rev>` (commit + all descendants not already on destination) |
| `-s <rev>` | `<rev>` and all its descendants (subtree) |
| `-r <rev>` | only `<rev>` itself; its descendants are rebased onto `<rev>`'s old parent |

#### Where to place them — three modes (mutually exclusive)

**Mode 1 — `--destination` / `-d` / `--onto` / `-o`**
Rebase the selected revisions as children of `<dest>` (classic "rebase onto"):

```bash
# Move @ onto main
jj rebase -d main

# Move a subtree onto a different base
jj rebase -s <feature-root> -d main

# Move a single commit onto a new parent (lift it out, reattach descendants)
jj rebase -r <change-id> -d <new-parent>

# Rebase onto multiple parents (creates a merge commit)
jj rebase -d <parent-A> -d <parent-B>
```

**Mode 2 — `--insert-after` / `-A` / `--after`**
Insert the selected revisions *after* `<rev>`, i.e. make them children of
`<rev>` and parents of `<rev>`'s existing children:

```bash
# Move commit C to come right after A (before B, which was A's child)
# Before: A → B → C   After: A → C → B
jj rebase -r C -A A

# Insert a new empty commit after xxxxxxxx (use jj new instead for working copy)
jj new --no-edit -A xxxxxxxx -m "inserted step"
```

**Mode 3 — `--insert-before` / `-B` / `--before`**
Insert the selected revisions *before* `<rev>`, i.e. make them children of
`<rev>`'s parents and parents of `<rev>`:

```bash
# Slide commit X in front of Y
# Before: parent → Y   After: parent → X → Y
jj rebase -r X -B Y

# Reorder: move C before B in chain A → B → C
jj rebase -r C -B B
```

**Combining `-A` and `-B`** inserts between two specific commits:

```bash
# Insert commit X between main and feature (make X a child of main, parent of feature)
jj rebase -r X -A main -B feature
```

#### Additional flags

```bash
# Drop any rebased commits that become empty (no diff vs parent)
jj rebase -s <rev> -d <dest> --skip-emptied
```

#### Conflict behaviour

jj rebase **never aborts on conflicts** — it records the conflict inside the
commit and lets you resolve it later. No `--continue` step. Check for
conflicts with `jj status` after rebasing.

### 3.9 Absorb (scatter fixes to their proper ancestors)

`jj absorb` is the right tool when you have a "fix" commit (or uncommitted
edits in `@`) that should be folded into multiple ancestor commits. It
blame-routes each hunk to the nearest ancestor that last touched those lines.

```bash
jj absorb                        # absorb all of @ into ancestors
jj absorb path/to/file.ts        # restrict to one file
jj absorb -f <change-id>         # absorb a non-@ commit
```

**Prefer `jj absorb` over `jj squash --into`** when fixes span multiple
ancestors — `squash --into` moves an entire file's delta and can cause
conflicts in descendants that also touched those lines.

After absorbing, run `jj diff` — any hunks with ambiguous blame are left in
`@` and must be routed by hand.

### 3.10 Undoing operations

```bash
jj op log                        # full operation history
jj op restore <op-id>            # roll back to any past operation state
jj op undo                       # undo the last operation
```

---

## 4. Correct Sequential Commit Workflow

```
1. Edit files  →  edits land automatically in @
2. jj describe -m "message"   ← name this unit of work
3. jj new                     ← open a fresh @ for the next task
4. Repeat
```

**Check `@` at the start of each turn.** With the jj-auto-new plugin, a
`jj new` runs when you finish a turn with a non-empty `@`. If you then keep
working on the previous change, you'll be in a fresh empty `@` on top of it.
Either run `jj edit @-` before editing, or edit here and fold the result back
with `jj squash` (add `-u` if both have descriptions). `jj log --limit 3`
shows where you are.

**Plan commits before coding.** When a task involves logically separate
changes (app code vs tests, refactor vs feature), write and describe each
change sequentially. Do NOT mix unrelated changes into one working copy and
try to split after the fact — splitting within a file is unavailable without
interactive mode.

---

## 5. Commit Message Style

- **First line:** describe the intent (the *why*), not the diff (the *what*).
  - ✗ `Extract duration formatters and collapse generation metrics`
  - ✓ `Show how fast each assistant response actually was`
- **Body (optional):** motivation and decision, not a file-by-file walkthrough
  (`jj diff` already covers what changed).
- For messages with backticks, quotes, `$vars`, or bullet lists use the
  heredoc form (`jj describe --stdin <<'EOF' … EOF`) to avoid quoting issues.

---

## 6. Quick Reference Card

```
jj log                                   list history
jj show <id> --git                       show a commit's diff
jj diff --git                            show working-copy diff
jj status                                show changed files

jj describe -m "msg"                     name current @
jj new                                   open fresh @ on top
jj edit <id>                             check out a commit for editing

jj squash -m "msg"                       fold @ into parent
jj squash --into <id> -u                 fold @ into any ancestor, keep its message
jj split <files> -m "msg"                split @ by file (non-interactive)

jj rebase -d <id>                        move @ onto new parent
jj rebase -s <id> -d <id>                move subtree
jj absorb                                scatter @ hunks to ancestors

jj abandon <id>                          remove a commit
jj op undo                               undo last operation
jj op restore <op-id>                    restore any prior state
```

---

## 7. Common Pitfalls for Agents

| Mistake | Correct pattern |
|---|---|
| `jj new -m "msg"` to "commit" edits | `jj describe -m "msg"` then `jj new` |
| `JJ_EDITOR=cat` to "suppress" the editor | `JJ_EDITOR=false` — fails fast instead of silently accepting the template |
| `jj split -i` or `jj squash -i` | use file-path args |
| `jj squash --into X` when both have descriptions | pass `-u` (keep X's message) or `-m "msg"`; for a long message `-u`, then `jj describe X --stdin` |
| `jj describe -m "msg with `backticks`"` | use `--stdin <<'EOF' … EOF` |
| `jj squash --into X` when fixes span multiple ancestors | use `jj absorb` |
| Mixing refactor + feature in one `@` | write and describe them sequentially |
| Running `flutter analyze` / build tools after `jj edit` on older commit | regenerate derived files (codegen, lockfiles) after each `jj edit` |
