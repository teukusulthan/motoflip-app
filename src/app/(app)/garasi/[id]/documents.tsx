'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { FileText, Trash2, Upload } from 'lucide-react'
import { DocumentType } from '@prisma/client'
import { deleteDocument, uploadDocument } from '@/app/actions/media'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  STNK: 'STNK',
  BPKB: 'BPKB',
  PURCHASE_AGREEMENT: 'Surat Perjanjian Beli',
  SALE_AGREEMENT: 'Surat Perjanjian Jual',
  TAX: 'Dokumen Pajak',
  RECEIPT: 'Kuitansi',
  OTHER: 'Lainnya',
}

export interface DocumentItem {
  id: string
  type: DocumentType
  url: string
  fileName: string
  sizeBytes: number
  expiresAt: string | null
  notes: string | null
}

const formatBytes = (bytes: number) =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

export function Documents({
  motorcycleId,
  documents,
}: {
  motorcycleId: string
  documents: DocumentItem[]
}) {
  return (
    <div className="space-y-4">
      <UploadPanel motorcycleId={motorcycleId} />

      {documents.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
          <FileText className="mb-3 size-6 text-fg-subtle" aria-hidden />
          <h3 className="text-base font-semibold text-fg">Belum ada dokumen.</h3>
          <p className="mt-1.5 max-w-[38ch] text-sm leading-relaxed text-fg-muted">
            Simpan STNK, BPKB, kuitansi, dan surat jual-beli agar tetap melekat
            pada motor ini selamanya.
          </p>
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function DocumentRow({ doc }: { doc: DocumentItem }) {
  const [state, formAction] = useFormState(deleteDocument, initialState)
  const router = useRouter()

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
    else if (state !== initialState) {
      toast.success('Dokumen dihapus.')
      router.refresh()
    }
  }, [state, router])

  const expiry = doc.expiresAt ? new Date(doc.expiresAt) : null
  const expired = expiry !== null && expiry.getTime() < Date.now()

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <FileText className="size-4 shrink-0 text-fg-subtle" aria-hidden />

      <a
        href={`/api/dokumen/${doc.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1"
      >
        <p className="truncate text-sm font-medium text-fg">
          {DOCUMENT_TYPE_LABELS[doc.type]}
        </p>
        <p className="truncate text-xs text-fg-subtle">
          {doc.fileName} · {formatBytes(doc.sizeBytes)}
        </p>
      </a>

      {expiry && (
        <Badge tone={expired ? 'danger' : 'warning'}>
          {expired ? 'Kedaluwarsa' : formatDate(expiry)}
        </Badge>
      )}

      <form action={formAction}>
        <input type="hidden" name="documentId" value={doc.id} />
        <DeleteButton />
      </form>
    </li>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Hapus dokumen"
      className="flex size-11 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-danger-muted hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  )
}

function UploadPanel({ motorcycleId }: { motorcycleId: string }) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useFormState(uploadDocument, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  React.useEffect(() => {
    if (!submitted.current || state.error) return
    submitted.current = false
    setOpen(false)
    toast.success('Dokumen tersimpan.')
    router.refresh()
  }, [state, router])

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="full">
          <Upload className="size-4" aria-hidden />
          Tambah Dokumen
        </Button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto w-full max-w-app px-4 pb-8 pt-3">
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="text-base font-semibold text-fg">
              Tambah Dokumen
            </Drawer.Title>
            <Drawer.Description className="mb-4 text-sm text-fg-muted">
              PDF atau foto. Maksimal 20 MB.
            </Drawer.Description>

            <form
              action={formAction}
              onSubmit={() => {
                submitted.current = true
              }}
              className="space-y-4"
            >
              <input type="hidden" name="motorcycleId" value={motorcycleId} />

              <div className="space-y-1.5">
                <Label htmlFor="doc-file">Berkas</Label>
                <input
                  id="doc-file"
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  required
                  className="block w-full rounded-md border border-border bg-input px-3 py-3 text-sm text-fg file:mr-3 file:rounded file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-fg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-type">Jenis Dokumen</Label>
                <Select id="doc-type" name="type" defaultValue="STNK">
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-expires">Tanggal Kedaluwarsa</Label>
                <Input id="doc-expires" name="expiresAt" type="date" />
                <p className="text-xs text-fg-subtle">
                  Opsional. Digunakan untuk pengingat di beranda.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="doc-notes">Catatan</Label>
                <Input id="doc-notes" name="notes" placeholder="Atas nama…" />
              </div>

              <SubmitButton />
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? 'Mengunggah…' : 'Unggah Dokumen'}
    </Button>
  )
}
