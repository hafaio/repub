export function* filter<T>(
  iter: Iterable<T>,
  cb: (elem: T, index: number) => boolean
): IterableIterator<T> {
  let i = 0;
  for (const elem of iter) {
    if (cb(elem, i++)) {
      yield elem;
    }
  }
}
