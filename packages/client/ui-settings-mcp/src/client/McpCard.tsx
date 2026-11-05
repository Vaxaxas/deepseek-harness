/**
 * The MCP server and tool management page on the Plugins panel and Settings tab:
 * configure, test (probe), restart, enable, disable, and monitor external
 * MCP servers and discovered tools.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-mcp/client
 */

import {
  Button,
  IconApiOutlineRegular,
  IconPlusOutlineRegular,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { McpCardFace } from './mcp-card-controller.ts'
import { McpServerCard } from './McpServerCard.tsx'
import { McpServerDialog } from './McpServerDialog.tsx'
import css from './McpCard.module.css'

/** Full component props assembled by the slot renderer. */
export type McpCardProps =
  & PropsLocale<'settings.mcp'>
  & InjectFace<McpCardFace>
  & {
    view?: 'summary' | 'page' | undefined
  }

/**
 * Render the MCP summary or the full fleet management page.
 */
export function McpCard(props: McpCardProps) {
  const { t } = props
  const state = props.useMcpCard(snapshot => snapshot)

  if (props.view === 'summary') {
    return t('description')
  }

  const deleteTarget = state.deleteTarget

  return (
    <div className={css.container}>
      <div className={css.header}>
        <div className={css.intro}>
          <h3 className={css.title}>{t('title')}</h3>
          <p className={css.description}>{t('description')}</p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<IconPlusOutlineRegular size={14} />}
          disabled={!state.writable || state.saving}
          onClick={props.openAddServer}
        >
          {t('addServer')}
        </Button>
      </div>

      {state.servers.length === 0 ? (
        <div className={css.emptyState}>
          <IconApiOutlineRegular size={36} className={css.emptyIcon} />
          <h4 className={css.emptyTitle}>{t('emptyTitle')}</h4>
          <p className={css.emptyDescription}>{t('emptyDescription')}</p>
          <Button
            variant="outline"
            size="sm"
            icon={<IconPlusOutlineRegular size={14} />}
            disabled={!state.writable || state.saving}
            onClick={props.openAddServer}
          >
            {t('addServer')}
          </Button>
        </div>
      ) : (
        <div className={css.serverList}>
          {state.servers.map(server => (
            <McpServerCard
              key={server.name}
              server={server}
              t={t}
              onToggleEnabled={props.toggleEnabled}
              onProbe={props.probeServer}
              onRestart={props.restartServer}
              onEdit={props.openEditServer}
              onDelete={props.openDeleteConfirm}
            />
          ))}
        </div>
      )}

      <McpServerDialog
        open={state.dialogOpen}
        draft={state.editingServer}
        saving={state.saving}
        error={state.dialogError}
        t={t}
        onClose={props.closeDialog}
        onSave={(draft) => { void props.saveServer(draft) }}
      />

      <Modal
        open={deleteTarget !== undefined}
        onClose={props.closeDeleteConfirm}
        title={t('deleteConfirmTitle')}
        closeLabel={t('closeLabel')}
        footer={(
          <div className={css.deleteConfirmFooter}>
            <Button variant="ghost" onClick={props.closeDeleteConfirm} disabled={state.saving}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => { void props.confirmDelete() }}
              disabled={state.saving}
            >
              {t('delete')}
            </Button>
          </div>
        )}
      >
        <p className={css.deleteConfirmBody}>
          {deleteTarget ? t('deleteConfirmMessage', { name: deleteTarget }) : ''}
        </p>
      </Modal>
    </div>
  )
}
