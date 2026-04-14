<script setup lang="ts">
import type { WorkerMessage, WorkerRemoteMessage } from './ArtSakura/worker/messages'
import RenderWorker from './ArtSakura/worker?worker'

const route = useRoute()
const isHome = computed(() => route.path === '/')

const containerRef = ref<HTMLDivElement>()
const readyWorker = ref<Worker>()
const cleanupFns = ref<(() => void)[]>([])

watch(isHome, (home) => {
  if (!home && readyWorker.value) {
    cleanupFns.value.forEach(fn => fn())
    cleanupFns.value = []
    readyWorker.value = undefined
  }
})

onMounted(() => {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return
  }

  if (!isHome.value) {
    return
  }

  initWorker()
})

function initWorker() {
  if (readyWorker.value)
    return

  const worker = new RenderWorker()
  worker.addEventListener('message', (event) => {
    const msg = event.data as WorkerRemoteMessage
    if (msg.type === 'ready') {
      readyWorker.value = worker
    }
  })

  cleanupFns.value.push(() => {
    worker.terminate()
  })
}

watch([readyWorker, containerRef], ([worker, container]) => {
  if (!worker || !container)
    return

  const canvas = document.createElement('canvas')
  canvas.style.width = '100%'
  canvas.style.height = '100%'

  const offscreenCanvas = canvas.transferControlToOffscreen()
  worker.postMessage(
    { type: 'attach', canvas: offscreenCanvas } satisfies WorkerMessage,
    [offscreenCanvas],
  )

  container.appendChild(canvas)

  const resizeObserver = new ResizeObserver(() => {
    const scaleFactor = 1
    const width = canvas.clientWidth * scaleFactor
    const height = canvas.clientHeight * scaleFactor
    worker.postMessage({
      type: 'resize',
      width,
      height,
    } satisfies WorkerMessage)
  })
  resizeObserver.observe(canvas)

  const handleVisibilityChange = () => {
    if (document.hidden) {
      worker.postMessage({ type: 'pause' } satisfies WorkerMessage)
    }
    else {
      worker.postMessage({ type: 'resume' } satisfies WorkerMessage)
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  cleanupFns.value.push(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    resizeObserver.disconnect()
    canvas.remove()
    worker.postMessage({ type: 'detach' } satisfies WorkerMessage)
  })
}, { immediate: true })

watch(isHome, (home) => {
  if (home && !readyWorker.value) {
    initWorker()
  }
})

onUnmounted(() => {
  cleanupFns.value.forEach(fn => fn())
})
</script>

<template>
  <div
    v-if="isHome && readyWorker"
    ref="containerRef"
    class="sakura-board"
  />
</template>

<style scoped>
.sakura-board {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: -1;
}
</style>
