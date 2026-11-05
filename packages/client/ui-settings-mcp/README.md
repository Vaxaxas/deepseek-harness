---
description: "The MCP server and tool management page on the dsh web client's Plugins page: configure, enable/disable, probe, restart, and inspect MCP servers and tools."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-mcp

English | [中文](README.zh.md)

## Summary

Open **Plugins** in the sidebar and select **MCP Servers and Tools** in the Built-in plugin settings group (or access it from the **MCP** tab under Settings Plugins) to view, add, configure, test, restart, and monitor Model Context Protocol (MCP) servers and their discovered tools. The page displays the real-time connection status of every server, streams status updates over Remote, allows live testing (probing) to discover tool definitions, enables and disables server instances, and persists server configurations safely via Settings ConfigEditor.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The **MCP Servers and Tools** card in Built-in plugin settings opens the management interface. Each server is rendered as a status-aware card displaying its connection state, transport (`stdio` or `streamable-http`), source (`Configured` or `Plugin registered`), and tool count:

- **Server Status**: Connected, Connecting, Reconnecting (with attempt count and backoff details), Waiting for credentials, Failed (with diagnostic error text), or Disabled.
- **Enable / Disable Toggle**: Toggle a configured server on or off. Disabling unmounts the child instance and withdraws all its exposed tools from the agent runtime.
- **Test connection (Probe)**: Test the server's handshake and tool discovery over Remote (`mcpManager.probe`) without disturbing the live instance, showing response duration and discovered tool names.
- **Restart**: Reset the connection and reconnect budget immediately (`mcpManager.restart`).
- **Add / Edit Server**: Open the modal dialog to configure server name, transport, executable command, arguments, working directory, environment variables, endpoint URL, HTTP headers, and timeouts. Values support `${credential:REF}` templates to keep secret tokens out of configuration files.
- **Delete Server**: Remove a configured server with confirmation.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Host half is an empty `apply`, present so the package holds a Loader row the client module system serves the browser half for. The browser half binds the `mcp-manager` (or `mcp`) namespace through `ctx.configForms.get` and manages live server views through `ctx.remote.mcpManager.watch()`. Adding, modifying, or deleting servers performs revision-fenced atomic mutations on `servers.<name>` through `ConfigForm.mutate()`. When the Host reconciles the volatile configuration, `dsh-mcp-manager` mounts or rebuilds instances and broadcasts status updates. The page registers into the Plugins page's `plugins.item` slot and Settings `settings.plugins.tab` slot while the Host serves the manager namespace.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-plugin-manager](../ui-plugin-manager/README.md) — the Plugins panel hosting built-in plugin items.
- [mcp-manager](../../mcp/mcp-manager/README.md) — the host-side server manager service.
- [mcp-client](../../mcp/mcp-client/README.md) — the per-server client connection and tool adapter.
- [ui-settings](../ui-settings/README.md) — client configuration forms and settings reflection.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side settings surface that registers no model surface.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Servers registered directly by installed plugins are read-only in Settings; their configuration is managed by the contributing plugin.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
