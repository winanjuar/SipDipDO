<script setup lang="ts">
// Layout publik: header + <slot/> (content) + footer. Dipakai landing & login.
const year = new Date().getFullYear()
</script>

<template>
  <div class="shell">
    <header class="hdr">
      <div class="hdr__inner">
        <NuxtLink to="/" class="brand">
          <span class="brand__dot" />
          Sip &amp; Dip
        </NuxtLink>
        <nav class="hdr__nav">
          <NuxtLink to="/harga" class="hdr__link">Harga</NuxtLink>
          <NuxtLink to="/rkap" class="hdr__link">RKAP</NuxtLink>
          <NuxtLink to="/session" class="hdr__cta">Masuk</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="content">
      <slot />
    </main>

    <footer class="ftr">
      <div class="ftr__inner">
        <span>© {{ year }} Sip &amp; Dip Ownership Dashboard</span>
        <span class="ftr__muted">Phase 1</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #0f172a;
}
.hdr {
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;
}
.hdr__inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.85rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 1.1rem;
  color: #0f172a;
  text-decoration: none;
}
.brand__dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #4f46e5;
  display: inline-block;
}
.hdr__nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.hdr__link {
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  color: #334155;
  text-decoration: none;
  font-size: 0.9rem;
}
.hdr__link:hover {
  background: #f1f5f9;
}
.hdr__cta {
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  text-decoration: none;
  font-size: 0.9rem;
}
.content {
  flex: 1;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem;
  box-sizing: border-box;
}
.ftr {
  background: #fff;
  border-top: 1px solid #e2e8f0;
}
.ftr__inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  color: #64748b;
  font-size: 0.85rem;
}
.ftr__muted {
  color: #94a3b8;
}
</style>
