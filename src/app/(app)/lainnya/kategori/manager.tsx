'use client'

import { archiveCategory, saveCategory } from '@/app/actions/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { RecordManager } from '@/components/motoflip/record-manager'

export const GROUP_LABELS: Record<string, string> = {
  ACQUISITION: 'Akuisisi',
  REPAIR: 'Perbaikan',
  MAINTENANCE: 'Perawatan',
  DOCUMENTATION: 'Dokumen',
  LOGISTICS: 'Logistik',
  SELLING: 'Penjualan',
  OTHER: 'Lainnya',
  SALE: 'Penjualan Motor',
  OTHER_INCOME: 'Pendapatan Lain',
}

const EXPENSE_GROUPS = [
  'ACQUISITION', 'REPAIR', 'MAINTENANCE',
  'DOCUMENTATION', 'LOGISTICS', 'SELLING', 'OTHER',
]
const INCOME_GROUPS = ['SALE', 'OTHER_INCOME']

export interface CategoryRecord {
  id: string
  name: string
  kind: string
  group: string
  role: string
  isSystem: boolean
  archived: boolean
}

/**
 * §10 — categories are configurable.
 *
 * System categories can be renamed but not re-grouped or archived: the
 * PURCHASE and SALE roles carry structural meaning that the whole financial
 * engine derives from.
 */
export function CategoryManager({
  categories,
}: {
  categories: CategoryRecord[]
}) {
  const byId = new Map(categories.map((c) => [c.id, c]))

  return (
    <RecordManager
      idField="categoryId"
      addLabel="Tambah Kategori"
      emptyText="Belum ada kategori."
      saveAction={saveCategory}
      archiveAction={archiveCategory}
      records={categories.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.kind === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} · ${GROUP_LABELS[c.group] ?? c.group}`,
        archived: c.archived,
        lockedReason: c.isSystem ? 'Kategori sistem' : undefined,
      }))}
      renderFields={(record) => {
        const category = record ? byId.get(record.id) : null
        const locked = category?.isSystem ?? false

        return (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Nama</Label>
              <Input
                id="category-name"
                name="name"
                required
                defaultValue={category?.name ?? ''}
                placeholder="Ban Dalam"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-kind">Jenis</Label>
              <Select
                id="category-kind"
                name="kind"
                defaultValue={category?.kind ?? 'EXPENSE'}
                disabled={locked}
              >
                <option value="EXPENSE">Pengeluaran</option>
                <option value="INCOME">Pemasukan</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-group">Kelompok</Label>
              <Select
                id="category-group"
                name="group"
                defaultValue={category?.group ?? 'REPAIR'}
                disabled={locked}
              >
                <optgroup label="Pengeluaran">
                  {EXPENSE_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {GROUP_LABELS[group]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Pemasukan">
                  {INCOME_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {GROUP_LABELS[group]}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>

            {locked && (
              <>
                {/* Disabled selects submit nothing; preserve the stored values. */}
                <input type="hidden" name="kind" value={category?.kind ?? 'EXPENSE'} />
                <input type="hidden" name="group" value={category?.group ?? 'OTHER'} />
                <p className="text-xs leading-relaxed text-fg-subtle">
                  Kategori sistem hanya dapat diganti namanya. Jenis dan
                  kelompoknya dipakai oleh alur pembelian dan penjualan.
                </p>
              </>
            )}
          </>
        )
      }}
    />
  )
}
