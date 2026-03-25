<script setup lang="ts">
const socialLinks = [
  {
    name: 'GitHub',
    url: 'https://github.com/xuzhibai',
    icon: 'i-uil-github-alt',
  },
]
</script>

<template>
  <div class="home-profile">
    <h1>你好，我是叙枝白</h1>
    <p class="subtitle">后端开发工程师 · 技术爱好者</p>
    <p class="bio">
      热爱编程，专注于后端开发。喜欢探索新技术，享受将想法转化为现实的过程。
    </p>
    <div class="social-links">
      <a
        v-for="link in socialLinks"
        :key="link.name"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span :class="link.icon" />
        <span>{{ link.name }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.home-profile {
  margin-bottom: 3rem;
}

h1 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  font-size: 1rem;
  opacity: 0.7;
  margin: 0 0 1rem 0;
}

.bio {
  font-size: 1rem;
  line-height: 1.7;
  opacity: 0.85;
  margin-bottom: 1.5rem;
  max-width: 500px;
}

.social-links {
  display: flex;
  gap: 1rem;
}

.social-links a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.social-links a:hover {
  opacity: 1;
}
</style>
