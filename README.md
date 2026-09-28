# jj-vcs-agent-plugins

Lets coding agents use [Jujutsu (jj)](https://jj-vcs.github.io/jj/) without
getting stuck waiting on an editor or a pager.

- **`skills/jj-vcs/SKILL.md`** is a jj reference for agents: commands that
  don't need a terminal, how jj differs from git, and the common operations.
- **Environment plugins** set these two variables for every shell command the
  agent runs:
  - `JJ_EDITOR=false`: any jj command that would open an editor fails at once
    with `Editor 'false' exited with exit status: 1`, so the agent can re-run it
    with `-m` or `-u`. With `JJ_EDITOR=cat` the command would instead succeed
    and keep the editor template as the message.
  - `JJ_PAGER=cat`: jj output is never held in a pager. Only jj reads this
    variable, so other tools and your global config are not affected.

The variables are set for the whole shell rather than added to individual
commands, so they also cover `cd x && jj …`, subshells and scripts that call
jj.

- **jj-auto-new** (optional): when the agent finishes its turn and `@` is not
  empty, it runs `jj new`. The agent's next task then starts in a fresh change
  instead of landing in the one it just made. An empty `@` is left alone, so
  turns that changed nothing don't add commits. Both agents run the same script,
  `plugins/jj-auto-new/hooks/jj-auto-new.sh`.

  Because this happens at the end of every turn, a task that spans several
  turns can end up split across changes, for example when the agent stops to
  ask you a question. Combine them with `jj squash`.

## Claude Code

The repo is a plugin marketplace:

```
/plugin marketplace add c0va23/jj-vcs-agent-plugins
/plugin install jj-vcs@jj-vcs-agent-plugins
```

The plugin brings the `jj-vcs` skill and a `SessionStart` hook
(`hooks/jj-env.sh`). The hook writes the variables to `$CLAUDE_ENV_FILE`, which
Claude Code sources before every Bash tool command. If you already have a
personal copy in `~/.claude/skills/jj-vcs`, remove it so the skill is not
loaded twice.

To also start a new change when the agent stops:

```
/plugin install jj-auto-new@jj-vcs-agent-plugins
```

This adds a `Stop` hook and shows a notice when it runs `jj new`.

To try the plugins from a local clone without installing them:
`claude --plugin-dir /path/to/jj-vcs-agent-plugins` (add
`--plugin-dir /path/to/jj-vcs-agent-plugins/plugins/jj-auto-new` for the second
one).

## OpenCode

Install from the GitHub repository. Add `-g` to install for all projects:

```sh
opencode plugin git+https://github.com/c0va23/jj-vcs-agent-plugins.git
```

This adds the repository to the `plugin` list in `opencode.json`. The one
install brings both parts:

- a `shell.env` hook that OpenCode applies to the bash tool, `!` commands and
  PTYs;
- the `jj-vcs` skill, which the plugin adds to `skills.paths`.

To also start a new change when the agent stops, turn on the `autoNew` option
for the plugin in `opencode.json`:

```json
{
  "plugin": [
    ["git+https://github.com/c0va23/jj-vcs-agent-plugins.git", { "autoNew": true }]
  ]
}
```

The check runs when the main session goes idle. Subagent sessions are skipped,
because they finish while the main agent is still working. A toast appears when
it runs `jj new`.

OpenCode keeps the installed copy in its cache. Run the install command with
`--force` to update it.

To use a local clone instead, add
`"plugin": ["file:///path/to/jj-vcs-agent-plugins"]` to `opencode.json`.

## Other agents and plain shells

Export the variables in the project's dev shell, for example in `devenv.nix`:

```nix
env.JJ_EDITOR = "false";
env.JJ_PAGER = "cat";
```

or in `.envrc`: `export JJ_EDITOR=false JJ_PAGER=cat`.

## Pagination options

jj only starts a pager when stdout is a terminal. Agent tools usually capture
output through a pipe, so paging only matters for agents that run commands in a
PTY. You can turn it off in any of these ways:

| Scope | How |
|---|---|
| process env (no config files touched) | `JJ_PAGER=cat` |
| one command | `jj --no-pager …` or `jj --config ui.paginate=never …` |
| one repo | `jj config set --repo ui.paginate never` (stored in `.jj/repo/config.toml`, not committed) |

There is no environment variable for `ui.paginate` itself. `JJ_CONFIG` replaces
the user and system config files instead of adding to them, and `PAGER` is
ignored by jj.
