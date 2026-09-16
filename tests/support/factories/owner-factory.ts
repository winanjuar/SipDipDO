/**
 * Factory pemegang saham — data SINTETIS (kebijakan repo: data owner nyata
 * tidak boleh masuk repo). Kontrak mengikuti konvensi terdokumentasi di
 * server/domain/identity/owner.repo.ts (tabel owners = Story 1.4+):
 * email UNIQUE (re-daftar = baris yang sama, AD-11); status enum
 * `diajukan|terverifikasi|ditolak|kedaluwarsa|keluar`.
 * Helper seeding API menyusul saat endpoint pendaftaran ada (Epic 1).
 */
import { faker } from '@faker-js/faker/locale/id_ID'

export type StatusPemegang =
  | 'diajukan'
  | 'terverifikasi'
  | 'ditolak'
  | 'kedaluwarsa'
  | 'keluar'

export interface PemegangSaham {
  id: string
  email: string
  nama: string
  status: StatusPemegang
}

export const createPemegangSaham = (overrides: Partial<PemegangSaham> = {}): PemegangSaham => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  nama: faker.person.fullName(),
  status: 'diajukan',
  ...overrides,
})

/** Varian tersusun (pola data-factories.md § Factory Composition). */
export const createPemegangTerverifikasi = (overrides: Partial<PemegangSaham> = {}) =>
  createPemegangSaham({ status: 'terverifikasi', ...overrides })

export const createPemegangKeluar = (overrides: Partial<PemegangSaham> = {}) =>
  createPemegangSaham({ status: 'keluar', ...overrides })
