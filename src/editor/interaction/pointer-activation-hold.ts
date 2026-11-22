/**
 * Press-activation hold: the span from a primary pointer press until the
 * activation (click) that press can produce has been dispatched.
 *
 * A press moves focus at `mousedown`, before release. Anything derived from
 * that focus that changes layout or scroll while the pointer is still down
 * moves the pressed control, so the release lands elsewhere and the click
 * goes to a common ancestor (issue #121, PR #107). Consumers therefore defer
 * focus-derived presentation with `afterSettle` and skip reveals of
 * press-given focus with `isPressGivenFocus`. Focus itself still moves.
 *
 * Settling is ordered by events, never by an assumed delay:
 * - after `click`: in a task queued from inside the click dispatch, which the
 *   event loop runs once that dispatch (including handlers that stop
 *   propagation, and React's synchronous commit) has finished;
 * - at once when no activation can follow: `pointercancel`, `contextmenu`,
 *   `keydown`, window `blur`, a new primary press, or a hover move (no
 *   buttons) of the same mouse or pen pointer after its release.
 *
 * `pointerup` alone never settles: Chromium touch focus and click arrive
 * after it. Every input that could start keyboard, programmatic or new
 * pointer focus settles first, so no hold outlives its press.
 */

type Listener = (event: Event) => void;

/** The subset of `Window` the hold listens to; a plain `EventTarget` in tests. */
export type HoldEventSource = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

interface PointerFields {
  isPrimary?: boolean;
  button?: number;
  buttons?: number;
  pointerId?: number;
  pointerType?: string;
}

interface Press {
  pressed: EventTarget | null;
  pointerId: number | undefined;
  pointerType: string | undefined;
  released: boolean;
}

export interface PointerActivationHold {
  /** True while a primary press's activation has not been dispatched yet. */
  isHeld(): boolean;
  /** The target of the held press, or null. */
  pressedTarget(): EventTarget | null;
  /** Runs `callback` once when the hold settles, or now if nothing is held. */
  afterSettle(callback: () => void): void;
  /** Starts listening on `source`; returns the matching disconnect. */
  connect(source: HoldEventSource): () => void;
}

const pointerFields = (event: Event) => event as Event & PointerFields;

export function createPointerActivationHold(
  queueTask: (task: () => void) => void = (task) => {
    setTimeout(task, 0);
  },
): PointerActivationHold {
  let press: Press | null = null;
  const waiting = new Set<() => void>();

  function settle() {
    if (!press) return;
    press = null;
    const callbacks = [...waiting];
    waiting.clear();
    for (const callback of callbacks) callback();
  }

  const onPointerDown: Listener = (event) => {
    const pointer = pointerFields(event);
    // A new press first settles any earlier one, primary or not.
    settle();
    if (pointer.isPrimary === false || pointer.button !== 0) return;
    press = {
      pressed: event.composedPath?.()[0] ?? event.target,
      pointerId: pointer.pointerId,
      pointerType: pointer.pointerType,
      released: false,
    };
  };
  const onPointerUp: Listener = (event) => {
    if (press && pointerFields(event).pointerId === press.pointerId)
      press.released = true;
  };
  const onPointerMove: Listener = (event) => {
    const pointer = pointerFields(event);
    if (
      press?.released &&
      press.pointerType !== 'touch' &&
      pointer.pointerId === press.pointerId &&
      pointer.buttons === 0
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
        ['pointerup', onPointerUp, true],
        ['pointermove', onPointerMove, true],
        ['click', onClick, true],
        ['pointercancel', onSettleNow, true],
        ['contextmenu', onSettleNow, true],
        ['keydown', onSettleNow, true],
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
