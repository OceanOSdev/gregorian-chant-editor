/**
 * Press-activation hold: from the primary `mousedown` whose default action
 * moves focus, until the click that press can produce has been dispatched or
 * can no longer happen.
 *
 * Anything derived from that focus that changes layout or scroll before the
 * click moves the pressed control, so the release lands elsewhere and the
 * click goes to a common ancestor (issue #121, PR #107). Consumers defer
 * focus-derived presentation with `afterSettle` and skip reveals of
 * press-given focus with `isPressGivenFocus`. Focus itself still moves.
 *
 * Why `mousedown`: it is the event whose default action moves focus, for
 * mouse, pen and touch alike. For touch it is the compatibility `mousedown`
 * that follows the touch `pointerup` within the tap, so the hold cannot race
 * touch compatibility events. A press whose `pointerdown` was prevented
 * (dismissal-only presses) fires no `mousedown` and moves no focus.
 *
 * Settling, and what is guaranteed:
 * - After `click`: in a task queued from inside the click dispatch. The event
 *   loop guarantees only that it runs after that dispatch has finished (every
 *   listener, whether or not one stopped propagation) and after the following
 *   microtask checkpoint. React committing first is not assumed: settling
 *   derives presentation from the live `document.activeElement`, React
 *   applies state updates in order, and focus moved later by a committed
 *   focus request is applied directly because the hold has ended.
 * - At once when no click can follow: a `pointermove` from the press's own
 *   pointer without the primary button held (the release was not delivered,
 *   for example outside the window, or `mouseup` brought no click),
 *   `pointercancel`, `dragstart`, `contextmenu`, the window's own `blur`, or
 *   a non-primary `mousedown`. Moves of other pointers (a hovering pen while
 *   the mouse is held) never settle it.
 * - A new primary `mousedown` supersedes an unresolved hold without running
 *   its callbacks: they would change layout inside the new press (a fast
 *   double-click can arrive before the first click's task). They carry over
 *   to the new hold and run when it settles, reading the focus of that time.
 * - `keydown` settles only after `mouseup`. While the button is still down
 *   the press can still produce a click, so a key press does not end it.
 */

type Listener = (event: Event) => void;

/** The subset of `Window` the hold listens to; a plain `EventTarget` in tests. */
export type HoldEventSource = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

interface Press {
  pressed: EventTarget | null;
  /** The primary `pointerdown` that produced this press, when one was seen. */
  pointerId: number | undefined;
  released: boolean;
}

export interface PointerActivationHold {
  /** True while a primary press's activation is pending. */
  isHeld(): boolean;
  /** The target of the held press, or null. */
  pressedTarget(): EventTarget | null;
  /** Runs `callback` once when the hold settles, or now if nothing is held. */
  afterSettle(callback: () => void): void;
  /** Starts listening on `source`; returns the matching disconnect. */
  connect(source: HoldEventSource): () => void;
}

type PointerFields = Event & {
  button?: number;
  buttons?: number;
  pointerId?: number;
  isPrimary?: boolean;
};
const button = (event: Event) => (event as PointerFields).button;
const pointerId = (event: Event) => (event as PointerFields).pointerId;
const primaryHeld = (event: Event) =>
  (((event as Event & { buttons?: number }).buttons ?? 0) & 1) === 1;

export function createPointerActivationHold(
  queueTask: (task: () => void) => void = (task) => {
    setTimeout(task, 0);
  },
): PointerActivationHold {
  let press: Press | null = null;
  // The pointer whose primary `pointerdown` precedes its compatibility
  // `mousedown` (for touch, the `pointerup` comes in between).
  let lastPrimaryPointer: number | undefined;
  const waiting = new Set<() => void>();

  function settle() {
    if (!press) return;
    press = null;
    const callbacks = [...waiting];
    waiting.clear();
    for (const callback of callbacks) callback();
  }

  const onPointerDown: Listener = (event) => {
    if ((event as PointerFields).isPrimary !== false && button(event) === 0)
      lastPrimaryPointer = pointerId(event);
  };
  const onMouseDown: Listener = (event) => {
    if (button(event) !== 0) {
      settle();
      return;
    }
    // Supersede any unresolved press; `waiting` carries over unchanged.
    press = {
      pressed: event.composedPath?.()[0] ?? event.target,
      pointerId: lastPrimaryPointer,
      released: false,
    };
    lastPrimaryPointer = undefined;
  };
  const onMouseUp: Listener = (event) => {
    if (press && button(event) === 0) press.released = true;
  };
  const onPointerMove: Listener = (event) => {
    if (
      press &&
      !primaryHeld(event) &&
      (press.pointerId === undefined || pointerId(event) === press.pointerId)
    )
      settle();
  };
  const onClick: Listener = () => {
    const held = press;
    if (!held) return;
    // Only this press may be settled by its click's task.
    queueTask(() => {
      if (press === held) settle();
    });
  };
  const onKeyDown: Listener = () => {
    if (press?.released) settle();
  };
  const onSettleNow: Listener = () => settle();

  return {
    isHeld: () => press !== null,
    pressedTarget: () => press?.pressed ?? null,
    afterSettle(callback) {
      if (press) waiting.add(callback);
      else callback();
    },
    connect(source) {
      const onBlur: Listener = (event) => {
        // Element blur events reach a window capture listener; only the
        // window's own blur (focus left the page) ends a press.
        if (event.target === source) settle();
      };
      const listeners: [string, Listener, boolean][] = [
        ['pointerdown', onPointerDown, true],
        ['mousedown', onMouseDown, true],
        ['mouseup', onMouseUp, true],
        ['pointermove', onPointerMove, true],
        ['click', onClick, true],
        ['keydown', onKeyDown, true],
        ['pointercancel', onSettleNow, true],
        ['dragstart', onSettleNow, true],
        ['contextmenu', onSettleNow, true],
        ['blur', onBlur, false],
      ];
      // Options objects (not booleans): Node's EventTarget, used in tests,
      // only matches capture removal by options object.
      for (const [type, listener, capture] of listeners)
        source.addEventListener(type, listener, { capture });
      return () => {
        for (const [type, listener, capture] of listeners)
          source.removeEventListener(type, listener, { capture });
        press = null;
        waiting.clear();
      };
    },
  };
}

/** Whether focus on `element` was given by the held press (it contains the pressed node). */
export function isPressGivenFocus(
  hold: PointerActivationHold,
  element: Element,
): boolean {
  const pressed = hold.pressedTarget();
  return typeof Node !== 'undefined' && pressed instanceof Node
    ? element.contains(pressed)
    : false;
}
