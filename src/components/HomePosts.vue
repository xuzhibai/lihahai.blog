<script setup lang="ts">
import type { Post } from '~/types'
import { useRouter } from 'vue-router/auto'
import { formatDate } from '~/logics'

const router = useRouter()
const maxPosts = 5

interface RouteType {
  path: string
  meta: {
    frontmatter: {
      redirect?: string
      title: string
      date: string
      lang?: string
      duration?: string
      draft?: boolean
      desc?: string
    }
  }
}

const routes: Post[] = router.getRoutes()
  .filter((i: RouteType) => (i.path.startsWith('/posts') || i.path.startsWith('/zh')) && i.meta.frontmatter.date && !i.meta.frontmatter.draft)
  .filter((i: RouteType) => !i.path.endsWith('.html'))
  .map((i: RouteType) => ({
    path: i.meta.frontmatter.redirect || i.path,
    title: i.meta.frontmatter.title,
    date: i.meta.frontmatter.date,
    lang: i.meta.frontmatter.lang,
    duration: i.meta.frontmatter.duration,
    desc: i.meta.frontmatter.desc,
  }))

const posts = computed(() =>
  routes
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, maxPosts),
)
</script>

<template>
  <div class="home-posts">
    <h3>最近文章</h3>

    <div v-if="!posts.length" class="empty">
      还没有文章，敬请期待...
    </div>

    <div class="post-list">
      <component
        :is="route.path.includes('://') ? 'a' : 'RouterLink'"
        v-for="route in posts"
        :key="route.path"
        v-bind="route.path.includes('://') ? {
          href: route.path,
          target: '_blank',
          rel: 'noopener noreferrer',
        } : {
          to: route.path,
        }"
        class="post-item"
      >
        <div class="post-title">{{ route.title }}</div>
        <div class="post-meta">
          <span>{{ formatDate(route.date, true) }}</span>
          <span v-if="route.duration">· {{ route.duration }}</span>
        </div>
        <p v-if="route.desc" class="post-desc">{{ route.desc }}</p>
      </component>
    </div>

    <RouterLink to="/posts" class="view-all">
      查看全部（{{ routes.length }}）
      <span i-ri-arrow-right-line />
    </RouterLink>
  </div>
</template>

<style scoped>
.home-posts {
  margin-top: 1.5rem;
}

h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  opacity: 0.9;
}

.post-list {
  display: flex;
  flex-direction: column;
}

.post-item {
  display: block;
  padding: 0.625rem 0;
  border-bottom: none !important;
  text-decoration: none !important;
  color: inherit;
}

.post-title {
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.25rem 0;
  line-height: 1.4;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.post-item:hover .post-title {
  opacity: 1;
}

.post-meta {
  font-size: 0.8rem;
  opacity: 0.55;
  margin-bottom: 0.25rem;
}

.post-desc {
  font-size: 0.85rem;
  opacity: 0.65;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.view-all {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  opacity: 0.6;
  text-decoration: none;
  transition: opacity 0.2s;
}

.view-all:hover {
  opacity: 1;
}

.empty {
  padding: 2rem 0;
  opacity: 0.6;
}
</style>
