'use client'

import * as React from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { createMotorcycle } from '@/app/actions/motorcycles'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MoneyInput } from '@/components/motorflip/money-input'
import { SectionHeader } from '@/components/motorflip/page-header'
import { STATUS_LABELS, STATUS_ORDER } from '@/components/motorflip/status-badge'
import { SOURCE_LABELS } from '@/domain/inventory'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}
const today = new Date().toISOString().slice(0, 10)

/**
 * Workflow 1 (§34): under 60 seconds.
 *
 * Only six fields are required. Everything else — engine/frame numbers, seller
 * details, notes — sits behind a disclosure so the fast path stays short.
 */
export function NewMotorcycleForm() {
  const [state, formAction] = useFormState(createMotorcycle, initialState)
  const [showDetails, setShowDetails] = React.useState(false)

  const err = (field: string) => state.fieldErrors?.[field]

  return (
    <form action={formAction} className="space-y-5 pb-24">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-muted px-3 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <section>
        <SectionHeader title="Identitas Motor" />
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Merek" htmlFor="brand" error={err('brand')}>
                <Input
                  id="brand"
                  name="brand"
                  required
                  placeholder="Yamaha"
                  autoCapitalize="words"
                  aria-invalid={Boolean(err('brand'))}
                />
              </Field>
              <Field label="Model" htmlFor="model" error={err('model')}>
                <Input
                  id="model"
                  name="model"
                  required
                  placeholder="NMAX"
                  autoCapitalize="words"
                  aria-invalid={Boolean(err('model'))}
                />
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
                  min={1970}
                  max={new Date().getFullYear() + 1}
                  placeholder="2022"
                  aria-invalid={Boolean(err('year'))}
                />
              </Field>
              <Field label="Varian" htmlFor="variant">
                <Input id="variant" name="variant" placeholder="Connected ABS" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Warna" htmlFor="color">
                <Input id="color" name="color" placeholder="Hitam" />
              </Field>
              <Field label="Kilometer" htmlFor="mileage">
                <Input
                  id="mileage"
                  name="mileage"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="18400"
                />
              </Field>
            </div>

            <Field label="Nomor Polisi" htmlFor="plateNumber">
              <Input
                id="plateNumber"
                name="plateNumber"
                placeholder="BL 2891 XY"
                autoCapitalize="characters"
              />
            </Field>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Pembelian" />
        <Card>
          <CardContent className="space-y-4">
            <Field
              label="Harga Beli"
              htmlFor="purchasePrice"
              hint="Kosongkan jika motor masih berstatus prospek."
            >
              <MoneyInput
                id="purchasePrice"
                name="purchasePrice"
                quickAdd={false}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Tanggal Beli"
                htmlFor="purchaseDate"
                error={err('purchaseDate')}
              >
                <Input
                  id="purchaseDate"
                  name="purchaseDate"
                  type="date"
                  defaultValue={today}
                  aria-invalid={Boolean(err('purchaseDate'))}
                />
              </Field>
              <Field label="Status" htmlFor="status">
                <Select id="status" name="status" defaultValue="OWNED">
                  {STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Sumber Akuisisi" htmlFor="acquisitionSource">
              <Select
                id="acquisitionSource"
                name="acquisitionSource"
                defaultValue="OLX"
              >
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Proyeksi" />
        <Card>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-fg-muted">
              Estimasi awal Anda. MotorFlip akan membandingkannya dengan realisasi
              agar Anda tahu seberapa akurat perkiraan Anda.
            </p>
            <Field label="Estimasi Biaya Perbaikan" htmlFor="projectedRepairCost">
              <MoneyInput id="projectedRepairCost" name="projectedRepairCost" />
            </Field>
            <Field label="Target Harga Jual" htmlFor="targetSellingPrice">
              <MoneyInput
                id="targetSellingPrice"
                name="targetSellingPrice"
                quickAdd={false}
              />
            </Field>
          </CardContent>
        </Card>
      </section>

      {/* Progressive disclosure — §32 */}
      <section>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="flex min-h-tap w-full items-center justify-between rounded-md border border-border bg-surface px-4 text-sm font-semibold text-fg-muted"
        >
          Detail Tambahan
          <ChevronDown
            className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {showDetails && (
          <Card className="mt-3">
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="No. Mesin" htmlFor="engineNumber">
                  <Input id="engineNumber" name="engineNumber" />
                </Field>
                <Field label="No. Rangka" htmlFor="frameNumber">
                  <Input id="frameNumber" name="frameNumber" />
                </Field>
              </div>
              <Field label="Lokasi" htmlFor="location">
                <Input id="location" name="location" placeholder="Banda Aceh" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nama Penjual" htmlFor="sellerName">
                  <Input id="sellerName" name="sellerName" />
                </Field>
                <Field label="Kontak Penjual" htmlFor="sellerContact">
                  <Input id="sellerContact" name="sellerContact" inputMode="tel" />
                </Field>
              </div>
              <Field label="Catatan" htmlFor="notes">
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-base text-fg placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  placeholder="Kondisi, riwayat servis, catatan negosiasi…"
                />
              </Field>
            </CardContent>
          </Card>
        )}
      </section>

      <StickyActions />
    </form>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-fg-subtle">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** §32 — the primary action stays reachable without scrolling to the end. */
function StickyActions() {
  const { pending } = useFormStatus()
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:sticky lg:bottom-4 lg:rounded-lg lg:border">
      <div
        className="mx-auto max-w-app lg:max-w-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        <Button type="submit" size="full" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Motor'}
        </Button>
      </div>
    </div>
  )
}
