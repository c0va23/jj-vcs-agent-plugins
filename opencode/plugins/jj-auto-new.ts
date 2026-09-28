import type { Plugin } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"

// Shared with the Claude Code plugin; see the script for when it acts.
const script = fileURLToPath(
  new URL("../../plugins/jj-auto-new/hooks/jj-auto-new.sh", import.meta.url),
)

// Opt-in: list the package as ["<spec>", { "autoNew": true }] in opencode.json.
export const JjAutoNew: Plugin = async ({ client, directory, $ }, options) => {
  if (options?.autoNew !== true) return {}
  return {
    event: async ({ event }) => {
      if (event.type !== "session.idle") return
      const { data: session } = await client.session.get({
        path: { id: event.properties.sessionID },
      })
      // Subagent sessions go idle while the main agent is still working.
      if (!session || session.parentID) return
      const message = (
        await $`sh ${script}`.cwd(session.directory ?? directory).quiet().nothrow().text()
      ).trim()
      if (message) {
        await client.tui.showToast({ body: { message, variant: "info" } }).catch(() => {})
      }
    },
  }
}
