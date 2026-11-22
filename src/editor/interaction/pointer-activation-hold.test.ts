import { describe, expect, it } from 'vitest';
import {
  createPointerActivationHold,
  type PointerActivationHold,
} from './pointer-activation-hold';

interface Fields {
  isPrimary?: boolean;
  button?: number;
  buttons?: number;
  pointerId?: number;
  pointerType?: string;
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
  const mouse = { pointerId: 1, pointerType: 'mouse', isPrimary: true };
  const press = (fields: Fields = mouse) =>
    fire('pointerdown', { button: 0, buttons: 1, ...fields });
  return { source, hold, tasks, fire, runTasks, press, mouse, disconnect };
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
    const count = settledCount(hold);
    expect(count()).toBe(1);
  });

  it('holds from a primary press through pointerup and settles only after the click task', () => {
    const { hold, fire, runTasks, press, mouse, source, tasks } = setup();
    press();
    expect(hold.isHeld()).toBe(true);
    expect(hold.pressedTarget()).toBe(source);
    const count = settledCount(hold);

    fire('pointerup', { ...mouse, buttons: 0 });
    expect(hold.isHeld()).toBe(true);
    fire('click');
    // Click handlers are still running: nothing has settled yet.
    expect(hold.isHeld()).toBe(true);
    expect(count()).toBe(0);
    expect(tasks).toHaveLength(1);

    runTasks();
    expect(hold.isHeld()).toBe(false);
    expect(hold.pressedTarget()).toBeNull();
    expect(count()).toBe(1);
  });

  it('keeps holding after a touch pointerup until the later compatibility click', () => {
    const { hold, fire, runTasks, press } = setup();
    const touch = { pointerId: 7, pointerType: 'touch', isPrimary: true };
    press(touch);
    fire('pointerup', { ...touch, buttons: 0 });
    // Touch never hovers; a stray hover-like move must not settle.
    fire('pointermove', { ...touch, buttons: 0 });
    expect(hold.isHeld()).toBe(true);
    fire('click');
    runTasks();
    expect(hold.isHeld()).toBe(false);
  });

  it.each(['pointercancel', 'contextmenu', 'keydown'])(
    'settles at once on %s',
    (type) => {
      const { hold, fire, press } = setup();
      press();
      const count = settledCount(hold);
      fire(type);
      expect(hold.isHeld()).toBe(false);
      expect(count()).toBe(1);
    },
  );

  it('settles on the window’s own blur but not on element blur events', () => {
    const { hold, press, source } = setup();
    press();
    // An element's blur reaching a window capture listener has the element
    // as its target.
    const element = new EventTarget();
    const elementBlur = Object.defineProperty(new Event('blur'), 'target', {
      value: element,
    });
    source.dispatchEvent(elementBlur);
    expect(hold.isHeld()).toBe(true);
    source.dispatchEvent(new Event('blur'));
    expect(hold.isHeld()).toBe(false);
  });

  it('settles on a hover move of the same mouse pointer after a release with no click', () => {
    const { hold, fire, press, mouse } = setup();
    press();
    // While pressed, moves (buttons held) never settle.
    fire('pointermove', { ...mouse, buttons: 1 });
    // Another pointer's hover does not settle this press.
    fire('pointermove', { ...mouse, pointerId: 2, buttons: 0 });
    expect(hold.isHeld()).toBe(true);
    fire('pointerup', { ...mouse, buttons: 0 });
    fire('pointermove', { ...mouse, buttons: 0 });
    expect(hold.isHeld()).toBe(false);
  });

  it('does not settle on a hover move before the release', () => {
    const { hold, fire, press, mouse } = setup();
    press();
    fire('pointermove', { ...mouse, buttons: 0 });
    expect(hold.isHeld()).toBe(true);
  });

  it('ignores secondary buttons and non-primary pointers', () => {
    const { hold, press, mouse } = setup();
    press({ ...mouse, button: 2 });
    expect(hold.isHeld()).toBe(false);
    press({ ...mouse, isPrimary: false });
    expect(hold.isHeld()).toBe(false);
  });

  it('settles an earlier press when a new press starts, and a stale click task cannot end the new one', () => {
    const { hold, fire, runTasks, press, mouse } = setup();
    press();
    const first = settledCount(hold);
    fire('click');
    press({ ...mouse, pointerId: 3 });
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
    const { hold, fire, runTasks, press } = setup();
    press();
    let calls = 0;
    const callback = () => calls++;
    hold.afterSettle(callback);
    hold.afterSettle(callback);
    fire('click');
    runTasks();
    fire('keydown');
    expect(calls).toBe(1);
  });

  it('stops listening and drops a press on disconnect', () => {
    const { hold, press, disconnect, fire } = setup();
    press();
    disconnect();
    expect(hold.isHeld()).toBe(false);
    press();
    fire('pointerdown', { button: 0, isPrimary: true });
    expect(hold.isHeld()).toBe(false);
  });
});
