// server/domain/pricing/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain pricing (FR-6/FR-7, AD-7).
//
// Modul lain HANYA boleh mengimpor dari sini (bukan dari service/repo internal),
// mengikuti design.md PART A A.4 `PricingModule`:
//   currentPrice(kind, onJakartaDate) — resolusi TEPAT satu baris (AD-7)
//   priceHistory(kind)                — seluruh riwayat harga (FR-6.2)
//   setPrice(cooId, input, momRef)    — simpan harga; unik (kind, effective_date)
//   saveMom(cooId, mom)               — FR-7 draft → final
//
// Catatan tanda tangan: `currentPrice`/`priceHistory` menerima parameter `tx`
// OPSIONAL agar finalisasi/orders dapat mengunci Harga Terkunci DI DALAM
// transaksi (design.md B.2: `pricing.currentPrice(tx, 'beli', …)`), sekaligus
// tetap memenuhi kontrak baca publik A.4 saat dipanggil tanpa `tx`.

import type { Tx } from '../../utils/db'
import type {
  JakartaDate,
  PriceKind,
  Uuid,
} from '../../../shared/domain/types'
import * as service from './pricing.service'
import type { Mom, PricePeriod } from './pricing.repo'
import type { MomInput, SetPriceInput } from './events'

/** Kontrak lintas-modul domain pricing (design.md A.4). */
export interface PricingModule {
  currentPrice(
    kind: PriceKind,
    onJakartaDate: JakartaDate,
    tx?: Tx,
  ): Promise<PricePeriod> // resolusi TEPAT satu baris (AD-7)
  priceHistory(kind: PriceKind, tx?: Tx): Promise<PricePeriod[]>
  setPrice(
    cooId: Uuid,
    input: SetPriceInput,
    momRef: Uuid,
  ): Promise<PricePeriod> // unik (kind, effective_date)
  saveMom(cooId: Uuid, mom: MomInput): Promise<Mom> // FR-7 draft → final
}

/** Implementasi pintu pricing — objek tunggal yang memenuhi `PricingModule`. */
export const pricing: PricingModule = {
  currentPrice: service.currentPrice,
  priceHistory: service.priceHistory,
  setPrice: service.setPrice,
  saveMom: service.saveMom,
}

// Re-ekspor tipe kontrak & error agar pemanggil lintas modul cukup mengimpor
// dari pintu ini.
export type { PricePeriod, Mom } from './pricing.repo'
export type { SetPriceInput, MomInput, PricingErrorCode } from './events'
export { PricingError } from './events'
