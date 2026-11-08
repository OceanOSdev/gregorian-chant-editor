import { useLayoutEffect, useRef, useState, type Dispatch } from 'react';
import type { Clef } from '../domain/chant-document';
import { deriveScoreOrder, scoreBoundaryAt } from '../domain/divisions';
import { isValidClef } from '../domain/clef';
import type { EditorAction, EditorSession } from '../state/editor-session';

export function ClefChangeControls({
  session,
  dispatch,
}: {
  session: EditorSession;
  dispatch: Dispatch<EditorAction>;
}) {
  const document = session.history.present;
  const order = deriveScoreOrder(document) ?? [];
  const [slotIndex, setSlotIndex] = useState(0);
  const [targetId, setTargetId] = useState('');
  const selection = session.selection;
  const selectedId =
    selection.kind === 'clef-change' ? selection.clefChangeId : targetId;
  const target = document.clefChanges.find((c) => c.id === selectedId);
  const transaction = session.clefTransaction;
  const dialog = useRef<HTMLDivElement>(null);
  const transactionId = transaction?.id;
  const candidate = transaction?.candidate;
  useLayoutEffect(() => {
    if (transactionId)
      dialog.current
        ?.querySelector<HTMLButtonElement | HTMLSelectElement>('button, select')
        ?.focus();
  }, [transactionId, candidate]);
  const insertNeumeAtClef = (after: boolean) => {
    if (!target) return;
    const index = order.findIndex((item) => item.entity.id === target.id);
    dispatch({
      type: 'insert',
      boundary: scoreBoundaryAt(order, index + (after ? 1 : 0)),
      ids: {
        neumeId: crypto.randomUUID(),
        noteIds: [
          crypto.randomUUID(),
          crypto.randomUUID(),
          crypto.randomUUID(),
        ],
      },
      lyricCommitId: crypto.randomUUID(),
    });
  };
  const eventName = (index: number) => {
    const item = order[index];
    if (!item) return 'score end';
    if (item.type === 'clef')
      return `${item.entity.clef.type.toUpperCase()}${item.entity.clef.staffLine} clef (${index + 1})`;
    if (item.type === 'division')
      return `${item.entity.kind} division (${index + 1})`;
    return `neume ${document.neumes.findIndex((n) => n.id === item.entity.id) + 1}`;
  };
  const start = () => {
    const index = Math.min(slotIndex, order.length);
    dispatch({
      type: 'start-clef-change',
      id: crypto.randomUUID(),
      boundary: scoreBoundaryAt(order, index),
    });
  };
  return (
    <>
      <fieldset
        className="clef-change-controls"
        disabled={
          !!(transaction || session.pendingHistory || session.lyricMove)
        }
      >
        <legend>Mid-score clefs</legend>
        <label>
          Insertion boundary{' '}
          <select
            aria-label="Clef insertion boundary"
            value={Math.min(slotIndex, order.length)}
            onChange={(e) => setSlotIndex(Number(e.currentTarget.value))}
          >
            {Array.from({ length: order.length + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}.{' '}
                {i
                  ? `After ${eventName(i - 1)} / before ${eventName(i)}`
                  : `Before ${eventName(i)}`}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={start}>
          Insert clef change
        </button>{' '}
        <label>
          Authored clef{' '}
          <select
            aria-label="Authored clef target"
            value={target?.id ?? ''}
            onChange={(e) => {
              setTargetId(e.currentTarget.value);
              if (e.currentTarget.value)
                dispatch({
                  type: 'select',
                  selection: {
                    kind: 'clef-change',
                    clefChangeId: e.currentTarget.value,
                  },
                });
            }}
          >
            <option value="">Choose clef</option>
            {order.flatMap((item) =>
              item.type === 'clef'
                ? [
                    <option key={item.entity.id} value={item.entity.id}>
                      {item.entity.clef.type.toUpperCase()}
                      {item.entity.clef.staffLine} — event{' '}
                      {order.findIndex((i) => i.entity.id === item.entity.id) +
                        1}
                    </option>,
                  ]
                : [],
            )}
          </select>
        </label>{' '}
        <button
          type="button"
          disabled={!target}
          onClick={() =>
            target && dispatch({ type: 'start-clef-change', id: target.id })
          }
        >
          Edit clef change
        </button>{' '}
        <button
          type="button"
          disabled={!target}
          onClick={() => {
            if (target) {
              dispatch({ type: 'start-clef-change', id: target.id });
              dispatch({ type: 'apply-clef-change', remove: true });
            }
          }}
        >
          Delete clef change
        </button>
        <button
          type="button"
          disabled={!target}
          onClick={() => insertNeumeAtClef(false)}
        >
          Insert {session.rememberedKind} before clef
        </button>{' '}
        <button
          type="button"
          disabled={!target}
          onClick={() => insertNeumeAtClef(true)}
        >
          Insert {session.rememberedKind} after clef
        </button>
        <p>
          Choose a whole-neume boundary, including either side of a bar or clef.
          Edits use Apply/Cancel. To relocate a clef, delete it and insert
          another.
        </p>
      </fieldset>
      {transaction ? (
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label={
            transaction.candidate
              ? 'Choose pitch preservation'
              : 'Clef change draft'
          }
          className="clef-dialog"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              dispatch({ type: 'cancel-clef-change' });
            }
            if (e.key === 'Tab') {
              const controls = [
                ...(dialog.current?.querySelectorAll<
                  HTMLButtonElement | HTMLSelectElement
                >('button,select') ?? []),
              ];
              const first = controls[0],
                last = controls.at(-1);
              if (e.shiftKey && globalThis.document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (
                !e.shiftKey &&
                globalThis.document.activeElement === last
              ) {
                e.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          {transaction.candidate ? (
            <>
              <p>
                This clef operation changes how existing notes are interpreted.
                Choose once for the final change.
              </p>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: 'confirm-clef-change', preserve: 'melody' })
                }
              >
                Preserve melody
              </button>{' '}
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'confirm-clef-change',
                    preserve: 'noteheads',
                  })
                }
              >
                Preserve noteheads
              </button>{' '}
            </>
          ) : (
            <>
              <p>
                {transaction.boundary ? 'Insert' : 'Edit'} clef change. The
                score remains committed until Apply.
              </p>
              <ClefDraft
                clef={transaction.clef}
                onChange={(clef) =>
                  dispatch({ type: 'draft-clef-change', clef })
                }
              />{' '}
              <button
                type="button"
                onClick={() => dispatch({ type: 'apply-clef-change' })}
              >
                Apply clef change
              </button>{' '}
            </>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: 'cancel-clef-change' })}
          >
            Cancel clef change
          </button>
          <p>
            Escape cancels this entire operation. Any lyric draft is retained.
          </p>
        </div>
      ) : null}
    </>
  );
}

function ClefDraft({
  clef,
  onChange,
}: {
  clef: Clef;
  onChange: (clef: Clef) => void;
}) {
  return (
    <>
      <label>
        Type{' '}
        <select
          aria-label="Draft clef type"
          value={clef.type}
          onChange={(e) => {
            const next = { ...clef, type: e.currentTarget.value };
            if (isValidClef(next)) onChange(next);
          }}
        >
          <option value="c">C</option>
          <option value="f">F</option>
        </select>
      </label>{' '}
      <label>
        Staff line{' '}
        <select
          aria-label="Draft clef staff line"
          value={clef.staffLine}
          onChange={(e) => {
            const next = { ...clef, staffLine: Number(e.currentTarget.value) };
            if (isValidClef(next)) onChange(next);
          }}
        >
          {[1, 2, 3, 4].map((line) => (
            <option key={line} value={line}>
              {line} from bottom
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
