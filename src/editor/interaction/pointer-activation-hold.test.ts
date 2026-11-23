import { describe, expect, it } from 'vitest';
import {
  createPointerActivationHold,
  type PointerActivationHold,
} from './pointer-activation-hold';

interface Fields {
  button?: number;
  buttons?: number;
  pointerId?: number;
  pointerType?: string;
  isPrimary?: boolean;
}

function setup() {
  const source = new EventTarget();
  const tasks: (() => void)[] = [];
  const hold = createPointerActivationHold((task) => tasks.push(task));
  const disconnect = hold.connect(source);
  const fire = (type: string, fields: Fields = {}) =>
    source.dispatchEvent(Object.assign(new Event(type), fields));
  const runTasks = () => {
    while (tasks.length) tasks.shift()?.();
  };
  // A mouse press: primary pointerdown, then its mousedown.
  const press = (fields: Fields = {}) => {
    fire('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: 1,
      ...fields,
    });
    fire('mousedown', { button: 0, buttons: 1, ...fields });
  };
  const release = () => fire('mouseup', { button: 0, buttons: 0 });
  return { source, hold, tasks, fire, runTasks, press, release, disconnect };
}

function settledCount(hold: PointerActivationHold) {
  let count = 0;
  hold.afterSettle(() => count++);
  return () => count;
}

