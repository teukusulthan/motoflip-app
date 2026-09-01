'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, Info } from 'lucide-react'
import { updateMotorcycle } from '@/app/actions/motorcycles'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MoneyInput } from '@/components/motoflip/money-input'
import { SectionHeader } from '@/components/motoflip/page-header'
import { SOURCE_LABELS } from '@/domain/inventory'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}

export interface EditableMotorcycle {
  id: string
  brand: string
  model: string
  variant: string | null
  year: number
  color: string | null
  mileage: number | null
  plateNumber: string | null
  engineNumber: string | null
  frameNumber: string | null
  location: string | null
  sellerName: string | null
  sellerContact: string | null
  notes: string | null
  acquisitionSource: string
  projectedRepairCost: string
  targetSellingPrice: string
}

export function EditMotorcycleForm({
  motorcycle,
}: {
  motorcycle: EditableMotorcycle
}) {
  const [state, formAction] = useFormState(updateMotorcycle, initialState)
  const err = (field: string) => state.fieldErrors?.[field]

  return (
    <form action={formAction} className="space-y-5 pb-24">
      <input type="hidden" name="motorcycleId" value={motorcycle.id} />

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-muted px-3 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      {/* §38 — money is never edited in place. */}
      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
          <p className="text-xs leading-relaxed text-fg-muted">
            Harga beli dan penjualan tidak diubah di sini. Keduanya tersimpan
            sebagai transaksi — untuk mengoreksinya, batalkan transaksi lama di
            halaman Transaksi lalu catat yang baru.
          </p>
        </CardContent>
      </Card>

      <section>
        <SectionHeader title="Identitas Motor" />
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Merek" htmlFor="brand" error={err('brand')}>
                <Input id="brand" name="brand" required defaultValue={motorcycle.brand} />
              </Field>
              <Field label="Model" htmlFor="model" error={err('model')}>
                <Input id="model" name="model" required defaultValue={motorcycle.model} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tahun" htmlFor="year" error={err('year')}>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  inputMode="numeric"
                  required
                  defaultValue={motorcycle.year}
                />
              </Field>
              <Field label="Varian" htmlFor="variant">
                <Input id="variant" name="variant" defaultValue={motorcycle.variant ?? ''} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Warna" htmlFor="color">
                <Input id="color" name="color" defaultValue={motorcycle.color ?? ''} />
              </Field>
              <Field label="Kilometer" htmlFor="mileage">
                <Input
                  id="mileage"
                  name="mileage"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={motorcycle.mileage ?? ''}
                />
              </Field>
            </div>
            <Field label="Nomor Polisi" htmlFor="plateNumber">
              <Input
                id="plateNumber"
                name="plateNumber"
                autoCapitalize="characters"
                defaultValue={motorcycle.plateNumber ?? ''}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="No. Mesin" htmlFor="engineNumber">
                <Input id="engineNumber" name="engineNumber" defaultValue={motorcycle.engineNumber ?? ''} />
              </Field>
              <Field label="No. Rangka" htmlFor="frameNumber">
                <Input id="frameNumber" name="frameNumber" defaultValue={motorcycle.frameNumber ?? ''} />
              </Field>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Proyeksi & Sumber" />
        <Card>
          <CardContent className="space-y-4">
            <Field label="Sumber Akuisisi" htmlFor="acquisitionSource">
              <Select
                id="acquisitionSource"
                name="acquisitionSource"
                defaultValue={motorcycle.acquisitionSource}
              >
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estimasi Biaya Perbaikan" htmlFor="projectedRepairCost">
              <MoneyInput
                id="projectedRepairCost"
                name="projectedRepairCost"
                defaultValue={motorcycle.projectedRepairCost}
              />
            </Field>
            <Field label="Target Harga Jual" htmlFor="targetSellingPrice">
              <MoneyInput
                id="targetSellingPrice"
                name="targetSellingPrice"
                defaultValue={motorcycle.targetSellingPrice}
                quickAdd={false}
              />
            </Field>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Detail Tambahan" />
        <Card>
          <CardContent className="space-y-4">
            <Field label="Lokasi" htmlFor="location">
              <Input id="location" name="location" defaultValue={motorcycle.location ?? ''} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Penjual" htmlFor="sellerName">
                <Input id="sellerName" name="sellerName" defaultValue={motorcycle.sellerName ?? ''} />
              </Field>
              <Field label="Kontak Penjual" htmlFor="sellerContact">
                <Input
                  id="sellerContact"
                  name="sellerContact"
                  inputMode="tel"
                  defaultValue={motorcycle.sellerContact ?? ''}
                />
              </Field>
            </div>
            <Field label="Catatan" htmlFor="notes">
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={motorcycle.notes ?? ''}
                className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-base text-fg placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              />
            </Field>
          </CardContent>
        </Card>
      </section>

      <StickyActions />
    </form>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function StickyActions() {
  const { pending } = useFormStatus()
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:sticky lg:bottom-4 lg:rounded-lg lg:border">
      <div
        className="mx-auto max-w-app lg:max-w-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        <Button type="submit" size="full" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Perubahan'}
        </Button>
      </div>
    </div>
  )
}
