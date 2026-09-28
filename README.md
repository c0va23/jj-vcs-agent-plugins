# jj-vcs-plugin

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

## Claude Code

The repo is a plugin marketplace:

```
/plugin marketplace add /path/to/jj-vcs-plugin
/plugin install jj-vcs@jj-vcs-plugin
```

The plugin brings the `jj-vcs` skill and a `SessionStart` hook
(`hooks/jj-env.sh`). The hook writes the variables to `$CLAUDE_ENV_FILE`, which
Claude Code sources before every Bash tool command. If you already have a
personal copy in `~/.claude/skills/jj-vcs`, remove it so the skill is not
loaded twice.

To try the plugin without installing it: `claude --plugin-dir /path/to/jj-vcs-plugin`.

## OpenCode

```sh
mkdir -p ~/.config/opencode/plugins ~/.config/opencode/skills
ln -s /path/to/jj-vcs-plugin/opencode/plugins/jj-env.ts ~/.config/opencode/plugins/
ln -s /path/to/jj-vcs-plugin/skills/jj-vcs ~/.config/opencode/skills/
```

The plugin uses the `shell.env` hook, which OpenCode applies to the bash tool,
`!` commands and PTYs. For a single project, put the files in
`.opencode/plugins/` and `.opencode/skills/` instead. OpenCode also reads skills
from `~/.claude/skills`, so skip the skill link if it is already there.

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
