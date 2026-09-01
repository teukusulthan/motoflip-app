'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ActionState } from '@/lib/validation'
import { cn } from '@/lib/utils'

const initialState: ActionState = {}

export interface ManagedRecord {
  id: string
  title: string
  subtitle: string | null
  archived: boolean
  /** Disables archiving, with the reason shown to the user. */
  lockedReason?: string
}

/**
 * Shared list-with-drawer editor for the master data screens.
 *
 * Vendors, cash accounts and categories all need the same shape: a list, an
 * add/edit drawer, and archive-not-delete (§38). Building it once keeps the
 * three screens consistent and small.
 */
export function RecordManager({
  records,
  saveAction,
  archiveAction,
  idField,
  addLabel,
  emptyText,
  renderFields,
}: {
  records: ManagedRecord[]
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>
  archiveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>
  /** Hidden field name carrying the record id when editing. */
  idField: string
  addLabel: string
  emptyText: string
  renderFields: (record: ManagedRecord | null) => React.ReactNode
}) {
  const [editing, setEditing] = React.useState<ManagedRecord | null>(null)
  const [open, setOpen] = React.useState(false)

  const openFor = (record: ManagedRecord | null) => {
    setEditing(record)
    setOpen(true)
  }

  const active = records.filter((r) => !r.archived)
  const archived = records.filter((r) => r.archived)

  return (
    <div className="space-y-4">
      <Button size="full" onClick={() => openFor(null)}>
        <Plus className="size-4" aria-hidden />
        {addLabel}
      </Button>

      {records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/50 px-6 py-10 text-center">
          <p className="text-sm text-fg-muted">{emptyText}</p>
        </div>
      ) : (
        <>
          <Card>
            <ul className="divide-y divide-border">
              {active.map((record) => (
                <Row
                  key={record.id}
                  record={record}
                  idField={idField}
                  archiveAction={archiveAction}
                  onEdit={() => openFor(record)}
                />
              ))}
            </ul>
          </Card>

          {archived.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-fg-subtle">
                Diarsipkan
              </p>
              <Card>
                <ul className="divide-y divide-border">
                  {archived.map((record) => (
                    <Row
                      key={record.id}
                      record={record}
                      idField={idField}
                      archiveAction={archiveAction}
                      onEdit={() => openFor(record)}
                    />
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}

      <EditorDrawer
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        idField={idField}
        saveAction={saveAction}
        renderFields={renderFields}
      />
    </div>
  )
}

function Row({
  record,
  idField,
  archiveAction,
  onEdit,
}: {
  record: ManagedRecord
  idField: string
  archiveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>
  onEdit: () => void
}) {
  const [state, formAction] = useFormState(archiveAction, initialState)
  const router = useRouter()

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
    else if (state !== initialState) router.refresh()
  }, [state, router])

  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={cn(
            'truncate text-sm font-medium',
            record.archived ? 'text-fg-subtle' : 'text-fg',
          )}
        >
          {record.title}
        </p>
        {record.subtitle && (
          <p className="truncate text-xs text-fg-subtle">{record.subtitle}</p>
        )}
      </button>

      {record.lockedReason && <Badge tone="neutral">Sistem</Badge>}

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Ubah ${record.title}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-elevated hover:text-fg"
      >
        <Pencil className="size-4" aria-hidden />
      </button>

      {record.lockedReason ? (
        <span className="w-11 shrink-0" />
      ) : (
        <form action={formAction}>
          <input type="hidden" name={idField} value={record.id} />
          <ArchiveButton archived={record.archived} title={record.title} />
        </form>
      )}
    </li>
  )
}

function ArchiveButton({
  archived,
  title,
}: {
  archived: boolean
  title: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={archived ? `Aktifkan ${title}` : `Arsipkan ${title}`}
      className="flex size-11 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-elevated hover:text-fg disabled:opacity-50"
    >
      {archived ? (
        <ArchiveRestore className="size-4" aria-hidden />
      ) : (
        <Archive className="size-4" aria-hidden />
      )}
    </button>
  )
}

function EditorDrawer({
  open,
  onOpenChange,
  editing,
  idField,
  saveAction,
  renderFields,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: ManagedRecord | null
  idField: string
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>
  renderFields: (record: ManagedRecord | null) => React.ReactNode
}) {
  const [state, formAction] = useFormState(saveAction, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  React.useEffect(() => {
    if (!submitted.current || state.error || state.fieldErrors) return
    submitted.current = false
    onOpenChange(false)
    toast.success('Tersimpan.')
    router.refresh()
  }, [state, router, onOpenChange])

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-20 rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto max-h-[80vh] w-full max-w-app overflow-y-auto px-4 pb-8 pt-3">
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="mb-4 text-base font-semibold text-fg">
              {editing ? `Ubah ${editing.title}` : 'Tambah Baru'}
            </Drawer.Title>

            <form
              // Remount on target change so defaultValue reflects the record.
              key={editing?.id ?? 'new'}
              action={formAction}
              onSubmit={() => {
                submitted.current = true
              }}
              className="space-y-4"
            >
              {editing && (
                <input type="hidden" name={idField} value={editing.id} />
              )}
              {renderFields(editing)}
              <SaveButton />
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan'}
    </Button>
  )
}
