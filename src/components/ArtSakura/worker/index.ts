import type { WorkerMessage, WorkerRemoteMessage } from './messages'
import { Renderer } from '../renderer'

let renderer: Renderer | null = null
let device: GPUDevice | null = null

async function initGPU() {
  if (!navigator.gpu) {
    console.warn('WebGPU not supported')
    return false
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    console.warn('No GPU adapter found')
    return false
  }

  device = await adapter.requestDevice()
  return true
}

initGPU().then((success) => {
  if (success) {
    self.postMessage({ type: 'ready' } satisfies WorkerRemoteMessage)
  }
})

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data

  if (msg.type === 'attach') {
    if (!device) {
      return
    }

    const context = msg.canvas.getContext('webgpu')
    if (!context) {
      console.warn('Failed to get WebGPU context')
      return
    }

    renderer = new Renderer(context, device!)
    renderer.start()
  }
  else if (msg.type === 'detach') {
    if (renderer) {
      renderer.stop()
      renderer = null
    }
  }
  else if (msg.type === 'resize') {
    if (renderer) {
      renderer.resize()
    }
  }
  else if (msg.type === 'pause') {
    if (renderer) {
      renderer.pause()
    }
  }
  else if (msg.type === 'resume') {
    if (renderer) {
      renderer.resume()
    }
  }
}
