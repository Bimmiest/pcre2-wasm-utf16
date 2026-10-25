// The garbage collector on demand, for the tests that watch the finalizer.
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

setFlagsFromString('--expose-gc');
const gc = runInNewContext('gc') as () => void;

/** Collects five times, and yields to the event loop after each one, so that the finalizers run. */
export async function collect(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    gc();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
