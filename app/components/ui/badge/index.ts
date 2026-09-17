import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Badge } from "./Badge.vue"

/**
 * Varian Badge shadcn-vue + delta UX-DR2 (DESIGN.md `status-badge`):
 * `success` (Terverifikasi/Terkonfirmasi) dan `warn` (Diajukan/Menunggu
 * Konfirmasi) memakai token semantik brand; `destructive` (Ditolak) dan
 * `muted` (Kedaluwarsa) diwarisi shadcn apa adanya. Badge status SELALU
 * berteks — warna bukan satu-satunya pembawa makna (UX-DR4).
 */
export const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium w-fit shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        "default":
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        "secondary":
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        "destructive":
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 focus-visible:ring-3",
        "outline":
          "text-foreground [a&]:hover:bg-accent",
        "success":
          "border-transparent bg-success text-success-foreground",
        "warn":
          "border-transparent bg-warn text-warn-foreground",
        "muted":
          "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)
export type BadgeVariants = VariantProps<typeof badgeVariants>
