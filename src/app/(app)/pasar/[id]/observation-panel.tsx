'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { ClipboardList, Trash2 } from 'lucide-react'
import { addObservation, deleteObservation } from '@/app/actions/market'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MoneyInput } from '@/components/motorflip/money-input'
import { SOURCE_LABELS } from '@/domain/inventory'
import { formatDate, formatRupiah } from '@/lib/format'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}
const today = new Date().toISOString().slice(0, 10)

export interface ObservationRow {
  id: string
  observedAt: string
  askingPrice: string
  source: string
  mileage: number | null
  listingAgeDays: number | null
  url: string | null
  note: string | null
}

export function ObservationPanel({
  marketModelId,
  observations,
}: {
  marketModelId: string
  observations: ObservationRow[]
}) {
  return (
    <div className="space-y-4">
      <AddPanel marketModelId={marketModelId} />

      {observations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/50 px-6 py-10 text-center">
          <ClipboardList className="mx-auto mb-3 size-6 text-fg-subtle" aria-hidden />
          <h3 className="text-base font-semibold text-fg">
            Belum ada observasi pasar.
          </h3>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-sm leading-relaxed text-fg-muted">
            Setiap listing yang Anda catat menggantikan data ilustrasi dengan
            data nyata, dan menaikkan keyakinan skor model ini.
          </p>
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {observations.map((observation) => (
              <ObservationRowItem key={observation.id} observation={observation} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function ObservationRowItem({ observation }: { observation: ObservationRow }) {
  const [state, formAction] = useFormState(deleteObservation, initialState)
  const router = useRouter()

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
    else if (state !== initialState) {
      toast.success('Observasi dihapus.')
      router.refresh()
    }
  }, [state, router])

  const detail = [
    SOURCE_LABELS[observation.source as keyof typeof SOURCE_LABELS] ??
      observation.source,
    observation.mileage !== null
      ? `${observation.mileage.toLocaleString('id-ID')} km`
      : null,
    observation.listingAgeDays !== null
      ? `tayang ${observation.listingAgeDays} hari`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="tabular text-metric-sm text-fg">
          {formatRupiah(BigInt(observation.askingPrice))}
        </p>
        <p className="truncate text-xs text-fg-subtle">
          {formatDate(new Date(observation.observedAt))} · {detail}
        </p>
        {observation.note && (
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {observation.note}
          </p>
        )}
      </div>

      {observation.url && (
        <a
          href={observation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-accent"
        >
          Buka
        </a>
      )}

      <form action={formAction}>
        <input type="hidden" name="observationId" value={observation.id} />
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
      aria-label="Hapus observasi"
      className="flex size-11 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-danger-muted hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  )
}

function AddPanel({ marketModelId }: { marketModelId: string }) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useFormState(addObservation, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  React.useEffect(() => {
    if (!submitted.current || state.error) return
    submitted.current = false
    setOpen(false)
    toast.success('Observasi tersimpan.')
    router.refresh()
  }, [state, router])

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="full">
          <ClipboardList className="size-4" aria-hidden />
          Catat Listing yang Anda Lihat
        </Button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-20 rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto max-h-[80vh] w-full max-w-app overflow-y-auto px-4 pb-8 pt-3">
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="text-base font-semibold text-fg">
              Catat Observasi Pasar
            </Drawer.Title>
            <Drawer.Description className="mb-4 text-sm leading-relaxed text-fg-muted">
              Harga yang Anda lihat di marketplace hari ini. Ini adalah data
              pasar nyata — semakin banyak dicatat, semakin tinggi keyakinan
              skornya.
            </Drawer.Description>

            <form
              action={formAction}
              onSubmit={() => {
                submitted.current = true
              }}
              className="space-y-4"
            >
              <input type="hidden" name="marketModelId" value={marketModelId} />

              <div className="space-y-1.5">
                <Label htmlFor="obs-price">Harga Diminta</Label>
                <MoneyInput
                  id="obs-price"
                  name="askingPrice"
                  required
                  quickAdd={false}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="obs-date">Tanggal Dilihat</Label>
                  <Input
                    id="obs-date"
                    name="observedAt"
                    type="date"
                    defaultValue={today}
                    max={today}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="obs-source">Sumber</Label>
                  <Select id="obs-source" name="source" defaultValue="OLX">
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="obs-mileage">Kilometer</Label>
                  <Input
                    id="obs-mileage"
                    name="mileage"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="18400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="obs-age">Lama Tayang (hari)</Label>
                  <Input
                    id="obs-age"
                    name="listingAgeDays"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="14"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs-url">Tautan</Label>
                <Input
                  id="obs-url"
                  name="url"
                  type="url"
                  inputMode="url"
                  placeholder="https://www.olx.co.id/item/…"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs-note">Catatan</Label>
                <Input id="obs-note" name="note" placeholder="Pajak hidup, surat lengkap…" />
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
      {pending ? 'Menyimpan…' : 'Simpan Observasi'}
    </Button>
  )
}
