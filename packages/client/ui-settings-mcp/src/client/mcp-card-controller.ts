/**
 * Controller for the MCP settings card: manages configured and registered
 * MCP servers, live status streaming via Remote, probe and restart operations,
 * and Settings form mutations for server configuration.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mcp/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { McpManagedServerEntry } from '@deepseek-ai/dsh-mcp-manager'
import type { McpManagedServerStatus, McpManagedServerView } from '@deepseek-ai/dsh-mcp-manager/types'
import type { McpProbeResult } from '@deepseek-ai/dsh-mcp-client/types'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { McpSettingsLocaleKey } from './locales.ts'

/** Namespaces this page binds over Settings. */
export const MCP_MANAGER_NS = 'mcp-manager'
/** Alternate namespace alias when manager entry is named `mcp`. */
export const MCP_ALT_NS = 'mcp'

/** Server name regex: 1 to 32 characters of [A-Za-z0-9_-]. */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** Draft model used when adding or editing an MCP server in the dialog. */
export interface McpServerDraft {
  name: string
  transport: 'stdio' | 'streamable-http'
  command: string
  args: string[]
  env: Record<string, string>
  cwd: string
  url: string
  headers: Record<string, string>
  enabled: boolean
  startupTimeoutMs?: number
  toolCallTimeoutMs?: number
}

/** One server item as displayed in the UI card. */
export interface McpServerItem {
  name: string
  configured: boolean
  registered: boolean
  enabled: boolean
  transport?: 'stdio' | 'streamable-http'
  detail: string
  entry?: McpManagedServerEntry
  status: McpManagedServerStatus
  toolCount?: number
  tools?: string[]
  lastError?: string
  probing: boolean
  restarting: boolean
  probeResult?: McpProbeResult
}

/** Synchronous snapshot of the MCP card state. */
export interface McpCardState {
  available: boolean
  writable: boolean
  saving: boolean
  servers: readonly McpServerItem[]
  dialogOpen: boolean
  editingServer?: McpServerDraft
  dialogError?: McpSettingsLocaleKey
  deleteTarget?: string
}

/** Injected face and action handlers exposed to React components. */
export interface McpCardFace {
  hooks: {
    mcpCard: HostObservable<McpCardState>
  }
  toggleEnabled: (name: string) => Promise<boolean>
  restartServer: (name: string) => Promise<void>
  probeServer: (name: string) => Promise<McpProbeResult | undefined>
  deleteServer: (name: string) => Promise<boolean>
  openAddServer: () => void
  openEditServer: (name: string) => void
  closeDialog: () => void
  openDeleteConfirm: (name: string) => void
  closeDeleteConfirm: () => void
  confirmDelete: () => Promise<boolean>
  saveServer: (draft: McpServerDraft) => Promise<boolean>
}

/** Remote face for MCP operations. */
interface McpRemoteOperations {
  watch?: (signal?: AbortSignal) => AsyncIterable<McpManagedServerView[]>
  restart?: (name: string) => Promise<{ ok: boolean; error?: { message: string } }>
  probe?: (
    name: string,
    signal?: AbortSignal,
  ) => Promise<{ ok: boolean; value?: McpProbeResult; error?: { message: string } } | McpProbeResult>
}

/** Client remote shape holding optional MCP and stream helpers. */
interface ClientRemoteMcpScope {
  mcpManager?: McpRemoteOperations
  $stream?: (opts: {
    name: string
    open: (signal: AbortSignal) => AsyncIterable<McpManagedServerView[]>
    ended: () => Error
  }) => {
    dispose: () => Promise<void>
    [Symbol.asyncIterator]: () => AsyncIterator<{ value: McpManagedServerView[]; accept: () => void }>
  }
}

/**
 * Controller managing the state and actions of the MCP settings card.
 */
export class McpCardController {
  private readonly store: SnapshotStore<McpCardState>
  private serverViews: McpManagedServerView[] = []
  private readonly probing = new Set<string>()
  private readonly restarting = new Set<string>()
  private readonly probeResults = new Map<string, McpProbeResult>()
  private dialogOpen = false
  private editingServer?: McpServerDraft
  private dialogError?: McpSettingsLocaleKey
  private deleteTarget?: string
  private saving = false
  private streamDisposer?: () => Promise<void>
  private readonly abortController = new AbortController()
  private readonly unsubs: Array<() => void> = []

