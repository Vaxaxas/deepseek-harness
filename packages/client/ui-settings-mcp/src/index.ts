/**
 * MCP settings page, node half. The empty apply exists so the plugin appears
 * in the host cordis.yml / Loader; the browser half owns the page through
 * exports["./client"], discovered from the package.json dsh.client declaration.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mcp
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
