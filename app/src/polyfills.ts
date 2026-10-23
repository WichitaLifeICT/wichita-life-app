/**
 * Older iPhones (Safari before iOS 15.4) lack a few newer JavaScript functions that the app's
 * navigation library uses, and the app wouldn't open. These fill them in. Loaded first, from index.js.
 */

function define<T extends object>(target: T, name: string, value: unknown) {
  if (!(name in target)) Object.defineProperty(target, name, { value, writable: true, configurable: true });
}

define(Array.prototype, 'findLast', function <T>(this: T[], fn: (v: T, i: number, a: T[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn.call(thisArg, this[i], i, this)) return this[i];
  return undefined;
});

define(Array.prototype, 'findLastIndex', function <T>(this: T[], fn: (v: T, i: number, a: T[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn.call(thisArg, this[i], i, this)) return i;
  return -1;
});

function at<T>(this: ArrayLike<T>, index: number) {
  const i = Math.trunc(index) || 0;
  return this[i < 0 ? this.length + i : i];
}
define(Array.prototype, 'at', at);
define(String.prototype, 'at', at);

define(Object, 'hasOwn', (o: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(o, key));
