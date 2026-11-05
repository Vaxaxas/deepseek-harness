/**
 * Card representing one MCP server instance, its live status, and operations.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mcp/client
 */

import { useState } from 'react'
import {
  Button,
  IconChevronDownOutlineRegular,
  IconChevronUpOutlineRegular,
  IconEditOutlineRegular,
  IconInspectOutlineRegular,
  IconRefreshOutlineRegular,
  IconTrashOutlineRegular,
  StateDot,
  Switch,
  type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { McpSettingsLocaleKey } from './locales.ts'
import type { McpServerItem } from './mcp-card-controller.ts'
import css from './McpServerCard.module.css'

/** Props for one MCP server card. */
export interface McpServerCardProps {
  server: McpServerItem
  t: (key: McpSettingsLocaleKey, params?: Record<string, string | number>) => string
  onToggleEnabled: (name: string) => void
  onProbe: (name: string) => void
  onRestart: (name: string) => void
  onEdit: (name: string) => void
  onDelete: (name: string) => void
}

/** Determine visual dot state and label key for a server's status. */
function statusPresentation(status: McpServerItem['status']): {
  dot: StateDotState
  key: McpSettingsLocaleKey
} {
  switch (status.state) {
    case 'connected':
      return { dot: 'done', key: 'statusConnected' }
    case 'connecting':
      return { dot: 'ongoing', key: 'statusConnecting' }
    case 'reconnecting':
      return { dot: 'warning', key: 'statusReconnecting' }
    case 'waiting-credentials':
      return { dot: 'warning', key: 'statusWaitingCredentials' }
    case 'failed':
      return { dot: 'error', key: 'statusFailed' }
    case 'disabled':
      return { dot: 'idle', key: 'statusDisabled' }
    case 'closed':
      return { dot: 'idle', key: 'statusClosed' }
    default:
      return { dot: 'idle', key: 'statusDisabled' }
  }
}

/**
 * Render one MCP server row in the fleet list.
 */
export function McpServerCard({
  server,
  t,
  onToggleEnabled,
  onProbe,
  onRestart,
  onEdit,
  onDelete,
}: McpServerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const presentation = statusPresentation(server.status)

  const hasDetails =
    server.detail !== '' ||
    server.lastError !== undefined ||
    server.probeResult !== undefined ||
    server.tools !== undefined ||
    server.toolCount !== undefined

  return (
    <div className={css.card} data-mcp-server={server.name}>
      <div className={css.header}>
        <div className={css.left}>
          <div className={css.titleGroup}>
            <span className={css.statusPill}>
              <StateDot state={presentation.dot} size={8} />
              <span>{t(presentation.key)}</span>
            </span>
            <h4 className={css.name}>{server.name}</h4>
            <span className={css.sourcePill}>
              {server.configured ? t('sourceConfigured') : t('sourcePlugin')}
            </span>
            {server.toolCount !== undefined && (
              <span className={css.sourcePill}>
                {t('toolsCount', { count: server.toolCount })}
              </span>
            )}
          </div>
        </div>

        <div className={css.actions}>
          {server.configured && (
            <Switch
              checked={server.enabled}
              onChange={() => { onToggleEnabled(server.name) }}
              label={server.enabled ? t('disable') : t('enable')}
              title={server.enabled ? t('disable') : t('enable')}
            />
          )}

          <Button
            variant="ghost"
            size="sm"
            icon={<IconInspectOutlineRegular size={14} />}
            disabled={server.probing || server.restarting}
            onClick={() => {
              setExpanded(true)
              onProbe(server.name)
            }}
          >
            {server.probing ? t('probing') : t('probe')}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            icon={<IconRefreshOutlineRegular size={14} />}
            disabled={server.probing || server.restarting || !server.enabled}
            aria-label={t('restart')}
            title={t('restart')}
            onClick={() => { onRestart(server.name) }}
          />

          {server.configured && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<IconEditOutlineRegular size={14} />}
                aria-label={t('edit')}
                title={t('edit')}
                onClick={() => { onEdit(server.name) }}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<IconTrashOutlineRegular size={14} />}
                aria-label={t('delete')}
                title={t('delete')}
                onClick={() => { onDelete(server.name) }}
              />
            </>
          )}

          {hasDetails && (
            <Button
              variant="ghost"
              size="sm"
              icon={
                expanded ? (
                  <IconChevronUpOutlineRegular size={14} />
                ) : (
                  <IconChevronDownOutlineRegular size={14} />
                )
              }
              aria-label={expanded ? t('closeLabel') : t('toolsHeading')}
              onClick={() => { setExpanded(v => !v) }}
            />
          )}
        </div>
      </div>

      {server.detail !== '' && <p className={css.snippet}>{server.detail}</p>}

      {expanded && hasDetails && (
        <div className={css.body}>
          {server.lastError !== undefined && (
            <div className={css.errorBanner} role="alert">
              {t('lastError', { error: server.lastError })}
            </div>
          )}

          {server.probeResult !== undefined && (
            <>
              {server.probeResult.ok ? (
                <div className={css.probeSuccessBanner}>
                  <div className={css.probeHeader}>
                    <span>{t('probeSuccess')}</span>
                    <span className={css.probeMeta}>
                      {t('duration', { ms: server.probeResult.durationMs })}
                    </span>
                  </div>
                  {server.probeResult.serverInfo && (
                    <div className={css.probeMeta}>
                      {`${server.probeResult.serverInfo.name} (${server.probeResult.serverInfo.version})`}
                    </div>
                  )}
                </div>
              ) : (
                <div className={css.errorBanner} role="alert">
                  <div>{t('probeFailed')} ({server.probeResult.stage})</div>
                  <div>{server.probeResult.message}</div>
                  <div className={css.probeMeta}>
                    {t('duration', { ms: server.probeResult.durationMs })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className={css.toolsSection}>
            <div className={css.toolsHeader}>
              <span>{t('toolsHeading')}</span>
              {server.tools && server.tools.length > 0 && (
                <span>{t('toolsCount', { count: server.tools.length })}</span>
              )}
            </div>

            {server.tools && server.tools.length > 0 ? (
              <div className={css.toolGrid}>
                {server.tools.map(tool => (
                  <span key={tool} className={css.toolTag}>
                    {tool}
                  </span>
                ))}
              </div>
            ) : server.toolCount !== undefined && server.toolCount > 0 ? (
              <div className={css.toolsHeader}>
                <span className={css.noTools}>
                  {t('toolsCount', { count: server.toolCount })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { onProbe(server.name) }}
                  disabled={server.probing}
                >
                  {t('probe')}
                </Button>
              </div>
            ) : (
              <p className={css.noTools}>{t('noToolsDiscovered')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
