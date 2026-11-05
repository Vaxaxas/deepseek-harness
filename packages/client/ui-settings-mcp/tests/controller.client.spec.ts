/** Unit tests for McpCardController. */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { McpManagedServerEntry } from '@deepseek-ai/dsh-mcp-manager'
import { McpCardController } from '../src/client/mcp-card-controller.ts'

interface ConfigData {
  servers: Record<string, McpManagedServerEntry>
}

function mockConfigForm(initialServers: Record<string, McpManagedServerEntry> = {}): {
  form: ConfigForm<ConfigData>
  servers: Record<string, McpManagedServerEntry>
  mutateMock: ReturnType<typeof vi.fn>
} {
  const servers = { ...initialServers }
  const listeners = new Set<() => void>()
  const mutateMock = vi.fn((ops) => {
    for (const op of ops) {
      if (op.op === 'set') {
        const [root, name, field] = op.path
        if (root === 'servers') {
          if (field !== undefined) {
            if (servers[name]) {
              servers[name] = { ...servers[name], [field]: op.value }
            }
          } else {
            servers[name] = op.value
          }
        }
      } else if (op.op === 'unset') {
        const [root, name] = op.path
        if (root === 'servers' && name) {
          Reflect.deleteProperty(servers, name)
        }
      }
    }
    for (const l of listeners) l()
    return Promise.resolve(true)
  })

  const form: ConfigForm<ConfigData> = {
    getSnapshot: (): ConfigFormSnapshot<ConfigData> => ({
      status: 'ready',
      value: { servers },
      base: {},
      user: {},
      revision: 1,
      writable: true,
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    mutate: mutateMock,
    set: vi.fn(),
    unset: vi.fn(),
  }

  return { form, servers, mutateMock }
}

describe('McpCardController', () => {
  it('initializes with servers from config form', () => {
    const ctx = new Context()
    new TestRemote(ctx, {
      mcpManager: {
        watch: () => (async function* () {})(),
        probe: vi.fn(),
        restart: vi.fn(),
      },
    })

    const { form } = mockConfigForm({
      github: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {},
        cwd: '',
        url: '',
        headers: {},
        enabled: true,
        startupTimeoutMs: 30000,
        reconnect: { initialDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 5 },
      },
    })

    const controller = new McpCardController(form, ctx)
    const snapshot = controller.getSnapshot()

    expect(snapshot.servers).toHaveLength(1)
    expect(snapshot.servers[0]?.name).toBe('github')
    expect(snapshot.servers[0]?.configured).toBe(true)
    expect(snapshot.servers[0]?.enabled).toBe(true)
    expect(snapshot.servers[0]?.detail).toBe('npx -y @modelcontextprotocol/server-github')

    controller.dispose()
  })

  it('validates server draft when saving', async () => {
    const ctx = new Context()
    new TestRemote(ctx, {
      mcpManager: {
        watch: () => (async function* () {})(),
      },
    })
    const { form, mutateMock } = mockConfigForm()
    const controller = new McpCardController(form, ctx)

    // Invalid name
    const res1 = await controller.saveServer({
      name: 'invalid name with spaces',
      transport: 'stdio',
      command: 'echo',
      args: [],
      env: {},
      cwd: '',
      url: '',
      headers: {},
      enabled: true,
    })
    expect(res1).toBe(false)
    expect(controller.getSnapshot().dialogError).toBe('invalidName')

    // Empty command for stdio
    const res2 = await controller.saveServer({
      name: 'my-server',
      transport: 'stdio',
      command: '   ',
      args: [],
      env: {},
      cwd: '',
      url: '',
      headers: {},
      enabled: true,
    })
    expect(res2).toBe(false)
    expect(controller.getSnapshot().dialogError).toBe('commandRequired')

    // Empty url for streamable-http
    const res3 = await controller.saveServer({
      name: 'my-server',
      transport: 'streamable-http',
      command: '',
      args: [],
      env: {},
      cwd: '',
      url: '   ',
      headers: {},
      enabled: true,
    })
    expect(res3).toBe(false)
    expect(controller.getSnapshot().dialogError).toBe('urlRequired')

    // Invalid url scheme
    const res4 = await controller.saveServer({
      name: 'my-server',
      transport: 'streamable-http',
      command: '',
      args: [],
      env: {},
      cwd: '',
      url: 'ftp://example.com',
      headers: {},
      enabled: true,
    })
    expect(res4).toBe(false)
    expect(controller.getSnapshot().dialogError).toBe('invalidUrl')

    // Valid stdio server
    const res5 = await controller.saveServer({
      name: 'local-stdio',
      transport: 'stdio',
      command: 'python',
      args: ['server.py'],
      env: { FOO: 'bar' },
      cwd: '/tmp',
      url: '',
      headers: {},
      enabled: true,
    })
    expect(res5).toBe(true)
    expect(mutateMock).toHaveBeenCalled()
    expect(controller.getSnapshot().dialogError).toBeUndefined()

    controller.dispose()
  })

  it('toggles enabled state and deletes server', async () => {
    const ctx = new Context()
    new TestRemote(ctx, {
      mcpManager: {
        watch: () => (async function* () {})(),
      },
    })
    const { form, mutateMock } = mockConfigForm({
      fetcher: {
        transport: 'streamable-http',
        command: '',
        args: [],
        env: {},
        cwd: '',
        url: 'https://mcp.example.com',
        headers: {},
        enabled: true,
        startupTimeoutMs: 30000,
        reconnect: { initialDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 5 },
      },
    })

    const controller = new McpCardController(form, ctx)

    // Toggle enabled
    await controller.toggleEnabled('fetcher')
    expect(mutateMock).toHaveBeenCalledWith([
      { op: 'set', path: ['servers', 'fetcher', 'enabled'], value: false },
    ])

    // Delete server
    controller.openDeleteConfirm('fetcher')
    expect(controller.getSnapshot().deleteTarget).toBe('fetcher')
    await controller.confirmDelete()
    expect(mutateMock).toHaveBeenCalledWith([
      { op: 'unset', path: ['servers', 'fetcher'] },
    ])
    expect(controller.getSnapshot().deleteTarget).toBeUndefined()

    controller.dispose()
  })

  it('runs probe and restart via remote', async () => {
    const ctx = new Context()
    const probeMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        toolNames: ['read_file', 'write_file'],
        durationMs: 42,
        serverInfo: { name: 'test-server', version: '1.0' },
        closeConfirmed: true,
      }),
    )
    const restartMock = vi.fn(() => Promise.resolve({ ok: true }))

    new TestRemote(ctx, {
      mcpManager: {
        watch: () => (async function* () {})(),
        probe: probeMock,
        restart: restartMock,
      },
    })

    const { form } = mockConfigForm({
      srv: {
        transport: 'stdio',
        command: 'srv',
        args: [],
        env: {},
        cwd: '',
        url: '',
        headers: {},
        enabled: true,
        startupTimeoutMs: 30000,
        reconnect: { initialDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 5 },
      },
    })

    const controller = new McpCardController(form, ctx)

    const probeResult = await controller.probeServer('srv')
    expect(probeMock).toHaveBeenCalledWith('srv', expect.any(AbortSignal))
    expect(probeResult?.ok).toBe(true)
    expect(controller.getSnapshot().servers[0]?.tools).toEqual(['read_file', 'write_file'])

    await controller.restartServer('srv')
    expect(restartMock).toHaveBeenCalledWith('srv')

    controller.dispose()
  })
})
