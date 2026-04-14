export type WorkerMessage =
  | { type: 'attach', canvas: OffscreenCanvas }
  | { type: 'detach' }
  | { type: 'resize', width: number, height: number }
  | { type: 'pause' }
  | { type: 'resume' }

export type WorkerRemoteMessage =
  | { type: 'ready' }
