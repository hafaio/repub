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
  #queue: (() => void)[] = [];
  #locked: boolean = false;

  async acquire(): Promise<void> {
    if (this.#locked) {
      return await new Promise<void>((resolve) => this.#queue.push(resolve));
    } else {
      this.#locked = true;
    }
  }

  release(): void {
    const next = this.#queue.pop();
    if (next) {
      next();
    } else {
      this.#locked = false;
    }
  }
}

export function lock(): Lock {
  return new AsyncLock();
}
