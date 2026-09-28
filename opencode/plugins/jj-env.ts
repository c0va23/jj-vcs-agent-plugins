import type { Plugin } from "@opencode-ai/plugin"

// Applies to every shell OpenCode spawns (bash tool, `!` commands, PTYs), so
// each jj invocation gets it however it is spelled (`cd x && jj …`, scripts).
// JJ_EDITOR=false: a command that wants an editor fails at once instead of
// hanging or silently accepting the template. JJ_PAGER=cat: never page.
export const JjEnv: Plugin = async () => ({
  "shell.env": async (_input, output) => {
    output.env.JJ_EDITOR = "false"
    output.env.JJ_PAGER = "cat"
  },
})
