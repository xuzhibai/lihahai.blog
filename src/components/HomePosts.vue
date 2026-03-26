<script setup lang="ts">
import type { Post } from '~/types'
import { useRouter } from 'vue-router/auto'
import dayjs from 'dayjs'

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
  <section class="recent-posts">
    <h2 class="section-title">📌 最近文章</h2>

    <div v-if="!posts.length" class="empty">
      还没有文章，敬请期待...
    </div>

    <div v-else class="post-list">
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
        <article class="post-article">
          <div class="post-header">
            <h3 class="post-title">
              {{ route.title }}
            </h3>
            <div class="post-meta">
              <span>{{ dayjs(route.date).format('YYYY-MM-DD') }}</span>
              <span v-if="route.duration" class="separator">·</span>
              <span v-if="route.duration">{{ route.duration }}</span>
            </div>
          </div>
          <p v-if="route.desc" class="post-desc">
            {{ route.desc }}
          </p>
        </article>
      </component>
    </div>

    <RouterLink to="/posts" class="view-all">
      查看全部（{{ routes.length }}）→
    </RouterLink>
  </section>
</template>

<style scoped>
.recent-posts {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(60, 60, 60, 0.12);
}

:global(.dark) .recent-posts {
  border-top-color: rgba(255, 255, 255, 0.15);
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  opacity: 0.85;
}

.post-list {
  display: flex;
  flex-direction: column;
}

.post-item {
  display: block;
  padding: 0.875rem 0;
  text-decoration: none !important;
  color: inherit;
  border: none;
}

:global(.dark) .post-item {
  border-bottom-color: rgba(255, 255, 255, 0.15);
}

.post-article {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.post-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

@media (min-width: 640px) {
  .post-header {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }
}

.post-title {
  font-size: 0.9375rem;
  font-weight: 500;
  margin: 0;
  line-height: 1.4;
  opacity: 0.75;
  transition: opacity 0.2s;
  flex: 1;
  min-width: 0;
}

.post-item:hover .post-title {
  opacity: 1;
}
.post-item:hover {
  border: none;
}

.post-meta {
  font-size: 0.75rem;
  opacity: 0.5;
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  flex-shrink: 0;
}

.separator {
  opacity: 0.6;
}

.post-desc {
  font-size: 0.8125rem;
  opacity: 0.55;
  margin: 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.view-all {
  display: inline-block;
  margin-top: 0.75rem;
  font-size: 0.6875rem;
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
  font-size: 0.875rem;
}
</style>