  constructor(
    private readonly form: ConfigForm<{ servers: Record<string, McpManagedServerEntry> }>,
    private readonly ctx: ClientContext,
  ) {
    this.store = createSnapshotStore(this.buildState())
    this.unsubs.push(
      form.subscribe(() => { this.derive() }),
      ctx.on('connection/reset', () => { this.startWatch() }),
      ctx.on('internal/service', (name: string) => {
        if (name === 'remote.mcpManager') this.startWatch()
      }),
    )
    this.startWatch()
    this.derive()
  }

  private getMcpManager(): McpRemoteOperations | undefined {
    return this.ctx.get('remote.mcpManager') as McpRemoteOperations | undefined
  }

  /**
   * Read the current synchronized MCP card state.
   * @returns Stable snapshot of the current state.
   */
  getSnapshot(): McpCardState {
    return this.store.getSnapshot()
  }

  /**
   * Subscribe to state replacements.
   * @param listener - Function invoked after state changes.
   * @returns Disposer function.
   */
  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener)
  }

  /**
   * Derive unified server items from the Settings config and live Remote stream.
   */
  private derive(): void {
    const next = this.buildState()
    this.store.set(next)
  }

  private buildState(): McpCardState {
    const formSnap = this.form.getSnapshot()
    const available = formSnap.status === 'ready'
    const writable = formSnap.writable
    const configuredServers = formSnap.value?.servers ?? {}

    const knownNames = new Set([
      ...Object.keys(configuredServers),
      ...this.serverViews.map(view => view.name),
    ])

    const servers: McpServerItem[] = []
    for (const name of knownNames) {
      const entry = configuredServers[name]
      const view = this.serverViews.find(v => v.name === name)
      const configured = entry !== undefined
      const registered = !configured && (view?.configured === false)
      const enabled = entry?.enabled ?? (view ? view.status.state !== 'disabled' : true)

      const status: McpManagedServerStatus = view?.status ?? (
        enabled ? { state: 'connecting', attempt: 0 } : { state: 'disabled' }
      )

      let toolCount: number | undefined
      if (status.state === 'connected') {
        toolCount = status.toolCount
      }

      let lastError: string | undefined
      if ('lastError' in status && typeof status.lastError === 'string') {
        lastError = status.lastError
      }

      const probeResult = this.probeResults.get(name)
      let tools: string[] | undefined
      if (probeResult && probeResult.ok) {
        tools = probeResult.toolNames
      }

      const transport = entry?.transport
      let detail = ''
      if (entry) {
        if (entry.transport === 'stdio') {
          detail = entry.command + (entry.args.length > 0 ? ` ${entry.args.join(' ')}` : '')
        } else {
          detail = entry.url
        }
      }

      const item: McpServerItem = {
        name,
        configured,
        registered,
        enabled,
        detail,
        status,
        probing: this.probing.has(name),
        restarting: this.restarting.has(name),
      }
      if (transport !== undefined) item.transport = transport
      if (entry !== undefined) item.entry = entry
      if (toolCount !== undefined) item.toolCount = toolCount
      if (tools !== undefined) item.tools = tools
      if (lastError !== undefined) item.lastError = lastError
      if (probeResult !== undefined) item.probeResult = probeResult

      servers.push(item)
    }

    servers.sort((a, b) => a.name.localeCompare(b.name))

    const state: McpCardState = {
      available,
      writable,
      saving: this.saving,
      servers,
      dialogOpen: this.dialogOpen,
    }
    if (this.editingServer !== undefined) state.editingServer = this.editingServer
    if (this.dialogError !== undefined) state.dialogError = this.dialogError
    if (this.deleteTarget !== undefined) state.deleteTarget = this.deleteTarget

    return state
  }

  /**
   * Start live watch stream from remote mcpManager.
   */
  startWatch(): void {
    if (this.streamDisposer) {
      void this.streamDisposer().catch(() => undefined)
      delete this.streamDisposer
    }
    const mcpManager = this.getMcpManager()
    const watch = mcpManager?.watch
    if (typeof watch !== 'function') return

    const remote = this.ctx.get('remote') as ClientRemoteMcpScope | undefined
    const streamMethod = remote?.$stream
    if (typeof streamMethod === 'function') {
      try {
        const stream = streamMethod.call(remote, {
          name: 'mcp-manager-watch',
          open: signal => watch(signal),
          ended: () => new Error('mcpManager stream ended'),
        })
        this.streamDisposer = () => stream.dispose()
        void (async () => {
          try {
            for await (const frame of stream) {
              this.serverViews = frame.value
              frame.accept()
              this.derive()
            }
          } catch {
            // carrier or stream ended
          }
        })()
        return
      } catch {
        // fall back to direct iteration
      }
    }

    const signal = this.abortController.signal
    void (async () => {
      try {
        const iterator = watch(signal)
        for await (const views of iterator) {
          if (signal.aborted) break
          this.serverViews = views
          this.derive()
        }
      } catch {
        // stream ended
      }
    })()
  }

  /**
   * Toggle server enabled state in config.
   * @param name - Server key.
   * @returns True if the mutation succeeded.
   */
  async toggleEnabled(name: string): Promise<boolean> {
    const state = this.getSnapshot()
    const item = state.servers.find(s => s.name === name)
    if (!item || !item.configured) return false

    const next = !item.enabled
    return await this.form.mutate([
      { op: 'set', path: ['servers', name, 'enabled'], value: next },
    ])
  }

  /**
   * Restart server connection over Remote.
   * @param name - Server key.
   */
  async restartServer(name: string): Promise<void> {
    if (this.restarting.has(name)) return
    this.restarting.add(name)
    this.derive()

    try {
      const mcpManager = this.getMcpManager()
      if (mcpManager && typeof mcpManager.restart === 'function') {
        const res = await mcpManager.restart(name)
        if (res && res.ok === false) {
          throw new Error(res.error?.message ?? 'restart failed')
        }
      }
    } finally {
      this.restarting.delete(name)
      this.derive()
    }
  }

  /**
   * Probe an MCP server over Remote.
   * @param name - Server key.
   * @returns The probe outcome, or undefined if remote is unavailable.
   */
  async probeServer(name: string): Promise<McpProbeResult | undefined> {
    if (this.probing.has(name)) return
    this.probing.add(name)
    this.derive()

    try {
      const mcpManager = this.getMcpManager()

      if (mcpManager && typeof mcpManager.probe === 'function') {
        const res = await mcpManager.probe(name, this.abortController.signal)
        let outcome: McpProbeResult | undefined
        if (res && 'ok' in res) {
          if (res.ok === true && 'value' in res) {
            outcome = res.value
          } else if (res.ok === false && 'message' in res) {
            outcome = res as McpProbeResult
          } else if (res.ok === false && 'error' in res) {
            outcome = {
              ok: false,
              stage: 'connect',
              message: res.error?.message ?? 'probe failed',
              durationMs: 0,
              closeConfirmed: true,
            }
          } else {
            outcome = res as McpProbeResult
          }
        }
        if (outcome) {
          this.probeResults.set(name, outcome)
        }
        return outcome
      }
      return undefined
    } catch (error) {
      const failure: McpProbeResult = {
        ok: false,
        stage: 'connect',
        message: error instanceof Error ? error.message : String(error),
        durationMs: 0,
        closeConfirmed: true,
      }
      this.probeResults.set(name, failure)
      return failure
    } finally {
      this.probing.delete(name)
      this.derive()
    }
  }

  /**
   * Open the add server dialog.
   */
  openAddServer(): void {
    this.dialogOpen = true
    this.editingServer = {
      name: '',
      transport: 'stdio',
      command: '',
      args: [],
      env: {},
      cwd: '',
      url: '',
      headers: {},
      enabled: true,
      startupTimeoutMs: 30000,
    }
    delete this.dialogError
    this.derive()
  }

  /**
   * Open the edit server dialog for a configured server.
   * @param name - Server key.
   */
  openEditServer(name: string): void {
    const item = this.getSnapshot().servers.find(s => s.name === name)
    if (!item || !item.entry) return

    this.dialogOpen = true
    const draft: McpServerDraft = {
      name: item.name,
      transport: item.entry.transport,
      command: item.entry.command ?? '',
      args: [...(item.entry.args ?? [])],
      env: { ...(item.entry.env ?? {}) },
      cwd: item.entry.cwd ?? '',
      url: item.entry.url ?? '',
      headers: { ...(item.entry.headers ?? {}) },
      enabled: item.entry.enabled,
      startupTimeoutMs: item.entry.startupTimeoutMs ?? 30000,
    }
    if (item.entry.toolCallTimeoutMs !== undefined) {
      draft.toolCallTimeoutMs = item.entry.toolCallTimeoutMs
    }

    this.editingServer = draft
    delete this.dialogError
    this.derive()
  }

  /**
   * Close the add/edit server dialog.
   */
  closeDialog(): void {
    this.dialogOpen = false
    delete this.editingServer
    delete this.dialogError
    this.derive()
  }

  /**
   * Open delete confirmation dialog.
   * @param name - Server key.
   */
  openDeleteConfirm(name: string): void {
    this.deleteTarget = name
    this.derive()
  }

  /**
   * Close delete confirmation dialog.
   */
  closeDeleteConfirm(): void {
    delete this.deleteTarget
    this.derive()
  }

  /**
   * Confirm deletion of the target server.
   * @returns True if the delete mutation succeeded.
   */
  async confirmDelete(): Promise<boolean> {
    const name = this.deleteTarget
    if (!name) return false
    delete this.deleteTarget
    this.derive()
    return await this.deleteServer(name)
  }

  /**
   * Delete a configured server from settings.
   * @param name - Server key.
   * @returns True if the unset mutation succeeded.
   */
  async deleteServer(name: string): Promise<boolean> {
    return await this.form.mutate([
      { op: 'unset', path: ['servers', name] },
    ])
  }

  /**
   * Validate and save an MCP server draft.
   * @param draft - Authoring draft of the server.
   * @returns True if validation passed and mutation succeeded.
   */
  async saveServer(draft: McpServerDraft): Promise<boolean> {
    const name = draft.name.trim()
    if (!SERVER_NAME_PATTERN.test(name)) {
      this.dialogError = 'invalidName'
      this.derive()
      return false
    }

    const state = this.getSnapshot()
    const isNew = state.servers.every(s => s.name !== name)
    if (this.editingServer?.name !== name && !isNew) {
      this.dialogError = 'nameTaken'
      this.derive()
      return false
    }

    if (draft.transport === 'stdio') {
      if (draft.command.trim() === '') {
        this.dialogError = 'commandRequired'
        this.derive()
        return false
      }
    } else {
      if (draft.url.trim() === '') {
        this.dialogError = 'urlRequired'
        this.derive()
        return false
      }
      const urlLower = draft.url.trim().toLowerCase()
      if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
        this.dialogError = 'invalidUrl'
        this.derive()
        return false
      }
    }

    this.saving = true
    delete this.dialogError
    this.derive()

    const entry: Record<string, unknown> = draft.transport === 'stdio'
      ? {
        transport: 'stdio',
        command: draft.command.trim(),
        args: draft.args,
        env: draft.env,
        cwd: draft.cwd.trim(),
        url: '',
        headers: {},
        enabled: draft.enabled,
        startupTimeoutMs: draft.startupTimeoutMs ?? 30000,
        reconnect: { initialDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 5 },
        ...(draft.toolCallTimeoutMs !== undefined ? { toolCallTimeoutMs: draft.toolCallTimeoutMs } : {}),
      }
      : {
        transport: 'streamable-http',
        url: draft.url.trim(),
        headers: draft.headers,
        command: '',
        args: [],
        env: {},
        cwd: '',
        enabled: draft.enabled,
        startupTimeoutMs: draft.startupTimeoutMs ?? 30000,
        reconnect: { initialDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 5 },
        ...(draft.toolCallTimeoutMs !== undefined ? { toolCallTimeoutMs: draft.toolCallTimeoutMs } : {}),
      }

    try {
      const success = await this.form.mutate([
        { op: 'set', path: ['servers', name], value: entry as JsonValue },
      ])
      if (success) {
        this.dialogOpen = false
        delete this.editingServer
        delete this.dialogError
      } else {
        this.dialogError = 'saveFailed'
      }
      return success
    } finally {
      this.saving = false
      this.derive()
    }
  }

  /**
   * Component injection face.
   * @returns The bound face with hooks and actions.
   */
  inject(): McpCardFace {
    return {
      hooks: {
        mcpCard: {
          getSnapshot: () => this.getSnapshot(),
          subscribe: listener => this.subscribe(listener),
        },
      },
      toggleEnabled: name => this.toggleEnabled(name),
      restartServer: name => this.restartServer(name),
      probeServer: name => this.probeServer(name),
      deleteServer: name => this.deleteServer(name),
      openAddServer: () => { this.openAddServer() },
      openEditServer: (name) => { this.openEditServer(name) },
      closeDialog: () => { this.closeDialog() },
      openDeleteConfirm: (name) => { this.openDeleteConfirm(name) },
      closeDeleteConfirm: () => { this.closeDeleteConfirm() },
      confirmDelete: () => this.confirmDelete(),
      saveServer: draft => this.saveServer(draft),
    }
  }

  /**
   * Dispose subscriptions and pending streams.
   */
  dispose(): void {
    this.abortController.abort()
    if (this.streamDisposer) {
      void this.streamDisposer().catch(() => undefined)
      delete this.streamDisposer
    }
    for (const unsub of this.unsubs) unsub()
    this.unsubs.length = 0
  }
}
