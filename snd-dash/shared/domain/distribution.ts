// shared/domain/distribution.ts
import { Decimal, toMoney } from './decimal'
import type { MoneyString, RatioString } from './types'

/** Laba Dibagikan = laba diaudit − laba ditahan. */
export function labaDibagikan(labaDiaudit: MoneyString, labaDitahan: MoneyString): MoneyString {
  return toMoney(new Decimal(labaDiaudit).minus(new Decimal(labaDitahan)))
}

/** Budget pool komponen = ratio × Laba Dibagikan. */
export function budgetPool(ratio: RatioString, dibagikan: MoneyString): MoneyString {
  return toMoney(new Decimal(ratio).mul(new Decimal(dibagikan)))
}

/** Dividen owner = Portion × pool Dividen. */
export function dividenOwner(portion: RatioString, poolDividen: MoneyString): MoneyString {
  return toMoney(new Decimal(portion).mul(new Decimal(poolDividen)))
}

/** Insentif owner = (poin owner ÷ total poin) × pool Insentif. */
export function insentifOwner(poinOwner: number, totalPoin: number, poolInsentif: MoneyString): MoneyString {
  if (totalPoin === 0) return toMoney(new Decimal(0))
  return toMoney(new Decimal(poinOwner).div(totalPoin).mul(new Decimal(poolInsentif)))
}
