import { IconApiOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * Navigation icon for the MCP section in Settings.
 * @param props - Slot runtime props containing icon size.
 * @returns Rendered icon component.
 */
export function McpSectionIcon({ size = 16 }: PropsRuntime<'settings.section.icon'>) {
  return <IconApiOutlineRegular size={size} />
}
