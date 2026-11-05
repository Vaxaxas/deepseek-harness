// @vitest-environment jsdom
/** Tests for McpCard component presentation and user interactions. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { McpCard, type McpCardProps } from '../src/client/McpCard.tsx'
import type { McpCardFace, McpCardState } from '../src/client/mcp-card-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = ((key: keyof typeof en, params?: Record<string, unknown>) =>
  en[key].replace(/\{(\w+)\}/g, (match, name: string) => (params !== undefined && name in params ? String(params[name]) : match))) as McpCardProps['t']

function emptyState(): McpCardState {
  return {
    available: true,
    writable: true,
    saving: false,
    servers: [],
    dialogOpen: false,
  }
}

function singleServerState(): McpCardState {
  return {
    available: true,
    writable: true,
    saving: false,
    servers: [
      {
        name: 'test-mcp',
        configured: true,
        registered: false,
        enabled: true,
        transport: 'stdio',
        detail: 'npx -y @mcp/server',
        status: { state: 'connected', toolCount: 3, connectedAt: Date.now() },
        toolCount: 3,
        tools: ['tool_a', 'tool_b', 'tool_c'],
        probing: false,
        restarting: false,
      },
    ],
    dialogOpen: false,
  }
}

function cardActions(): Omit<McpCardFace, 'hooks'> {
  return {
    toggleEnabled: vi.fn(() => Promise.resolve(true)),
    restartServer: vi.fn(() => Promise.resolve()),
    probeServer: vi.fn(() => Promise.resolve(undefined)),
    deleteServer: vi.fn(() => Promise.resolve(true)),
    openAddServer: vi.fn(),
    openEditServer: vi.fn(),
    closeDialog: vi.fn(),
    openDeleteConfirm: vi.fn(),
    closeDeleteConfirm: vi.fn(),
    confirmDelete: vi.fn(() => Promise.resolve(true)),
    saveServer: vi.fn(() => Promise.resolve(true)),
  }
}

function renderCard(state: McpCardState = emptyState(), view: 'page' | 'summary' = 'page') {
  const store = createSnapshotStore<McpCardState>(state)
  const actions = cardActions()
  const props = {
    ...actions,
    view,
    t,
    useMcpCard: bindSnapshotSelector(store),
  } as unknown as McpCardProps
  render(<McpCard {...props} />)
  return { actions, store }
}

describe('McpCard', () => {
  it('renders summary view correctly', () => {
    renderCard(emptyState(), 'summary')
    expect(document.body.textContent).toBe(en.description)
  })

  it('renders empty state when no servers configured', () => {
    const { actions } = renderCard(emptyState(), 'page')
    expect(screen.getByText(en.emptyTitle)).toBeTruthy()
    expect(screen.getByText(en.emptyDescription)).toBeTruthy()

    const addButtons = screen.getAllByRole('button', { name: en.addServer })
    expect(addButtons.length).toBeGreaterThan(0)
    fireEvent.click(addButtons[0]!)
    expect(actions.openAddServer).toHaveBeenCalled()
  })

  it('renders server list with status and actions', () => {
    const { actions } = renderCard(singleServerState(), 'page')

    expect(screen.getByText('test-mcp')).toBeTruthy()
    expect(screen.getByText(en.statusConnected)).toBeTruthy()
    expect(screen.getByText(en.sourceConfigured)).toBeTruthy()
    expect(screen.getByText('npx -y @mcp/server')).toBeTruthy()

    // Probe button
    const probeBtn = screen.getByRole('button', { name: en.probe })
    fireEvent.click(probeBtn)
    expect(actions.probeServer).toHaveBeenCalledWith('test-mcp')

    // Restart button
    const restartBtn = screen.getByRole('button', { name: en.restart })
    fireEvent.click(restartBtn)
    expect(actions.restartServer).toHaveBeenCalledWith('test-mcp')

    // Edit button
    const editBtn = screen.getByRole('button', { name: en.edit })
    fireEvent.click(editBtn)
    expect(actions.openEditServer).toHaveBeenCalledWith('test-mcp')

    // Delete button
    const deleteBtn = screen.getByRole('button', { name: en.delete })
    fireEvent.click(deleteBtn)
    expect(actions.openDeleteConfirm).toHaveBeenCalledWith('test-mcp')
  })

  it('toggles server enabled state via switch', () => {
    const { actions } = renderCard(singleServerState(), 'page')
    const switchBtn = screen.getByRole('switch')
    fireEvent.click(switchBtn)
    expect(actions.toggleEnabled).toHaveBeenCalledWith('test-mcp')
  })
})
