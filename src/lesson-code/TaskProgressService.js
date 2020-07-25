import { Observable, merge, Subject, timer } from "rxjs";
import {
  mapTo,
  scan,
  startWith,
  distinctUntilChanged,
  shareReplay,
  pairwise,
  filter,
  switchMap,
  takeUntil
} from "rxjs/operators";
import { initLoadingSpinner } from "../services/LoadingSpinnerService";

const taskStarts = new Subject();
const taskCompletions = new Subject();

const showSpinner = new Observable(() => {
    const loadingSpinnerPromise = initLoadingSpinner();

    loadingSpinnerPromise.then(spinner => {
      spinner.show();
    });

    return () => {
      loadingSpinnerPromise.then(spinner => {
        spinner.hide();
      });
    };
});

export function newTaskStarted() {
  taskStarts.next();
}

export function existingTaskCompleted() {
  taskCompletions.next();
}

const loadUp = taskStarts.pipe(mapTo(1));
const loadDown = taskCompletions.pipe(mapTo(-1));

// xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx //

const loadVariations = merge(loadUp, loadDown);

const currentLoadCount = loadVariations.pipe(
  startWith(0),
  scan((totalCurrentLoads, changeInLoads) => {
    const newLoadCount = totalCurrentLoads + changeInLoads;
    return newLoadCount < 0 ? 0 : newLoadCount;
  }),
  distinctUntilChanged(),
  shareReplay({ bufferSize: 1, refCount: true })
);

// xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx //

const spinnerDeactivated = currentLoadCount.pipe(filter(count => count === 0));

const spinnerActivated = currentLoadCount.pipe(
  pairwise(),
  filter(([prevCount, currCount]) => prevCount === 0 && currCount === 1)
);

// xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx //

/*
  The moment the spinner becomes active
    Switch to waiting for 2s before showing it
    But cancel if it becomes inactive again in the meantime
*/

const shouldShowSpinner = spinnerActivated.pipe(
  switchMap(() => timer(2000).pipe(takeUntil(spinnerDeactivated)))
);

// xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx //

shouldShowSpinner
  .pipe(switchMap(() => showSpinner.pipe(takeUntil(spinnerDeactivated))))
  .subscribe();

export default {};
