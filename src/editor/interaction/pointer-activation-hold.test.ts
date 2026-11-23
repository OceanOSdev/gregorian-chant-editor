import { describe, expect, it } from 'vitest';
import {
  createPointerActivationHold,
  type PointerActivationHold,
} from './pointer-activation-hold';

interface Fields {
  button?: number;
  buttons?: number;
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
  const press = (fields: Fields = {}) =>
    fire('mousedown', { button: 0, buttons: 1, ...fields });
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
      fire('pointermove', { buttons: 0 });
      expect(hold.isHeld()).toBe(false);
    });

    it('a move without the primary button after a mouseup that brought no click', () => {
      const { hold, fire, press, release } = setup();
      press();
      release();
      expect(hold.isHeld()).toBe(true);
      fire('pointermove', { buttons: 0 });
      expect(hold.isHeld()).toBe(false);
    });

    it('a move holding only another button', () => {
      const { hold, fire, press } = setup();
      press();
      fire('pointermove', { buttons: 2 });
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

  it('ignores non-primary buttons', () => {
    const { hold, press } = setup();
    press({ button: 2, buttons: 2 });
    expect(hold.isHeld()).toBe(false);
    press({ button: 1, buttons: 4 });
    expect(hold.isHeld()).toBe(false);
  });

  it('a new mousedown settles the earlier press, and a stale click task cannot end the new one', () => {
    const { hold, fire, runTasks, press, release } = setup();
    press();
    const first = settledCount(hold);
    release();
    fire('click');
    press();
    expect(first()).toBe(1);
    expect(hold.isHeld()).toBe(true);
    const second = settledCount(hold);
    runTasks();
    expect(hold.isHeld()).toBe(true);
    expect(second()).toBe(0);
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
