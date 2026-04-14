import shaders from './shaders.wgsl?raw'

const PARTICLE_COUNT = 2500
const TARGET_FPS = 30
const FRAME_INTERVAL = 1000 / TARGET_FPS

const SIZEOF_F32 = Float32Array.BYTES_PER_ELEMENT
const SIZEOF_I32 = Uint32Array.BYTES_PER_ELEMENT

export class Renderer {
  private context: GPUCanvasContext
  private device: GPUDevice

  private renderPipeline: GPURenderPipeline
  private renderBindGroup: GPUBindGroup

  private computePipeline: GPUComputePipeline
  private computeBindGroup: GPUBindGroup

  private uniformBuffer: GPUBuffer
  private simulationContextBuffer: GPUBuffer
  private simulationContextLocalBuffer: ArrayBuffer

  private started = false
  private paused = false
  private lastFrameTime = 0
  private time = 0

  constructor(context: GPUCanvasContext, device: GPUDevice) {
    this.context = context
    this.device = device

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
    this.context.configure({
      device,
      format: presentationFormat,
      alphaMode: 'premultiplied',
    })

    const module = device.createShaderModule({
      code: shaders,
    })

    const renderBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform',
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'read-only-storage',
          },
        },
      ],
    })
    const renderPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [renderBindGroupLayout],
      }),
      vertex: {
        module,
        entryPoint: 'particleVertex',
      },
      fragment: {
        module,
        entryPoint: 'particleFragment',
        targets: [
          {
            format: presentationFormat,
            blend: {
              color: {
                operation: 'add',
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
              },
              alpha: {
                operation: 'add',
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-strip',
      },
    })
    this.renderPipeline = renderPipeline

    const computeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: 'uniform',
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: 'storage',
          },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: 'storage',
          },
        },
      ],
    })
    const computePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [computeBindGroupLayout],
      }),
      compute: {
        module,
        entryPoint: 'updateParticles',
      },
    })
    this.computePipeline = computePipeline

    const uniformBuffer = device.createBuffer({
      size: 2 * SIZEOF_F32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.uniformBuffer = uniformBuffer

    const particleObjectBuffer = device.createBuffer({
      size: PARTICLE_COUNT * (3 * 2 * SIZEOF_F32 + 3 * SIZEOF_F32 + SIZEOF_I32),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
    })

    const simulationContextBuffer = device.createBuffer({
      size: 3 * SIZEOF_F32 + SIZEOF_I32,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    this.simulationContextBuffer = simulationContextBuffer
    this.simulationContextLocalBuffer = new ArrayBuffer(
      simulationContextBuffer.size,
    )

    const renderBindGroup = device.createBindGroup({
      layout: renderBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: particleObjectBuffer,
          },
        },
      ],
    })
    this.renderBindGroup = renderBindGroup

    const computeBindGroup = device.createBindGroup({
      layout: computeBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: particleObjectBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: simulationContextBuffer,
          },
        },
      ],
    })
    this.computeBindGroup = computeBindGroup
  }

  start() {
    if (this.started) {
      return
    }

    this.resize()

    this.started = true
    this.paused = false
    this.lastFrameTime = performance.now()
    this.time = 0
    this.scheduleFrame()
  }

  stop() {
    this.started = false
    this.paused = false
  }

  pause() {
    this.paused = true
  }

  resume() {
    if (this.started && this.paused) {
      this.paused = false
      this.lastFrameTime = performance.now()
      this.scheduleFrame()
    }
  }

  resize() {
    const texture = this.context.getCurrentTexture()
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array([texture.width, texture.height]),
    )

    if (this.started && !this.paused) {
      this.renderFrame()
    }
  }

  private updateSimulationContext() {
    const now = performance.now()
    const timeDelta = Math.min(now - this.lastFrameTime, FRAME_INTERVAL * 2)
    this.lastFrameTime = now
    this.time += timeDelta

    const bufferView = new DataView(this.simulationContextLocalBuffer)
    bufferView.setFloat32(0, this.time, true)
    bufferView.setFloat32(4, timeDelta, true)
    bufferView.setFloat32(8, Math.random(), true)
    bufferView.setInt32(12, Math.floor(Math.random() * 20) + 10, true)
  }

  private scheduleFrame() {
    if (!this.started || this.paused)
      return

    const now = performance.now()
    const elapsed = now - this.lastFrameTime

    if (elapsed >= FRAME_INTERVAL) {
      requestAnimationFrame(() => {
        if (!this.started || this.paused)
          return
        this.renderFrame()
        this.scheduleFrame()
      })
    }
    else {
      const delay = Math.max(0, FRAME_INTERVAL - elapsed)
      setTimeout(() => {
        requestAnimationFrame(() => {
          if (!this.started || this.paused)
            return
          this.renderFrame()
          this.scheduleFrame()
        })
      }, delay)
    }
  }

  private renderFrame() {
    const device = this.device
    const commandQueue = device.queue
    const commandEncoder = device.createCommandEncoder()

    this.updateSimulationContext()
    commandQueue.writeBuffer(
      this.simulationContextBuffer,
      0,
      this.simulationContextLocalBuffer,
    )

    const computePassEncoder = commandEncoder.beginComputePass()
    computePassEncoder.setPipeline(this.computePipeline)
    computePassEncoder.setBindGroup(0, this.computeBindGroup)
    computePassEncoder.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / 64))
    computePassEncoder.end()

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    }
    const renderPassEncoder
      = commandEncoder.beginRenderPass(renderPassDescriptor)
    renderPassEncoder.setPipeline(this.renderPipeline)
    renderPassEncoder.setBindGroup(0, this.renderBindGroup)
    renderPassEncoder.draw(4, PARTICLE_COUNT, 0, 0)
    renderPassEncoder.end()

    commandQueue.submit([commandEncoder.finish()])
  }
}
