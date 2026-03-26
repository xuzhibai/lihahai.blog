<!-- 参考实现：https://github.com/vikiboss/blog/blob/main/components/table-of-contents.tsx -->
<script setup lang="ts">
interface TocItem {
  id: string
  text: string
  level: number
}

const props = defineProps<{
  items: TocItem[]
}>()

const activeId = ref<string>('')
const isHovered = ref(false)
const isMobileDrawerOpen = ref(false)
const isMobile = ref(false)

const SHOW_COUNT = 5

function useActiveHeading(items: TocItem[], setActiveId: (id: string) => void) {
  onMounted(() => {
    if (items.length === 0)
      return

    const READING_LINE_RATIO = 0.2
    const BOTTOM_THRESHOLD = 100

    const headingElements = items
      .map(item => ({
        id: item.id,
        element: document.getElementById(item.id),
      }))
      .filter((item): item is { id: string, element: HTMLElement } => item.element !== null)

    if (headingElements.length === 0)
      return

    setActiveId(headingElements[0].id)

    function getHeadingContentHeight(index: number): number {
      const currentElement = headingElements[index].element
      const nextElement = headingElements[index + 1]?.element

      if (!nextElement) {
        return document.documentElement.scrollHeight - currentElement.offsetTop
      }

      return nextElement.offsetTop - currentElement.offsetTop
    }

    function isNearPageBottom(): boolean {
      const scrollTop = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      return scrollTop + windowHeight >= documentHeight - BOTTOM_THRESHOLD
    }

    function updateActiveHeading() {
      const viewportHeight = window.innerHeight
      const readingLineY = viewportHeight * READING_LINE_RATIO
      const scrollTop = window.scrollY

      if (isNearPageBottom()) {
        const lastHeading = headingElements[headingElements.length - 1]
        setActiveId(lastHeading.id)
        return
      }

      if (scrollTop < headingElements[0].element.offsetTop - readingLineY) {
        setActiveId(headingElements[0].id)
        return
      }

      let bestCandidate = headingElements[0]
      let bestScore = -Infinity

      for (let i = 0; i < headingElements.length; i++) {
        const { element } = headingElements[i]
        const rect = element.getBoundingClientRect()
        const contentHeight = getHeadingContentHeight(i)

        let score = 0

        const distanceToReadingLine = Math.abs(rect.top - readingLineY)
        if (rect.top <= readingLineY && rect.top >= readingLineY - 100) {
          score += 1000 - distanceToReadingLine
        }
        else if (rect.top <= readingLineY) {
          score += 500 - distanceToReadingLine * 0.5
        }
        else {
          score += 200 - distanceToReadingLine
        }

        const contentTop = rect.top
        const contentBottom = rect.top + contentHeight
        const visibleTop = Math.max(contentTop, 0)
        const visibleBottom = Math.min(contentBottom, viewportHeight)
        const visibleHeight = Math.max(0, visibleBottom - visibleTop)
        const visibleRatio = visibleHeight / contentHeight

        score += visibleRatio * 300

        if (rect.top >= 0 && rect.top <= readingLineY * 2) {
          score += 400
        }

        if (score > bestScore) {
          bestScore = score
          bestCandidate = headingElements[i]
        }
      }

      setActiveId(bestCandidate.id)
    }

    const observer = new IntersectionObserver(
      () => {
        updateActiveHeading()
      },
      {
        rootMargin: '-20% 0px -20% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    headingElements.forEach(({ element }) => {
      observer.observe(element)
    })

    let ticking = false
    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveHeading()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    updateActiveHeading()

    onUnmounted(() => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
    })
  })
}

useActiveHeading(props.items, (id: string) => {
  activeId.value = id
})

function getVisibleHeadings() {
  if (isHovered.value || props.items.length <= SHOW_COUNT) {
    return props.items
  }

  const activeIndex = props.items.findIndex(h => h.id === activeId.value)
  if (activeIndex === -1) {
    return props.items.slice(0, SHOW_COUNT)
  }

  let startIndex = Math.max(0, activeIndex - 2)
  let endIndex = startIndex + SHOW_COUNT

  if (endIndex > props.items.length) {
    endIndex = props.items.length
    startIndex = Math.max(0, endIndex - SHOW_COUNT)
  }

  return props.items.slice(startIndex, endIndex)
}

function scrollToHeading(id: string) {
  const element = document.getElementById(id)
  if (!element)
    return

  const offset = 160
  const elementPosition = element.getBoundingClientRect().top + window.scrollY
  const offsetPosition = elementPosition - offset

  window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
  window.history.pushState(null, '', `#${id}`)
  closeMobileDrawer()
}

function checkMobile() {
  isMobile.value = window.innerWidth < 1280
}

function openMobileDrawer() {
  isMobileDrawerOpen.value = true
  document.body.style.overflow = 'hidden'
}

function closeMobileDrawer() {
  isMobileDrawerOpen.value = false
  document.body.style.overflow = ''
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    closeMobileDrawer()
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.body.style.overflow = ''
})

const visibleHeadings = computed(() => getVisibleHeadings())
</script>

