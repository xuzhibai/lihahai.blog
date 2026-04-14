<script setup lang="ts">
const el = ref<HTMLCanvasElement | null>(null)

const PARTICLE_COUNT = 400
const TARGET_FPS = 30
const FRAME_INTERVAL = 1000 / TARGET_FPS

const isDark = ref(false)

interface Snowflake {
  x: number
  y: number
  radius: number
  opacity: number
  speed: number
  drift: number
  wobble: number
  wobbleSpeed: number
}

let animationId: number | null = null
let lastFrameTime = 0
let isRunning = false
let snowflakes: Snowflake[] = []
let width = 0
let height = 0
let ctx: CanvasRenderingContext2D | null = null

function createSnowflake(y?: number): Snowflake {
  const isLarge = Math.random() > 0.9
  const baseRadius = isLarge ? 1.5 + Math.random() * 1 : 0.5 + Math.random() * 0.8
  return {
    x: Math.random() * width,
    y: y ?? Math.random() * height,
    radius: baseRadius,
    opacity: isLarge ? 0.6 + Math.random() * 0.3 : 0.2 + Math.random() * 0.3,
    speed: isLarge ? 1.2 + Math.random() * 0.8 : 0.4 + Math.random() * 0.6,
    drift: (Math.random() - 0.5) * 0.4,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.02 + Math.random() * 0.03,
  }
}

function initSnowflakes() {
  snowflakes = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    snowflakes.push(createSnowflake())
  }
}

function updateSnowflake(flake: Snowflake, deltaTime: number) {
  const timeScale = deltaTime / 16

  flake.wobble += flake.wobbleSpeed * timeScale
  const wobbleOffset = Math.sin(flake.wobble) * 0.5

  flake.y += flake.speed * timeScale
  flake.x += (flake.drift + wobbleOffset) * timeScale

  if (flake.y > height + flake.radius) {
    flake.y = -flake.radius
    flake.x = Math.random() * width
  }

  if (flake.x < -flake.radius) {
    flake.x = width + flake.radius
  }
  else if (flake.x > width + flake.radius) {
    flake.x = -flake.radius
  }
}

function drawSnowflake(flake: Snowflake) {
  if (!ctx)
    return

  const gradient = ctx.createRadialGradient(
    flake.x, flake.y, 0,
    flake.x, flake.y, flake.radius * 1.5,
  )

  if (isDark.value) {
    gradient.addColorStop(0, `rgba(255, 255, 255, ${flake.opacity})`)
    gradient.addColorStop(0.4, `rgba(255, 255, 255, ${flake.opacity * 0.6})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  }
  else {
    gradient.addColorStop(0, `rgba(100, 100, 120, ${flake.opacity * 0.7})`)
    gradient.addColorStop(0.4, `rgba(100, 100, 120, ${flake.opacity * 0.4})`)
    gradient.addColorStop(1, 'rgba(100, 100, 120, 0)')
  }

  ctx.beginPath()
  ctx.arc(flake.x, flake.y, flake.radius * 1.5, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
}

function render(timestamp: number) {
  if (!isRunning || !ctx)
    return

  const deltaTime = timestamp - lastFrameTime

  if (deltaTime >= FRAME_INTERVAL) {
    lastFrameTime = timestamp - (deltaTime % FRAME_INTERVAL)

    ctx.clearRect(0, 0, width, height)

    for (const flake of snowflakes) {
      updateSnowflake(flake, deltaTime)
      drawSnowflake(flake)
    }
  }

  animationId = requestAnimationFrame(render)
}

function start() {
  if (isRunning)
    return
  isRunning = true
  lastFrameTime = performance.now()
  animationId = requestAnimationFrame(render)
}

function stop() {
  isRunning = false
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

function handleResize() {
  if (!el.value)
    return

  const canvas = el.value
  const dpr = Math.min(window.devicePixelRatio, 1.5)

  width = window.innerWidth
  height = window.innerHeight

  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.width = width * dpr
  canvas.height = height * dpr

  if (ctx) {
    ctx.scale(dpr, dpr)
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stop()
  }
  else {
    start()
  }
}

function updateDarkMode() {
  isDark.value = document.documentElement.classList.contains('dark')
}

onMounted(() => {
  if (!el.value)
    return

  ctx = el.value.getContext('2d')
  if (!ctx)
    return

  updateDarkMode()
  handleResize()
  initSnowflakes()
  start()

  window.addEventListener('resize', handleResize)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  const observer = new MutationObserver(updateDarkMode)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  stop()
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <canvas
    ref="el"
    class="fixed top-0 left-0 right-0 bottom-0 pointer-events-none print:hidden"
    style="z-index: -1"
  />
</template>
