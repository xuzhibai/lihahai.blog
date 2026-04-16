<script setup lang="ts">
function toTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

const { y: scroll } = useWindowScroll()
</script>

<template>
  <header class="header z-40">
    <RouterLink
      class="logo-link absolute xl:fixed select-none outline-none"
      to="/"
      focusable="false"
    >
      <Logo />
    </RouterLink>
    <button
      title="Scroll to top"
      fixed right-3 bottom-3 w-10 h-10 hover:op100 rounded-full
      hover-bg-hex-8883 transition duration-300 z-100 print:hidden
      :class="scroll > 300 ? 'op40' : 'op0! pointer-events-none'"
      @click="toTop()"
    >
      <div i-ri-arrow-up-line />
    </button>

    <nav class="nav">
      <div class="spacer" />
      <div class="right" print:op0>
        <RouterLink to="/posts" title="Blog">
          <span class="lt-md:hidden">Blog</span>
          <div i-ri-article-line md:hidden />
        </RouterLink>
        <!--        <RouterLink to="/projects" title="Projects"> -->
        <!--          <span class="lt-md:hidden">Projects</span> -->
        <!--          <div i-ri-lightbulb-line class="md:hidden" /> -->
        <!--        </RouterLink> -->
        <!--        <RouterLink to="/talks" class="lt-md:hidden" title="Talks"> -->
        <!--          Talks -->
        <!--        </RouterLink> -->
        <RouterLink to="/media" title="Media">
          <span class="lt-md:hidden">Media</span>
          <div i-ri-movie-line class="md:hidden" />
        </RouterLink>
        <!--        <RouterLink to="/sponsors-list" title="Sponsors"> -->
        <!--          <span class="lt-md:hidden">Sponsors</span> -->
        <!--          <div i-ri-heart-line class="md:hidden" /> -->
        <!--        </RouterLink> -->
        <!--        <RouterLink to="/podcasts" class="lt-md:hidden" title="Podcasts"> -->
        <!--          <div i-ri-mic-line /> -->
        <!--        </RouterLink> -->
        <RouterLink to="/friends" class="lt-md:hidden" title="Friends">
          <div i-ri-user-heart-line />
        </RouterLink>
        <RouterLink to="/photos" title="Photos">
          <div i-ri-camera-3-line />
        </RouterLink>
        <!--        <RouterLink to="/demos" title="Demos"> -->
        <!--          <div i-ri-screenshot-line /> -->
        <!--        </RouterLink> -->
        <a href="https://github.com/xuzhibai" target="_blank" title="GitHub" class="lt-md:hidden">
          <div i-uil-github-alt />
        </a>
        <!--        <a href="/feed.xml" target="_blank" title="RSS" class="lt-md:hidden"> -->
        <!--          <div i-la-rss-square style="font-size:1.25rem; margin: 0 -0.125rem;" /> -->
        <!--        </a> -->
        <ToggleTheme />
      </div>
    </nav>
  </header>
</template>

<style scoped>
.header h1 {
  margin-bottom: 0;
}

.logo {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
}

.nav {
  padding: 2rem;
  width: 100%;
  display: grid;
  grid-template-columns: auto max-content;
  box-sizing: border-box;
}

.nav > * {
  margin: auto;
}

.nav img {
  margin-bottom: 0;
}

.nav a {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: opacity 0.2s ease;
  opacity: 0.6;
  outline: none;
}

.nav a:hover {
  opacity: 1;
  text-decoration-color: inherit;
}

.nav .right {
  display: grid;
  grid-gap: 1.2rem;
  grid-auto-flow: column;
}

.nav .right > * {
  margin: auto;
}

.logo-link {
  top: 0;
  left: 0;
  margin: 1.625rem 1.25rem;
  width: 2.25rem;
  height: 2.25rem;
}

@media (min-width: 768px) {
  .logo-link {
    margin: 1.25rem;
    width: 2.75rem;
    height: 2.75rem;
  }
}

.logo-link :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.12);
}
</style>
