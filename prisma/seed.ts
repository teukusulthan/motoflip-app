/**
 * Seed — creates the operator account, the §10 category tree, cash accounts,
 * and a set of demo motorcycles so every screen has realistic content to
 * render on a fresh install.
 *
 * Re-runnable: it upserts by natural key and skips demo data if any motorcycle
 * already exists, so it will not duplicate your real records.
 */
import { PrismaClient, type CategoryGroup, type CategoryKind, type CategoryRole } from '@prisma/client'
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'

const prisma = new PrismaClient()
const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

interface CategorySeed {
  slug: string
  name: string
  kind: CategoryKind
  group: CategoryGroup
  role?: CategoryRole
}

const CATEGORIES: CategorySeed[] = [
  // Acquisition
  { slug: 'pembelian-motor', name: 'Pembelian Motor', kind: 'EXPENSE', group: 'ACQUISITION', role: 'PURCHASE' },
  { slug: 'biaya-pembelian', name: 'Biaya Pembelian', kind: 'EXPENSE', group: 'ACQUISITION' },
  { slug: 'transport-pembelian', name: 'Transport Pembelian', kind: 'EXPENSE', group: 'ACQUISITION' },

  // Repair
  { slug: 'mesin', name: 'Mesin', kind: 'EXPENSE', group: 'REPAIR' },
  { slug: 'cvt', name: 'CVT', kind: 'EXPENSE', group: 'REPAIR' },
  { slug: 'rem', name: 'Rem', kind: 'EXPENSE', group: 'REPAIR' },
  { slug: 'suspensi', name: 'Suspensi', kind: 'EXPENSE', group: 'REPAIR' },
  { slug: 'kelistrikan', name: 'Kelistrikan', kind: 'EXPENSE', group: 'REPAIR' },
  { slug: 'bodi', name: 'Bodi', kind: 'EXPENSE', group: 'REPAIR' },
  { slug: 'cat', name: 'Cat', kind: 'EXPENSE', group: 'REPAIR' },

  // Maintenance
  { slug: 'oli', name: 'Oli', kind: 'EXPENSE', group: 'MAINTENANCE' },
  { slug: 'filter', name: 'Filter', kind: 'EXPENSE', group: 'MAINTENANCE' },
  { slug: 'coolant', name: 'Coolant', kind: 'EXPENSE', group: 'MAINTENANCE' },
  { slug: 'aki', name: 'Aki', kind: 'EXPENSE', group: 'MAINTENANCE' },
  { slug: 'ban', name: 'Ban', kind: 'EXPENSE', group: 'MAINTENANCE' },

  // Documentation
  { slug: 'stnk', name: 'STNK', kind: 'EXPENSE', group: 'DOCUMENTATION' },
  { slug: 'bpkb', name: 'BPKB', kind: 'EXPENSE', group: 'DOCUMENTATION' },
  { slug: 'pajak', name: 'Pajak', kind: 'EXPENSE', group: 'DOCUMENTATION' },
  { slug: 'balik-nama', name: 'Balik Nama', kind: 'EXPENSE', group: 'DOCUMENTATION' },
  { slug: 'administrasi', name: 'Administrasi', kind: 'EXPENSE', group: 'DOCUMENTATION' },

  // Logistics
  { slug: 'transport', name: 'Transport', kind: 'EXPENSE', group: 'LOGISTICS' },
  { slug: 'pengiriman', name: 'Pengiriman', kind: 'EXPENSE', group: 'LOGISTICS' },
  { slug: 'derek', name: 'Derek', kind: 'EXPENSE', group: 'LOGISTICS' },
  { slug: 'parkir', name: 'Parkir', kind: 'EXPENSE', group: 'LOGISTICS' },

  // Selling
  { slug: 'biaya-marketplace', name: 'Biaya Marketplace', kind: 'EXPENSE', group: 'SELLING' },
  { slug: 'iklan', name: 'Iklan', kind: 'EXPENSE', group: 'SELLING' },
  { slug: 'komisi', name: 'Komisi', kind: 'EXPENSE', group: 'SELLING' },

  // Other
  { slug: 'lainnya', name: 'Lainnya', kind: 'EXPENSE', group: 'OTHER' },
  { slug: 'operasional', name: 'Operasional Usaha', kind: 'EXPENSE', group: 'OTHER' },

  // Income
  { slug: 'penjualan-motor', name: 'Penjualan Motor', kind: 'INCOME', group: 'SALE', role: 'SALE' },
  { slug: 'pendapatan-lain', name: 'Pendapatan Lain', kind: 'INCOME', group: 'OTHER_INCOME' },
]

