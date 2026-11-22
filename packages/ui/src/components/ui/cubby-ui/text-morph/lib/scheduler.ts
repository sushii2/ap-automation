export type MorphSteps = Generator<void, Animation[], void>;

export type MorphJob = {
  root: HTMLElement;
  steps: MorphSteps;
  done: (started: Animation[]) => void;
};

const queue: MorphJob[] = [];

function flushMorphs(): void {
  let active = queue.splice(0);
  while (active.length > 0) {
    active = active.filter((job) => {
      let step: IteratorResult<void, Animation[]>;
      try {
        step = job.steps.next();
      } catch (error) {
        // One label failing mustn't strand the rest of its batch mid-change.
        reportError(error);
        job.done([]);
        return false;
      }
      if (!step.done) return true;
      job.done(step.value);
      return false;
    });
  }
}

/** Run a change with the others from this update, before the next paint. */
export function scheduleMorph(job: MorphJob): void {
  // A second change to the same label before the batch runs goes after it.
  if (queue.some((queued) => queued.root === job.root)) flushMorphs();
  queue.push(job);
  if (queue.length === 1) queueMicrotask(flushMorphs);
}
