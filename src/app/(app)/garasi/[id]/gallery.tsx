'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { Camera, Star, Trash2, X } from 'lucide-react'
import { PhotoCategory } from '@prisma/client'
import {
  deletePhoto,
  setHeroPhoto,
  uploadPhotos,
} from '@/app/actions/media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { ActionState } from '@/lib/validation'
import { cn } from '@/lib/utils'

const initialState: ActionState = {}

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  PURCHASE_CONDITION: 'Kondisi Pembelian',
  DAMAGE: 'Kerusakan',
  REPAIR_PROGRESS: 'Progres Perbaikan',
  BEFORE: 'Sebelum',
  AFTER: 'Sesudah',
  LISTING: 'Iklan',
  SOLD: 'Terjual',
  DOCUMENT: 'Dokumen',
  RECEIPT: 'Kuitansi',
  OTHER: 'Lainnya',
}

export interface GalleryPhoto {
  id: string
  url: string
  caption: string | null
  category: PhotoCategory
  isHero: boolean
}

export function Gallery({
  motorcycleId,
  photos,
  title,
}: {
  motorcycleId: string
  photos: GalleryPhoto[]
  title: string
}) {
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null)

  return (
    <div className="space-y-4">
      <UploadPanel motorcycleId={motorcycleId} />

      {photos.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
          <Camera className="mb-3 size-6 text-fg-subtle" aria-hidden />
          <h3 className="text-base font-semibold text-fg">
            Galeri masih kosong.
          </h3>
          <p className="mt-1.5 max-w-[38ch] text-sm leading-relaxed text-fg-muted">
            Foto kondisi pembelian, progres perbaikan, dan hasil akhir tersimpan
            permanen di sini — termasuk setelah motor terjual.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => setViewerIndex(index)}
                className="relative block aspect-square w-full overflow-hidden rounded-md border border-border bg-elevated"
                aria-label={`Lihat foto ${index + 1} dari ${photos.length}`}
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? `${title} — foto ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover"
                />
                {photo.isHero && (
                  <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-accent-fg">
                    <Star className="size-3 fill-current" aria-hidden />
                    <span className="sr-only">Foto utama</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewerIndex !== null && photos[viewerIndex] && (
        <PhotoViewer
          motorcycleId={motorcycleId}
          photos={photos}
          index={viewerIndex}
          title={title}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      )}
    </div>
  )
}

function UploadPanel({ motorcycleId }: { motorcycleId: string }) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useFormState(uploadPhotos, initialState)
  const [fileCount, setFileCount] = React.useState(0)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (!submitted.current || state.error) return
    submitted.current = false
    setOpen(false)
    setFileCount(0)
    toast.success('Foto tersimpan.')
    router.refresh()
  }, [state, router])

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="full">
          <Camera className="size-4" aria-hidden />
          Tambah Foto
        </Button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto w-full max-w-app px-4 pb-8 pt-3">
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="text-base font-semibold text-fg">
              Tambah Foto
            </Drawer.Title>
            <Drawer.Description className="mb-4 text-sm text-fg-muted">
              JPG, PNG, WEBP atau HEIC. Maksimal 10 MB per foto.
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
                <Label htmlFor="photo-files">Berkas</Label>
                <input
                  id="photo-files"
                  name="files"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  required
                  onChange={(e) => setFileCount(e.target.files?.length ?? 0)}
                  className="block w-full rounded-md border border-border bg-input px-3 py-3 text-sm text-fg file:mr-3 file:rounded file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-fg"
                />
                {fileCount > 0 && (
                  <p className="text-xs text-fg-muted">{fileCount} foto dipilih</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="photo-category">Kategori</Label>
                <Select
                  id="photo-category"
                  name="category"
                  defaultValue="PURCHASE_CONDITION"
                >
                  {Object.entries(PHOTO_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="photo-caption">Keterangan</Label>
                <Input
                  id="photo-caption"
                  name="caption"
                  placeholder="Baret di fairing kanan…"
                />
              </div>

              <UploadButton />
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function UploadButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? 'Mengunggah…' : 'Unggah Foto'}
    </Button>
  )
}

function PhotoViewer({
  motorcycleId,
  photos,
  index,
  title,
  onClose,
  onNavigate,
}: {
  motorcycleId: string
  photos: GalleryPhoto[]
  index: number
  title: string
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  const photo = photos[index]
  const router = useRouter()
  const [heroState, heroAction] = useFormState(setHeroPhoto, initialState)
  const [deleteState, deleteAction] = useFormState(deletePhoto, initialState)

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && index < photos.length - 1) {
        onNavigate(index + 1)
      }
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onNavigate])

  React.useEffect(() => {
    if (heroState.error) toast.error(heroState.error)
    else if (heroState !== initialState) {
      toast.success('Foto utama diperbarui.')
      router.refresh()
      onClose()
    }
  }, [heroState, router, onClose])

  React.useEffect(() => {
    if (deleteState.error) toast.error(deleteState.error)
    else if (deleteState !== initialState) {
      toast.success('Foto dihapus.')
      router.refresh()
      onClose()
    }
  }, [deleteState, router, onClose])

  if (!photo) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${index + 1} dari ${photos.length}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="tabular text-sm text-white/70">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="flex size-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="relative flex-1">
        <Image
          src={photo.url}
          alt={photo.caption ?? title}
          fill
          sizes="100vw"
          className="object-contain"
        />
      </div>

      <div className="space-y-3 px-4 pb-8 pt-4">
        {photo.caption && (
          <p className="text-center text-sm text-white/80">{photo.caption}</p>
        )}
        <p className="text-center text-xs uppercase tracking-wider text-white/50">
          {PHOTO_CATEGORY_LABELS[photo.category]}
        </p>

        <div className="flex gap-2">
          <form action={heroAction} className="flex-1">
            <input type="hidden" name="photoId" value={photo.id} />
            <input type="hidden" name="motorcycleId" value={motorcycleId} />
            <Button
              type="submit"
              variant="secondary"
              size="full"
              disabled={photo.isHero}
            >
              <Star className={cn('size-4', photo.isHero && 'fill-current')} aria-hidden />
              {photo.isHero ? 'Foto Utama' : 'Jadikan Utama'}
            </Button>
          </form>

          <form action={deleteAction}>
            <input type="hidden" name="photoId" value={photo.id} />
            <input type="hidden" name="motorcycleId" value={motorcycleId} />
            <Button type="submit" variant="danger" size="icon" aria-label="Hapus foto">
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
