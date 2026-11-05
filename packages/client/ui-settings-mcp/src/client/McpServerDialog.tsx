/**
 * Dialog for adding or editing an MCP server configuration.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mcp/client
 */

import { useState } from 'react'
import {
  Button,
  IconChevronDownOutlineRegular,
  IconChevronUpOutlineRegular,
  IconPlusOutlineRegular,
  IconTrashOutlineRegular,
  Input,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { McpSettingsLocaleKey } from './locales.ts'
import type { McpServerDraft } from './mcp-card-controller.ts'
import css from './McpServerDialog.module.css'

/** Key-value row for env vars or headers. */
interface KeyValueRow {
  id: string
  key: string
  value: string
}

/** Props for the MCP server configuration dialog. */
export interface McpServerDialogProps {
  open: boolean
  draft?: McpServerDraft | undefined
  saving: boolean
  error?: McpSettingsLocaleKey | undefined
  t: (key: McpSettingsLocaleKey, params?: Record<string, string | number>) => string
  onClose: () => void
  onSave: (draft: McpServerDraft) => void
}

/**
 * Render the Add/Edit MCP server modal dialog.
 */
export function McpServerDialog({
  open,
  draft,
  saving,
  error,
  t,
  onClose,
  onSave,
}: McpServerDialogProps) {
  const isEditing = draft !== undefined && draft.name !== ''

  const [name, setName] = useState(draft?.name ?? '')
  const [transport, setTransport] = useState<'stdio' | 'streamable-http'>(
    draft?.transport ?? 'stdio',
  )
  const [command, setCommand] = useState(draft?.command ?? '')
  const [argsText, setArgsText] = useState((draft?.args ?? []).join('\n'))
  const [cwd, setCwd] = useState(draft?.cwd ?? '')
  const [url, setUrl] = useState(draft?.url ?? '')
  const [envRows, setEnvRows] = useState<KeyValueRow[]>(() =>
    Object.entries(draft?.env ?? {}).map(([key, value], idx) => ({
      id: `env_${String(idx)}`,
      key,
      value,
    })),
  )
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>(() =>
    Object.entries(draft?.headers ?? {}).map(([key, value], idx) => ({
      id: `hdr_${String(idx)}`,
      key,
      value,
    })),
  )
  const [startupTimeoutMs, setStartupTimeoutMs] = useState(
    draft?.startupTimeoutMs ? String(draft.startupTimeoutMs) : '30000',
  )
  const [toolCallTimeoutMs, setToolCallTimeoutMs] = useState(
    draft?.toolCallTimeoutMs ? String(draft.toolCallTimeoutMs) : '',
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (!open) return null

  const addEnvRow = (): void => {
    setEnvRows(rows => [
      ...rows,
      { id: `env_${String(Date.now())}_${String(rows.length)}`, key: '', value: '' },
    ])
  }

  const removeEnvRow = (id: string): void => {
    setEnvRows(rows => rows.filter(r => r.id !== id))
  }

  const updateEnvRow = (id: string, field: 'key' | 'value', val: string): void => {
    setEnvRows(rows => rows.map(r => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const addHeaderRow = (): void => {
    setHeaderRows(rows => [
      ...rows,
      { id: `hdr_${String(Date.now())}_${String(rows.length)}`, key: '', value: '' },
    ])
  }

  const removeHeaderRow = (id: string): void => {
    setHeaderRows(rows => rows.filter(r => r.id !== id))
  }

  const updateHeaderRow = (id: string, field: 'key' | 'value', val: string): void => {
    setHeaderRows(rows => rows.map(r => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const handleSave = (): void => {
    const env: Record<string, string> = {}
    for (const r of envRows) {
      const k = r.key.trim()
      if (k !== '') env[k] = r.value
    }

    const headers: Record<string, string> = {}
    for (const r of headerRows) {
      const k = r.key.trim()
      if (k !== '') headers[k] = r.value
    }

    const parsedArgs = argsText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    const startupTimeout = Number.parseInt(startupTimeoutMs, 10)
    const toolTimeout = toolCallTimeoutMs.trim() ? Number.parseInt(toolCallTimeoutMs, 10) : undefined

    onSave({
      name: name.trim(),
      transport,
      command: command.trim(),
      args: parsedArgs,
      env,
      cwd: cwd.trim(),
      url: url.trim(),
      headers,
      enabled: draft?.enabled ?? true,
      startupTimeoutMs: Number.isFinite(startupTimeout) && startupTimeout > 0 ? startupTimeout : 30000,
      ...(toolTimeout !== undefined && Number.isFinite(toolTimeout) ? { toolCallTimeoutMs: toolTimeout } : {}),
    })
  }

  const footer = (
    <div className={css.footer}>
      <Button variant="ghost" onClick={onClose} disabled={saving}>
        {t('cancel')}
      </Button>
      <Button variant="primary" onClick={handleSave} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('editServer') : t('addServer')}
      closeLabel={t('closeLabel')}
      footer={footer}
    >
      <div className={css.form}>
        {error !== undefined && (
          <div className={css.errorBanner} role="alert">
            {t(error)}
          </div>
        )}

        <div className={css.field}>
          <label htmlFor="mcp-server-name-input" className={css.label}>
            {t('serverName')}
          </label>
          <Input
            id="mcp-server-name-input"
            value={name}
            onChange={(e) => { setName(e.target.value) }}
            disabled={isEditing || saving}
            placeholder={t('serverName')}
          />
          <p className={css.hint}>{t('serverNameHint')}</p>
        </div>

        <div className={css.field}>
          <span className={css.label}>{t('transport')}</span>
          <div className={css.segmented} role="radiogroup" aria-label={t('transport')}>
            <button
              type="button"
              role="radio"
              aria-checked={transport === 'stdio'}
              data-active={transport === 'stdio' ? 'true' : 'false'}
              className={css.segmentBtn}
              onClick={() => { setTransport('stdio') }}
            >
              {t('transportStdio')}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={transport === 'streamable-http'}
              data-active={transport === 'streamable-http' ? 'true' : 'false'}
              className={css.segmentBtn}
              onClick={() => { setTransport('streamable-http') }}
            >
              {t('transportHttp')}
            </button>
          </div>
        </div>

        {transport === 'stdio' ? (
          <>
            <div className={css.field}>
              <label htmlFor="mcp-command-input" className={css.label}>
                {t('command')}
              </label>
              <Input
                id="mcp-command-input"
                value={command}
                onChange={(e) => { setCommand(e.target.value) }}
                placeholder={t('command')}
                disabled={saving}
              />
              <p className={css.hint}>{t('commandHint')}</p>
            </div>

            <div className={css.field}>
              <label htmlFor="mcp-args-input" className={css.label}>
                {t('args')}
              </label>
              <textarea
                id="mcp-args-input"
                className={css.textarea}
                value={argsText}
                onChange={(e) => { setArgsText(e.target.value) }}
                placeholder={t('args')}
                disabled={saving}
              />
              <p className={css.hint}>{t('argsHint')}</p>
            </div>

            <div className={css.field}>
              <label htmlFor="mcp-cwd-input" className={css.label}>
                {t('cwd')}
              </label>
              <Input
                id="mcp-cwd-input"
                value={cwd}
                onChange={(e) => { setCwd(e.target.value) }}
                placeholder={t('cwd')}
                disabled={saving}
              />
              <p className={css.hint}>{t('cwdHint')}</p>
            </div>

            <div className={css.field}>
              <span className={css.label}>{t('env')}</span>
              <p className={css.hint}>{t('envHint')}</p>
              <div className={css.kvContainer}>
                {envRows.map(row => (
                  <div key={row.id} className={css.kvRow}>
                    <Input
                      className={css.kvInput ?? ''}
                      value={row.key}
                      onChange={(e) => { updateEnvRow(row.id, 'key', e.target.value) }}
                      placeholder={t('keyPlaceholder')}
                      disabled={saving}
                    />
                    <Input
                      className={css.kvInput ?? ''}
                      value={row.value}
                      onChange={(e) => { updateEnvRow(row.id, 'value', e.target.value) }}
                      placeholder={t('valuePlaceholder')}
                      disabled={saving}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconTrashOutlineRegular size={14} />}
                      aria-label={t('remove')}
                      onClick={() => { removeEnvRow(row.id) }}
                      disabled={saving}
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  icon={<IconPlusOutlineRegular size={14} />}
                  onClick={addEnvRow}
                  disabled={saving}
                >
                  {t('addEnv')}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={css.field}>
              <label htmlFor="mcp-url-input" className={css.label}>
                {t('url')}
              </label>
              <Input
                id="mcp-url-input"
                value={url}
                onChange={(e) => { setUrl(e.target.value) }}
                placeholder={t('url')}
                disabled={saving}
              />
              <p className={css.hint}>{t('urlHint')}</p>
            </div>

            <div className={css.field}>
              <span className={css.label}>{t('headers')}</span>
              <p className={css.hint}>{t('headersHint')}</p>
              <div className={css.kvContainer}>
                {headerRows.map(row => (
                  <div key={row.id} className={css.kvRow}>
                    <Input
                      className={css.kvInput ?? ''}
                      value={row.key}
                      onChange={(e) => { updateHeaderRow(row.id, 'key', e.target.value) }}
                      placeholder={t('keyPlaceholder')}
                      disabled={saving}
                    />
                    <Input
                      className={css.kvInput ?? ''}
                      value={row.value}
                      onChange={(e) => { updateHeaderRow(row.id, 'value', e.target.value) }}
                      placeholder={t('valuePlaceholder')}
                      disabled={saving}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconTrashOutlineRegular size={14} />}
                      aria-label={t('remove')}
                      onClick={() => { removeHeaderRow(row.id) }}
                      disabled={saving}
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  icon={<IconPlusOutlineRegular size={14} />}
                  onClick={addHeaderRow}
                  disabled={saving}
                >
                  {t('addHeader')}
                </Button>
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          className={css.advancedToggle}
          onClick={() => { setAdvancedOpen(v => !v) }}
        >
          <span>{t('advancedSettings')}</span>
          {advancedOpen ? (
            <IconChevronUpOutlineRegular size={14} />
          ) : (
            <IconChevronDownOutlineRegular size={14} />
          )}
        </button>

        {advancedOpen && (
          <div className={css.advancedPanel}>
            <div className={css.field}>
              <label htmlFor="mcp-startup-timeout-input" className={css.label}>
                {t('startupTimeout')}
              </label>
              <Input
                id="mcp-startup-timeout-input"
                type="number"
                value={startupTimeoutMs}
                onChange={(e) => { setStartupTimeoutMs(e.target.value) }}
                disabled={saving}
              />
            </div>
            <div className={css.field}>
              <label htmlFor="mcp-tool-timeout-input" className={css.label}>
                {t('toolCallTimeout')}
              </label>
              <Input
                id="mcp-tool-timeout-input"
                type="number"
                value={toolCallTimeoutMs}
                onChange={(e) => { setToolCallTimeoutMs(e.target.value) }}
                disabled={saving}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
