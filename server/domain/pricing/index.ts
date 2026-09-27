/**
 * PRICING (AD-7) — satu-satunya pintu impor lintas modul untuk harga berjalan,
 * riwayat harga, dan MoM.
 */

// MoM service exports (Story 2.1)
export {
  buatMom,
  finalkanMom,
  getMomById,
  hapusMom,
  listFinalMoms,
  listForPemegangSaham,
  MomDomainError,
  ubahMom,
} from './mom.service'
export { MOM_LIMIT_DEFAULT, MOM_LIMIT_OPSI, isMomLimit } from '#shared/domain/mom'
export type { MomCreateInput, MomDaftar, MomLimit, MomUpdateInput, MomWire } from '#shared/domain/mom'

// PDF service exports (Story 2.2)
export {
  deleteMomPdf,
  generateSignedUrl,
  PdfDomainError,
  uploadMomPdf,
} from './pdf.service'
export {
  MOM_PDF_ALLOWED_MIME_TYPES,
  MOM_PDF_BUCKET,
  MOM_PDF_MAX_SIZE_BYTES,
  MOM_PDF_SIGNED_URL_EXPIRY_SECONDS,
} from '#shared/domain/mom'

// Pricing service exports (Story 2.3)
export {
  koreksiHarga,
  listHarga,
  PricingDomainError,
  resolveHargaBerjalan,
  tetapkanHarga,
} from './pricing.service'

// Re-export price types, constants, and utilities from shared/domain (AD-5, AD-6)
export {
  PRICE_LIMIT_DEFAULT,
  PRICE_LIMIT_OPSI,
  PRICE_TYPES,
  isPriceLimit,
  isPriceType,
  resolvePrice,
  resolvePricePair,
  validatePriceCorrectInput,
  validatePriceCreateInput,
} from '#shared/domain/price'
export type {
  PriceCorrectInput,
  PriceCreateInput,
  PriceDaftar,
  PriceLimit,
  PriceResolveResult,
  PriceType,
  PriceWire,
} from '#shared/domain/price'
