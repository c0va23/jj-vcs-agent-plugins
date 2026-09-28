#!/bin/sh
# Start a new empty jj change when the agent stops, if the current one is not
# empty. Without this, an agent that forgets `jj new` puts its next task into
# the commit it just made. An empty @ is left alone, so stops that changed
# nothing don't pile up empty commits.
#
# Usage: jj-auto-new.sh [--json]
#   Runs in the current directory; does nothing outside a jj repo.
#   Prints what it did, as a Claude Code hook JSON object with --json.

export JJ_EDITOR=false JJ_PAGER=cat
command -v jj >/dev/null 2>&1 || exit 0

state=$(jj log -r @ --no-graph --color=never -T 'if(empty, "empty", "changed")' 2>/dev/null) || exit 0
[ "$state" = changed ] || exit 0

finished=$(jj log -r @ --no-graph --color=never \
  -T 'change_id.short() ++ " " ++ if(description, json(description.first_line()), "\"no description\"")' \
  2>/dev/null) || exit 0
jj new >/dev/null 2>&1 || exit 0

id=${finished%% *}
title=${finished#* }         # JSON string literal, quotes included
title=${title#\"}
title=${title%\"}            # JSON-escaped text
if [ "${1:-}" = "--json" ]; then
  printf '{"systemMessage": "jj: %s (%s) has changes, started a new empty change on top of it"}\n' "$id" "$title"
else
  printf 'jj: %s (%s) has changes, started a new empty change on top of it\n' "$id" "$title"
fi
