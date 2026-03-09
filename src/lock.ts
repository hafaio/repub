/**
 * Simple async lock for upload
 *
 * @packageDocumentation
 */

interface Lock {
  acquire(): Promise<void>;
  release(): void;
}

class AsyncLock implements Lock {
  #queue: Record<number, () => void> = {};
  #next: number = 0;
  #last: number = 0;
  #locked: boolean = false;

  async acquire(): Promise<void> {
    if (this.#locked) {
      await new Promise<void>((resolve) => {
        this.#queue[this.#last++] = resolve;
      });
    } else {
      this.#locked = true;
    }
  }

  release(): void {
    if (this.#next !== this.#last) {
      const next = this.#queue[this.#next]!;
      delete this.#queue[this.#next++];
      next();
    } else {
      this.#locked = false;
    }
  }
}

export function lock(): Lock {
  return new AsyncLock();
}
