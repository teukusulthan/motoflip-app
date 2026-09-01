'use client'

import { archiveVendor, saveVendor } from '@/app/actions/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RecordManager } from '@/components/motoflip/record-manager'

export interface VendorRecord {
  id: string
  name: string
  category: string | null
  phone: string | null
  address: string | null
  notes: string | null
  archived: boolean
}

/** §20 — vendor data: name, category, phone, address, notes. */
export function VendorManager({ vendors }: { vendors: VendorRecord[] }) {
  const byId = new Map(vendors.map((v) => [v.id, v]))

  return (
    <RecordManager
      idField="vendorId"
      addLabel="Tambah Vendor"
      emptyText="Belum ada vendor. Tambahkan bengkel atau biro jasa yang Anda pakai agar pengeluaran bisa dianalisis per vendor."
      saveAction={saveVendor}
      archiveAction={archiveVendor}
      records={vendors.map((v) => ({
        id: v.id,
        title: v.name,
        subtitle: [v.category, v.phone].filter(Boolean).join(' · ') || null,
        archived: v.archived,
      }))}
      renderFields={(record) => {
        const vendor = record ? byId.get(record.id) : null
        return (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-name">Nama</Label>
              <Input
                id="vendor-name"
                name="name"
                required
                defaultValue={vendor?.name ?? ''}
                placeholder="Bengkel Jaya Motor"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-category">Kategori</Label>
              <Input
                id="vendor-category"
                name="category"
                defaultValue={vendor?.category ?? ''}
                placeholder="Bengkel Umum, CVT, Dokumen…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-phone">Telepon</Label>
              <Input
                id="vendor-phone"
                name="phone"
                inputMode="tel"
                defaultValue={vendor?.phone ?? ''}
                placeholder="0812-1111-2222"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-address">Alamat</Label>
              <Input
                id="vendor-address"
                name="address"
                defaultValue={vendor?.address ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-notes">Catatan</Label>
              <Input
                id="vendor-notes"
                name="notes"
                defaultValue={vendor?.notes ?? ''}
                placeholder="Spesialis CVT, buka sampai malam…"
              />
            </div>
          </>
        )
      }}
    />
  )
}
