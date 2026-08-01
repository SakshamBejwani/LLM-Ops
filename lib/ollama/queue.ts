// Serializes generation calls to Ollama. The GTX 1650 (4GB VRAM) this app
// targets realistically can't hold more than one model's context comfortably,
// so requests beyond MAX_CONCURRENT_OLLAMA_REQUESTS queue instead of racing.
class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(capacity: number) {
    this.available = capacity;
  }

  get isFree() {
    return this.available > 0;
  }

  get queueLength() {
    return this.waiters.length;
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available--;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.available--;
    return () => this.release();
  }

  private release() {
    this.available++;
    const next = this.waiters.shift();
    if (next) next();
  }
}

declare global {
  var __ollamaSemaphore: Semaphore | undefined;
}

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_OLLAMA_REQUESTS ?? 1);

export const ollamaSemaphore = globalThis.__ollamaSemaphore ?? new Semaphore(MAX_CONCURRENT);
globalThis.__ollamaSemaphore = ollamaSemaphore;
