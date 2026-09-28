import type { Plugin } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"

// Ship the jj-vcs skill with the plugin, so one install brings both.
const skillsDir = fileURLToPath(new URL("../../skills", import.meta.url))

export const JjEnv: Plugin = async () => ({
  config: async (config) => {
    config.skills ??= {}
    config.skills.paths = [...(config.skills.paths ?? []), skillsDir]
  },
  // Applies to every shell OpenCode spawns (bash tool, `!` commands, PTYs), so
  // each jj invocation gets it however it is spelled (`cd x && jj …`, scripts).
  // JJ_EDITOR=false: a command that wants an editor fails at once instead of
  // hanging or silently accepting the template. JJ_PAGER=cat: never page.
  "shell.env": async (_input, output) => {
    output.env.JJ_EDITOR = "false"
    output.env.JJ_PAGER = "cat"
  },
})