async function main() {
  const email = process.env.SEED_USER_EMAIL ?? 'admin@motoflip.local'
  const password = process.env.SEED_USER_PASSWORD ?? 'motoflip123'
  const name = process.env.SEED_USER_NAME ?? 'Operator'

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash: await hashPassword(password) },
  })
  console.log(`✓ Operator: ${email}`)

  await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })

  for (const [index, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { userId_slug: { userId: user.id, slug: category.slug } },
      update: { name: category.name, group: category.group, role: category.role ?? 'NORMAL' },
      create: {
        userId: user.id,
        slug: category.slug,
        name: category.name,
        kind: category.kind,
        group: category.group,
        role: category.role ?? 'NORMAL',
        isSystem: true,
        sortOrder: index,
      },
    })
  }
  console.log(`✓ ${CATEGORIES.length} kategori`)

  const existingAccounts = await prisma.cashAccount.count({ where: { userId: user.id } })
  if (existingAccounts === 0) {
    await prisma.cashAccount.createMany({
      data: [
        { userId: user.id, name: 'Kas Tunai', kind: 'CASH', openingBalance: 15_000_000n, sortOrder: 0 },
        { userId: user.id, name: 'Bank BCA', kind: 'BANK', openingBalance: 60_000_000n, sortOrder: 1 },
      ],
    })
    console.log('✓ 2 akun kas')
  }

  // §25 — tracked market models, at model+year granularity. Snapshots are NOT
  // seeded: they come from the provider at read time, or from observations the
  // user records. Seeding fake history would be exactly what §39 forbids.
  const tracked = [
    { brand: 'Yamaha', model: 'NMAX', variant: 'Connected ABS', year: 2022 },
    { brand: 'Yamaha', model: 'NMAX', variant: null, year: 2023 },
    { brand: 'Honda', model: 'Vario 160', variant: 'CBS', year: 2023 },
    { brand: 'Honda', model: 'PCX 160', variant: 'ABS', year: 2022 },
    { brand: 'Yamaha', model: 'Aerox', variant: '155 Connected', year: 2023 },
    { brand: 'Honda', model: 'Beat', variant: 'Deluxe', year: 2020 },
    { brand: 'Honda', model: 'Vario 125', variant: 'CBS ISS', year: 2021 },
  ]

  for (const model of tracked) {
    const created = await prisma.marketModel.upsert({
      where: {
        userId_brand_model_year: {
          userId: user.id,
          brand: model.brand,
          model: model.model,
          year: model.year,
        },
      },
      update: {},
      create: { ...model, userId: user.id },
    })
    await prisma.watchlistItem.upsert({
      where: {
        userId_marketModelId: { userId: user.id, marketModelId: created.id },
      },
      update: {},
      create: { userId: user.id, marketModelId: created.id },
    })
  }
  console.log(`✓ ${tracked.length} model dipantau`)

  const existingBikes = await prisma.motorcycle.count({ where: { userId: user.id } })
  if (existingBikes > 0) {
    console.log('• Data motor sudah ada — demo dilewati')
    return
  }

  const accounts = await prisma.cashAccount.findMany({ where: { userId: user.id }, orderBy: { sortOrder: 'asc' } })
  const cash = accounts[0]!
  const categories = await prisma.category.findMany({ where: { userId: user.id } })
  const cat = (slug: string) => {
    const found = categories.find((c) => c.slug === slug)
    if (!found) throw new Error(`Kategori ${slug} tidak ditemukan`)
    return found.id
  }

  const vendors = await Promise.all(
    [
      { name: 'Bengkel Jaya Motor', category: 'Bengkel Umum', phone: '0812-1111-2222' },
      { name: 'Bengkel CVT Spesialis', category: 'CVT', phone: '0813-3333-4444' },
      { name: 'Biro Jasa Samsat', category: 'Dokumen', phone: '0821-5555-6666' },
    ].map((v) => prisma.vendor.create({ data: { ...v, userId: user.id } })),
  )

  interface DemoBike {
    brand: string; model: string; variant?: string; year: number; color: string; mileage: number
    plate: string; status: 'OWNED' | 'PREPARATION' | 'READY_TO_SELL' | 'LISTED' | 'SOLD' | 'LEAD'
    source: 'FACEBOOK_MARKETPLACE' | 'OLX' | 'DEALER' | 'DIRECT_OWNER' | 'FRIEND' | 'AUCTION'
    projPurchase?: bigint; projRepair?: bigint; target?: bigint
    purchase?: { amount: bigint; on: string }
    costs?: { amount: bigint; slug: string; on: string; vendor?: number; note?: string }[]
    sale?: { amount: bigint; on: string }
    listedAt?: string; listedPrice?: bigint
  }

  const demo: DemoBike[] = [
    {
      brand: 'Yamaha', model: 'NMAX', variant: 'Connected ABS', year: 2022, color: 'Hitam', mileage: 18_400,
      plate: 'BL 2891 XY', status: 'SOLD', source: 'OLX',
      projPurchase: 21_000_000n, projRepair: 1_000_000n, target: 26_500_000n,
      purchase: { amount: 21_500_000n, on: '2026-06-04' },
      costs: [
        { amount: 450_000n, slug: 'cvt', on: '2026-06-06', vendor: 1, note: 'Servis CVT + ganti roller' },
        { amount: 120_000n, slug: 'oli', on: '2026-06-06', vendor: 0 },
        { amount: 300_000n, slug: 'aki', on: '2026-06-07', vendor: 0 },
        { amount: 150_000n, slug: 'transport', on: '2026-06-05' },
        { amount: 200_000n, slug: 'balik-nama', on: '2026-06-10', vendor: 2 },
      ],
      sale: { amount: 26_000_000n, on: '2026-06-27' },
    },
    {
      brand: 'Honda', model: 'Vario 125', variant: 'CBS ISS', year: 2021, color: 'Merah', mileage: 24_100,
      plate: 'BL 4417 AC', status: 'SOLD', source: 'FACEBOOK_MARKETPLACE',
      projPurchase: 14_500_000n, projRepair: 800_000n, target: 18_000_000n,
      purchase: { amount: 14_200_000n, on: '2026-07-02' },
      costs: [
        { amount: 650_000n, slug: 'mesin', on: '2026-07-05', vendor: 0, note: 'Turun mesin ringan' },
        { amount: 280_000n, slug: 'ban', on: '2026-07-06', vendor: 0 },
        { amount: 100_000n, slug: 'oli', on: '2026-07-06', vendor: 0 },
        { amount: 175_000n, slug: 'iklan', on: '2026-07-10' },
      ],
      sale: { amount: 17_600_000n, on: '2026-07-24' },
    },
    {
      brand: 'Yamaha', model: 'NMAX', variant: 'Standard', year: 2022, color: 'Putih', mileage: 21_700,
      plate: 'BL 1120 KD', status: 'SOLD', source: 'OLX',
      projPurchase: 20_500_000n, projRepair: 1_200_000n, target: 25_500_000n,
      purchase: { amount: 20_800_000n, on: '2026-07-14' },
      costs: [
        { amount: 520_000n, slug: 'cvt', on: '2026-07-17', vendor: 1 },
        { amount: 340_000n, slug: 'bodi', on: '2026-07-19', vendor: 0, note: 'Poles + ganti cover' },
        { amount: 200_000n, slug: 'balik-nama', on: '2026-07-22', vendor: 2 },
      ],
      sale: { amount: 25_200_000n, on: '2026-08-05' },
    },
    {
      brand: 'Honda', model: 'PCX 160', variant: 'ABS', year: 2022, color: 'Silver', mileage: 15_200,
      plate: 'BL 7788 QR', status: 'LISTED', source: 'DEALER',
      projPurchase: 27_000_000n, projRepair: 1_500_000n, target: 32_500_000n,
      purchase: { amount: 27_400_000n, on: '2026-07-20' },
      costs: [
        { amount: 480_000n, slug: 'rem', on: '2026-07-24', vendor: 0 },
        { amount: 150_000n, slug: 'oli', on: '2026-07-24', vendor: 0 },
        { amount: 250_000n, slug: 'iklan', on: '2026-08-02' },
      ],
      listedAt: '2026-08-02', listedPrice: 32_500_000n,
    },
    {
      brand: 'Yamaha', model: 'Aerox', variant: '155 Connected', year: 2023, color: 'Biru', mileage: 9_800,
      plate: 'BL 3355 MN', status: 'PREPARATION', source: 'DIRECT_OWNER',
      projPurchase: 23_000_000n, projRepair: 1_000_000n, target: 27_500_000n,
      purchase: { amount: 22_800_000n, on: '2026-08-18' },
      costs: [
        { amount: 1_450_000n, slug: 'kelistrikan', on: '2026-08-22', vendor: 0, note: 'Ganti ECU bekas' },
        { amount: 130_000n, slug: 'oli', on: '2026-08-22', vendor: 0 },
      ],
    },
    {
      brand: 'Honda', model: 'Beat', variant: 'Deluxe', year: 2020, color: 'Hitam', mileage: 38_600,
      plate: 'BL 9012 TT', status: 'OWNED', source: 'AUCTION',
      projPurchase: 9_500_000n, projRepair: 1_200_000n, target: 12_500_000n,
      purchase: { amount: 9_800_000n, on: '2026-06-20' },
      costs: [
        { amount: 380_000n, slug: 'cvt', on: '2026-06-25', vendor: 1 },
        { amount: 220_000n, slug: 'ban', on: '2026-07-01', vendor: 0 },
      ],
    },
    {
      brand: 'Honda', model: 'Vario 160', variant: 'CBS', year: 2023, color: 'Hitam Doff', mileage: 11_300,
      plate: '', status: 'LEAD', source: 'FACEBOOK_MARKETPLACE',
      projPurchase: 24_500_000n, projRepair: 800_000n, target: 29_000_000n,
    },
  ]

  for (const bike of demo) {
    const created = await prisma.motorcycle.create({
      data: {
        userId: user.id,
        brand: bike.brand, model: bike.model, variant: bike.variant ?? null,
        year: bike.year, color: bike.color, mileage: bike.mileage,
        plateNumber: bike.plate || null,
        status: bike.status,
        acquisitionSource: bike.source,
        projectedPurchasePrice: bike.projPurchase ?? null,
        projectedRepairCost: bike.projRepair ?? null,
        targetSellingPrice: bike.target ?? null,
        listedAt: bike.listedAt ? d(bike.listedAt) : null,
        listedPrice: bike.listedPrice ?? null,
        location: 'Banda Aceh',
      },
    })

    await prisma.statusChange.create({
      data: { userId: user.id, motorcycleId: created.id, fromStatus: null, toStatus: bike.status, occurredAt: bike.purchase ? d(bike.purchase.on) : created.createdAt },
    })

    if (bike.purchase) {
      await prisma.ledgerEntry.create({
        data: {
          userId: user.id, type: 'EXPENSE', amount: bike.purchase.amount,
          occurredAt: d(bike.purchase.on), accountId: cash.id,
          motorcycleId: created.id, categoryId: cat('pembelian-motor'),
          note: `Pembelian ${bike.brand} ${bike.model}`,
        },
      })
    }

    for (const c of bike.costs ?? []) {
      await prisma.ledgerEntry.create({
        data: {
          userId: user.id, type: 'EXPENSE', amount: c.amount,
          occurredAt: d(c.on), accountId: cash.id,
          motorcycleId: created.id, categoryId: cat(c.slug),
          vendorId: c.vendor !== undefined ? vendors[c.vendor]!.id : null,
          note: c.note ?? null,
        },
      })
    }

    if (bike.sale) {
      await prisma.ledgerEntry.create({
        data: {
          userId: user.id, type: 'INCOME', amount: bike.sale.amount,
          occurredAt: d(bike.sale.on), accountId: cash.id,
          motorcycleId: created.id, categoryId: cat('penjualan-motor'),
          note: `Penjualan ${bike.brand} ${bike.model}`,
        },
      })
    }
  }

  console.log(`✓ ${demo.length} motor demo`)

  console.log('\nMasuk dengan:')
  console.log(`  Email    : ${email}`)
  console.log(`  Password : ${password}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
