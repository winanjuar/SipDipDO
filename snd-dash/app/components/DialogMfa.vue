<script setup lang="ts">
// app/components/DialogMfa.vue
//
// Dialog MFA — mengumpulkan OTP untuk aksi transaksional COO (FR-3 §3.1, AD-8).
//
// Alur (design.md B.7 / FR-20 §20.2):
//   1. COO membuka dialog untuk sebuah aksi (`konfirmasi` | `input_langsung` |
//      `kompensasi`) yang terikat ke `targetRef` (mis. orderId untuk konfirmasi).
//   2. "Kirim OTP" memanggil POST /api/mfa/request-otp (server: hanya COO
//      bertugas, cooldown 60s). Kode dikirim via email — TIDAK dikembalikan API.
//   3. COO memasukkan OTP; "Konfirmasi" meng-emit `submit(code)` ke induk yang
//      menjalankan aksi transaksional (mis. POST /api/ledger/confirm) dengan kode.
//
// Komponen ini MURNI UI: tidak menjalankan aksi finalisasi sendiri; verifikasi &
// konsumsi OTP terjadi in-tx pada jalur domain (AD-8). Otoritas tetap di server.

import { computed, ref, watch } from 'vue'

type MfaActionType = 'konfirmasi' | 'input_langsung' | 'kompensasi'

const props = withDefaults(
  defineProps<{
    /** v-model: apakah dialog tampil. */
    open: boolean
    /** Aksi MFA (himpunan tertutup, AD-8). */
    actionType: MfaActionType
    /** Referensi target yang mengikat OTP (orderId / requestId / ledgerTxId). */
    targetRef: string
    /** Judul opsional; default berdasarkan actionType. */
    title?: string
    /** Sedang memproses aksi finalisasi di induk (mengunci tombol). */
    busy?: boolean
    /** Pesan error dari induk (mis. OTP salah / re-validasi gagal). */
    errorMessage?: string | null
  }>(),
  {
    title: undefined,
    busy: false,
    errorMessage: null,
  },
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  /** OTP dikirim untuk diverifikasi induk saat menjalankan aksi. */
  (e: 'submit', code: string): void
  (e: 'cancel'): void
}>()

const code = ref('')
const requesting = ref(false)
const requested = ref(false)
const cooldown = ref(0)
const localError = ref<string | null>(null)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

const ACTION_LABEL: Record<MfaActionType, string> = {
  konfirmasi: 'Konfirmasi Pesanan',
  input_langsung: 'Input Langsung',
  kompensasi: 'Kompensasi',
}

const heading = computed(() => props.title ?? `Verifikasi MFA — ${ACTION_LABEL[props.actionType]}`)
const canSubmit = computed(() => code.value.trim().length >= 4 && !props.busy)

function stopCooldown() {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

function startCooldown(seconds: number) {
  cooldown.value = seconds
  stopCooldown()
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) stopCooldown()
  }, 1000)
}

function reset() {
  code.value = ''
  requested.value = false
  requesting.value = false
  localError.value = null
  cooldown.value = 0
  stopCooldown()
}

// Bersihkan state saat dialog ditutup.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) reset()
  },
)

async function requestOtp() {
  if (requesting.value || cooldown.value > 0) return
  requesting.value = true
  localError.value = null
  try {
    const res = await $fetch<{ data?: { ok: boolean } } | { code: string; message: string }>(
      '/api/mfa/request-otp',
      {
        method: 'POST',
        body: { actionType: props.actionType, targetRef: props.targetRef },
      },
    )
    if (res && 'code' in res) {
      localError.value = res.message ?? 'Gagal mengirim OTP.'
      return
    }
    requested.value = true
    // Cooldown lokal 60 detik selaras kebijakan server (FR-3 §3.4).
    startCooldown(60)
  } catch (err) {
    const anyErr = err as { data?: { message?: string }; message?: string }
    localError.value = anyErr?.data?.message ?? anyErr?.message ?? 'Gagal mengirim OTP.'
  } finally {
    requesting.value = false
  }
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', code.value.trim())
}

function close() {
  emit('update:open', false)
  emit('cancel')
}
</script>

<template>
  <div v-if="open" class="mfa-overlay" role="presentation" @click.self="close">
    <div class="mfa-dialog" role="dialog" aria-modal="true" :aria-label="heading">
      <header class="mfa-header">
        <h2>{{ heading }}</h2>
        <button type="button" class="mfa-close" aria-label="Tutup" @click="close">×</button>
      </header>

      <p class="mfa-desc">
        Aksi ini memerlukan verifikasi MFA. Kirim OTP ke email COO yang bertugas,
        lalu masukkan kode untuk melanjutkan.
      </p>

      <div class="mfa-body">
        <button
          type="button"
          class="mfa-btn secondary"
          :disabled="requesting || cooldown > 0"
          @click="requestOtp"
        >
          <span v-if="requesting">Mengirim…</span>
          <span v-else-if="cooldown > 0">Kirim ulang ({{ cooldown }}s)</span>
          <span v-else-if="requested">Kirim ulang OTP</span>
          <span v-else>Kirim OTP</span>
        </button>

        <label class="mfa-field">
          <span>Kode OTP</span>
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="Masukkan kode dari email"
            :disabled="busy"
            @keyup.enter="submit"
          />
        </label>

        <p v-if="requested && !localError && !errorMessage" class="mfa-hint">
          OTP telah dikirim ke email COO. Kode berlaku terbatas dan sekali pakai.
        </p>
        <p v-if="localError" class="mfa-error">{{ localError }}</p>
        <p v-if="errorMessage" class="mfa-error">{{ errorMessage }}</p>
      </div>

      <footer class="mfa-footer">
        <button type="button" class="mfa-btn ghost" :disabled="busy" @click="close">
          Batal
        </button>
        <button type="button" class="mfa-btn primary" :disabled="!canSubmit" @click="submit">
          <span v-if="busy">Memproses…</span>
          <span v-else>Konfirmasi</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mfa-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}
.mfa-dialog {
  background: #fff;
  color: #0f172a;
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25);
  padding: 1.25rem 1.25rem 1rem;
}
.mfa-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}
.mfa-header h2 {
  font-size: 1.05rem;
  margin: 0;
}
.mfa-close {
  background: none;
  border: none;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  color: #64748b;
}
.mfa-desc {
  font-size: 0.85rem;
  color: #475569;
  margin: 0.5rem 0 0.75rem;
}
.mfa-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.mfa-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}
.mfa-field input {
  padding: 0.55rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  letter-spacing: 0.15em;
}
.mfa-hint {
  font-size: 0.78rem;
  color: #16a34a;
  margin: 0;
}
.mfa-error {
  font-size: 0.8rem;
  color: #dc2626;
  margin: 0;
}
.mfa-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
.mfa-btn {
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 0.85rem;
}
.mfa-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.mfa-btn.primary {
  background: #2563eb;
  color: #fff;
}
.mfa-btn.secondary {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}
.mfa-btn.ghost {
  background: #fff;
  border-color: #cbd5e1;
  color: #334155;
}
</style>
