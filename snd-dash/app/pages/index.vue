<script setup lang="ts">
// Landing publik ('/'). Layout default (header/content/footer). Bila sudah login,
// redirect ke beranda dashboard '/dashboard'.
interface SessionUser {
  email?: string | null
}

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: session } = await useAsyncData('auth-session', () =>
  $fetch<{ user?: SessionUser } | null>('/api/auth/session', { headers }),
)
const isAuthenticated = computed(() => !!session.value?.user?.email)

definePageMeta({ layout: 'default' })
if (isAuthenticated.value) {
  await navigateTo('/dashboard')
}
</script>

<template>
  <div>
    <section class="hero">
      <h1 class="hero__title">Sip &amp; Dip Ownership Dashboard</h1>
      <p class="hero__sub">
        Satu sumber kebenaran kepemilikan cafe: pesan saham mandiri, validasi
        pembobotan otomatis, dashboard kepemilikan yang selalu mutakhir.
      </p>
      <div class="hero__actions">
        <NuxtLink to="/session" class="btn">Masuk ke Dashboard</NuxtLink>
        <NuxtLink to="/harga" class="btn btn--ghost">Lihat Harga</NuxtLink>
      </div>
    </section>

    <section class="features">
      <div class="feature">
        <h3>Pesanan Mandiri</h3>
        <p>Owner memesan saham dengan pratinjau Ceil, Shares, Strength, dan RTL sebelum submit.</p>
      </div>
      <div class="feature">
        <h3>RKAP &amp; Fulfillment</h3>
        <p>Ruang penyertaan modal terkontrol per fase dengan gerbang pembelian otomatis.</p>
      </div>
      <div class="feature">
        <h3>Distribusi Transparan</h3>
        <p>Dividen &amp; Insentif dihitung dari Portion dan poin Contribution.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 2.5rem 2rem;
  text-align: center;
}
.hero__title {
  margin: 0;
  font-size: 2rem;
}
.hero__sub {
  max-width: 640px;
  margin: 0.75rem auto 1.5rem;
  color: #64748b;
}
.hero__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}
.btn {
  padding: 0.65rem 1.25rem;
  border-radius: 10px;
  background: #4f46e5;
  color: #fff;
  text-decoration: none;
  font-weight: 500;
}
.btn--ghost {
  background: #f1f5f9;
  color: #0f172a;
}
.features {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.feature {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
}
.feature h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}
.feature p {
  margin: 0;
  color: #64748b;
  font-size: 0.88rem;
}
</style>
