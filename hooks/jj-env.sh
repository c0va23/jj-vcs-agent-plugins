#!/bin/sh
# Claude Code sources $CLAUDE_ENV_FILE before every Bash tool command, so these
# apply to each jj invocation, however it is spelled (`cd x && jj …`, scripts).
# JJ_EDITOR=false: a command that wants an editor fails at once instead of
# hanging or silently accepting the template. JJ_PAGER=cat: never page.
[ -n "$CLAUDE_ENV_FILE" ] || exit 0
cat >> "$CLAUDE_ENV_FILE" <<'ENV'
export JJ_EDITOR=false
export JJ_PAGER=cat
ENV
