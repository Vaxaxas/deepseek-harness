/**
 * The MCP servers and tools management page, browser half. Registers into
 * the Plugins page's `plugins.item` slot and Settings `settings.plugins.tab` slot
 * while the Host serves the `mcp-manager` or `mcp` namespace.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mcp/client
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: ctx.configForms Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: Plugins page's SlotMap merge ('plugins.item').
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: ctx.remote Context merge.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { McpCard } from './McpCard.tsx'
import { MCP_ALT_NS, MCP_MANAGER_NS, McpCardController } from './mcp-card-controller.ts'
import { de, en, es, fr, ja, pt, ru, zh, type McpSettingsLocaleKey } from './locales.ts'

export type { McpCardProps } from './McpCard.tsx'
export type {
  McpCardFace,
  McpCardState,
  McpServerDraft,
  McpServerItem,
} from './mcp-card-controller.ts'
export type { McpSettingsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** MCP servers and tools settings page copy. */
    'settings.mcp': McpSettingsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.mcp'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'configForms']

/**
 * Mount the MCP settings page into settings and plugin management slots.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
    'ui-settings-mcp: dictionaries',
  )

  const card = new McpCardController(ctx.configForms.get(MCP_MANAGER_NS), ctx)
  ctx.effect(() => () => { card.dispose() }, 'ui-settings-mcp: controller')

  ctx.effect(
    () =>
      ctx.configForms.whileServed([MCP_MANAGER_NS, MCP_ALT_NS], () => {
        const unregisterItem = ctx.slots.inject('plugins.item', () =>
          ctx.slots.register(
            {
              name: 'plugins.item',
              id: 'mcp',
              order: 25,
              label: () => t('title'),
              locale: NS,
              inject: () => card.inject(),
            },
            McpCard,
          ))

        const unregisterTab = ctx.slots.inject('settings.plugins.tab', () =>
          ctx.slots.register(
            {
              name: 'settings.plugins.tab',
              id: 'mcp',
              order: 20,
              label: () => t('title'),
              locale: NS,
              inject: () => card.inject(),
            },
            McpCard,
          ))

        return () => {
          unregisterItem()
          unregisterTab()
        }
      }),
    'ui-settings-mcp: page',
  )
}