describe('pointer activation hold', () => {
  it('runs afterSettle at once when nothing is held', () => {
    const { hold } = setup();
    expect(hold.isHeld()).toBe(false);
    expect(settledCount(hold)()).toBe(1);
  });

  it('holds from a primary mousedown through mouseup and settles only in the task queued by the click', () => {
    const { hold, fire, runTasks, press, release, source, tasks } = setup();
    press();
    expect(hold.isHeld()).toBe(true);
    expect(hold.pressedTarget()).toBe(source);
    const count = settledCount(hold);

    // Moves with the button held never settle.
    fire('pointermove', { buttons: 1 });
    release();
    expect(hold.isHeld()).toBe(true);
    fire('click');
    // Click listeners are still running: nothing has settled.
    expect(hold.isHeld()).toBe(true);
    expect(count()).toBe(0);
    expect(tasks).toHaveLength(1);

    runTasks();
    expect(hold.isHeld()).toBe(false);
    expect(hold.pressedTarget()).toBeNull();
    expect(count()).toBe(1);
  });

  it('does not start on pointerdown, so a touch hold begins at the compatibility mousedown', () => {
    const { hold, fire, runTasks, press, release } = setup();
    fire('pointerdown', { button: 0, buttons: 1 });
    fire('pointerup', { button: 0, buttons: 0 });
    expect(hold.isHeld()).toBe(false);
    // Compatibility mouse events and the click follow within the tap.
    press();
    release();
    fire('click');
    expect(hold.isHeld()).toBe(true);
    runTasks();
    expect(hold.isHeld()).toBe(false);
  });

  describe('a press that cannot produce a click settles at once', () => {
    it.each(['pointercancel', 'dragstart', 'contextmenu'])('%s', (type) => {
      const { hold, fire, press } = setup();
      press();
      const count = settledCount(hold);
      fire(type);
      expect(hold.isHeld()).toBe(false);
      expect(count()).toBe(1);
    });

    it('a move without the primary button and no mouseup (release outside the window)', () => {
      const { hold, fire, press } = setup();
      press();
      fire('pointermove', { pointerId: 1, buttons: 0 });
      expect(hold.isHeld()).toBe(false);
    });

    it('a move without the primary button after a mouseup that brought no click', () => {
      const { hold, fire, press, release } = setup();
      press();
      release();
      expect(hold.isHeld()).toBe(true);
      fire('pointermove', { pointerId: 1, buttons: 0 });
      expect(hold.isHeld()).toBe(false);
    });

    it('a move holding only another button', () => {
      const { hold, fire, press } = setup();
      press();
      fire('pointermove', { pointerId: 1, buttons: 2 });
      expect(hold.isHeld()).toBe(false);
    });

    it('the window’s own blur, but not element blur events', () => {
      const { hold, press, source } = setup();
      press();
      const elementBlur = Object.defineProperty(new Event('blur'), 'target', {
        value: new EventTarget(),
      });
      source.dispatchEvent(elementBlur);
      expect(hold.isHeld()).toBe(true);
      source.dispatchEvent(new Event('blur'));
      expect(hold.isHeld()).toBe(false);
    });
  });

  it('keydown while the button is down keeps the hold; the click can still come', () => {
    const { hold, fire, runTasks, press, release } = setup();
    press();
    fire('keydown');
    expect(hold.isHeld()).toBe(true);
    release();
    fire('click');
    runTasks();
    expect(hold.isHeld()).toBe(false);
  });

  it('keydown after a mouseup with no click settles before the key acts', () => {
    const { hold, fire, press, release } = setup();
    press();
    release();
    fire('keydown');
    expect(hold.isHeld()).toBe(false);
  });

  it('ignores non-primary buttons, which settle an unresolved press', () => {
    const { hold, press } = setup();
    press({ button: 2, buttons: 2 });
    expect(hold.isHeld()).toBe(false);
    press({ button: 1, buttons: 4 });
    expect(hold.isHeld()).toBe(false);
    press();
    const count = settledCount(hold);
    press({ button: 2, buttons: 2 });
    expect(hold.isHeld()).toBe(false);
    expect(count()).toBe(1);
  });

  it('a new primary mousedown supersedes an unresolved press without running its callbacks, which carry over', () => {
    const { hold, fire, runTasks, press, release } = setup();
    // A fast double-click: the second press arrives before the first
    // click's task has run.
    press();
    const deferred = settledCount(hold);
    release();
    fire('click');
    press();
    expect(hold.isHeld()).toBe(true);
    expect(deferred()).toBe(0);
    // The first click's stale task cannot end the second press.
    runTasks();
    expect(hold.isHeld()).toBe(true);
    expect(deferred()).toBe(0);
    release();
    fire('click');
    runTasks();
    expect(hold.isHeld()).toBe(false);
    expect(deferred()).toBe(1);
  });

  it('a superseded press without any click also carries its callbacks', () => {
    const { hold, fire, press, release } = setup();
    press();
    const deferred = settledCount(hold);
    release();
    press();
    expect(deferred()).toBe(0);
    fire('pointercancel');
    expect(deferred()).toBe(1);
  });

  describe('pointer identity', () => {
    it('another pointer’s buttonless move does not settle the press', () => {
      const { hold, fire, press } = setup();
      press({ pointerId: 1 });
      // A hovering pen while the mouse button is held.
      fire('pointermove', { pointerId: 2, pointerType: 'pen', buttons: 0 });
      expect(hold.isHeld()).toBe(true);
      fire('pointermove', { pointerId: 1, buttons: 0 });
      expect(hold.isHeld()).toBe(false);
    });

    it('a touch hold belongs to the touch pointer, not a hovering mouse', () => {
      const { hold, fire } = setup();
      fire('pointerdown', {
        pointerId: 7,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: 1,
      });
      fire('pointerup', { pointerId: 7, button: 0, buttons: 0 });
      fire('mousedown', { button: 0, buttons: 1 });
      fire('pointermove', { pointerId: 1, pointerType: 'mouse', buttons: 0 });
      expect(hold.isHeld()).toBe(true);
    });

    it('a non-primary pointerdown does not claim the press', () => {
      const { hold, fire } = setup();
      fire('pointerdown', { pointerId: 1, isPrimary: true, button: 0 });
      fire('pointerdown', { pointerId: 9, isPrimary: false, button: 0 });
      fire('mousedown', { button: 0, buttons: 1 });
      fire('pointermove', { pointerId: 9, buttons: 0 });
      expect(hold.isHeld()).toBe(true);
      fire('pointermove', { pointerId: 1, buttons: 0 });
      expect(hold.isHeld()).toBe(false);
    });

    it('without a recorded pointer (no pointerdown), any buttonless move settles', () => {
      const { hold, fire } = setup();
      fire('mousedown', { button: 0, buttons: 1 });
      fire('pointermove', { pointerId: 5, buttons: 0 });
      expect(hold.isHeld()).toBe(false);
    });
  });

  it('ignores clicks without a held press (keyboard activation)', () => {
    const { hold, fire, tasks } = setup();
    fire('click');
    expect(tasks).toHaveLength(0);
    expect(hold.isHeld()).toBe(false);
  });

  it('notifies each waiting callback once', () => {
    const { hold, fire, runTasks, press, release } = setup();
    press();
    let calls = 0;
    const callback = () => calls++;
    hold.afterSettle(callback);
    hold.afterSettle(callback);
    release();
    fire('click');
    runTasks();
    fire('keydown');
    expect(calls).toBe(1);
  });

  it('stops listening and drops a press on disconnect', () => {
    const { hold, press, disconnect } = setup();
    press();
    disconnect();
    expect(hold.isHeld()).toBe(false);
    press();
    expect(hold.isHeld()).toBe(false);
  });
});
