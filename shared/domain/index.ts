/**
 * shared/domain barrel export (AD-5)
 *
 * Semua import lintas modul domain HARUS lewat index.ts modul ini.
 * Jangan import langsung dari file implementasi (mis. money.ts).
 */

// Money utilities (AD-10 / Req-15, Req-16)
export type { Decimal } from './money'
export type {
  Rupiah,
  Ratio,
  FixedScale,
  FixedDecimal,
  FixedRupiah,
  FixedRatio,
} from './money'

export {
  // Constants
  RUPIAH_SCALE,
  RATIO_SCALE,
  // Error class
  MoneyParseError,
  // Branded constructors
  asRupiah,
  asRatio,
  // Parse/serialize functions
  parseRupiah,
  serializeRupiah,
  parseRatio,
  serializeRatio,
  serializeRatioPercent,
  parseDecimal,
  serializeDecimal,
  // Arithmetic helpers
  add,
  subtract,
  multiply,
  divide,
  compare,
  isGreaterThan,
  isGreaterThanOrEqual,
  isLessThan,
  isLessThanOrEqual,
  isEqual,
  isZero,
  isPositive,
  isNegative,
  abs,
  sum,
  decimal,
} from './money'

// Ratio utilities (AD-10 / Req-16)
export { formatRatioAsPercent } from './ratio'

// Price utilities (AD-6, AD-7 / Req-4, Req-15)
export type {
  PriceType,
  PriceWire,
  PriceCreateInput,
  PriceCorrectInput,
  PriceResolveResult,
  PriceLimit,
  PriceDaftar,
} from './price'

export {
  PRICE_TYPES,
  PRICE_LIMIT_OPSI,
  PRICE_LIMIT_DEFAULT,
  isPriceLimit,
  isPriceType,
  validatePriceCreateInput,
  validatePriceCorrectInput,
  resolvePrice,
  resolvePricePair,
} from './price'

// MoM utilities (AD-6 / Req-1, Req-2, AR-13)
export type {
  MomStatus,
  MomLimit,
  MomWire,
  MomCreateInput,
  MomUpdateInput,
  MomDaftar,
} from './mom'

export {
  // Storage configuration (AR-13)
  MOM_PDF_BUCKET,
  MOM_PDF_MAX_SIZE_BYTES,
  MOM_PDF_ALLOWED_MIME_TYPES,
  MOM_PDF_SIGNED_URL_EXPIRY_SECONDS,
  // Status constants
  MOM_STATUSES,
  MOM_LIMIT_OPSI,
  MOM_LIMIT_DEFAULT,
  isMomLimit,
  // Validators
  validateMomCreateInput,
  validateMomUpdateInput,
} from './mom'