<template>
  <div v-if="items.length > 0">
    <!-- PC 端 TOC -->
    <nav
      v-if="!isMobile"
      class="toc-desktop"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <div class="toc-title">
        目录
      </div>
      <ul class="toc-list">
        <li
          v-for="item in items"
          :key="item.id"
          class="toc-item"
          :class="{ 'is-h3': item.level === 3 }"
          :style="{
            maxHeight: visibleHeadings.some(h => h.id === item.id) ? '2rem' : '0',
            marginBottom: visibleHeadings.some(h => h.id === item.id) ? '0.25rem' : '0',
            opacity: visibleHeadings.some(h => h.id === item.id) ? 1 : 0,
          }"
        >
          <a
            :href="`#${item.id}`"
            class="toc-link"
            :class="{ 'is-active': item.id === activeId }"
            :title="item.text"
            @click.prevent="scrollToHeading(item.id)"
          >
            {{ item.text }}
          </a>
        </li>
      </ul>
    </nav>

    <!-- 移动端 -->
    <template v-else>
      <button
        class="toc-mobile-btn"
        @click="openMobileDrawer"
      >
        <div class="i-ri-menu-2-fill" />
      </button>

      <Teleport to="body">
        <Transition name="drawer">
          <div
            v-if="isMobileDrawerOpen"
            class="toc-mobile-overlay"
            @click="handleOverlayClick"
          >
            <div class="toc-mobile-drawer">
              <div class="toc-drawer-handle" @click="closeMobileDrawer">
                <div class="toc-drawer-handle-bar" />
              </div>
              <div class="toc-drawer-header">
                <span>目录</span>
                <button class="toc-drawer-close" @click="closeMobileDrawer">
                  <div class="i-ri-close-line" />
                </button>
              </div>
              <div class="toc-drawer-content">
                <ul class="toc-drawer-list">
                  <li
                    v-for="item in items"
                    :key="item.id"
                    class="toc-drawer-item"
                    :class="{ 'is-h3': item.level === 3 }"
                  >
                    <a
                      :href="`#${item.id}`"
                      class="toc-drawer-link"
                      :class="{ 'is-active': item.id === activeId }"
                      :title="item.text"
                      @click.prevent="scrollToHeading(item.id)"
                    >
                      {{ item.text }}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.toc-desktop {
  position: fixed;
  top: 50%;
  right: 16px;
  z-index: 200;
  width: 240px;
  max-height: 70vh;
  transform: translateY(-50%);
  overflow-y: auto;
  opacity: 0.48;
  transition: opacity 0.3s ease;
}

.toc-desktop:hover {
  opacity: 1;
}

.toc-title {
  margin-bottom: 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-light, #888);
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 14px;
}

.toc-item {
  overflow: hidden;
  transition: all 0.2s ease;
}

.toc-item.is-h3 {
  padding-left: 12px;
}

.toc-link {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  color: var(--fg-light, #888);
  text-decoration: none;
  transition: all 0.2s ease;
}

.toc-link.is-active {
  color: var(--fg-deeper);
  font-weight: 600;
  opacity: 1;
}

.toc-link:not(.is-active) {
  opacity: 0.5;
}

.toc-desktop:hover .toc-link:not(.is-active) {
  opacity: 0.7;
  color: var(--fg);
}

.toc-desktop:hover .toc-link:not(.is-active):hover {
  opacity: 1;
  color: var(--fg-deep);
}

.toc-mobile-btn {
  position: fixed;
  right: 16px;
  bottom: 40px;
  z-index: 300;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--c-bg);
  border: 1px solid rgba(128, 128, 128, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toc-mobile-btn:active {
  transform: scale(0.95);
}

.toc-mobile-btn:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.toc-mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 400;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
}

.toc-mobile-drawer {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 60vh;
  background: var(--c-bg);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.1);
}

.toc-drawer-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.toc-drawer-handle-bar {
  width: 48px;
  height: 4px;
  border-radius: 2px;
  background: rgba(128, 128, 128, 0.3);
}

.toc-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.toc-drawer-header span {
  font-size: 18px;
  font-weight: 500;
}

.toc-drawer-close {
  padding: 4px;
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--fg-light, #888);
  cursor: pointer;
  transition: color 0.2s ease;
}

.toc-drawer-close:hover {
  color: var(--fg, #555);
}

.toc-drawer-close:active {
  transform: scale(0.95);
}

.toc-drawer-content {
  height: calc(60vh - 96px);
  overflow-y: auto;
  padding: 16px 24px;
}

.toc-drawer-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-drawer-item + .toc-drawer-item {
  margin-top: 12px;
}

.toc-drawer-item.is-h3 {
  padding-left: 16px;
}

.toc-drawer-link {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg-light, #888);
  text-decoration: none;
  transition: color 0.2s ease;
}

.toc-drawer-link.is-active {
  color: var(--fg-deep, #222);
  font-weight: 500;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: all 0.3s ease;
}

.drawer-enter-active .toc-mobile-drawer,
.drawer-leave-active .toc-mobile-drawer {
  transition: transform 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  background: rgba(0, 0, 0, 0);
}

.drawer-enter-from .toc-mobile-drawer,
.drawer-leave-to .toc-mobile-drawer {
  transform: translateY(100%);
}

@media (min-width: 1280px) {
  .toc-mobile-btn,
  .toc-mobile-overlay {
    display: none;
  }
}

@media (max-width: 1279px) {
  .toc-desktop {
    display: none;
  }
}
</style>
