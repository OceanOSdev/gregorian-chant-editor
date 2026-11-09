import { useLayoutEffect, useRef, type Dispatch } from 'react';
import { isPlacementTool } from '../state/editor-tool';
import type { Clef } from '../domain/chant-document';
import { deriveScoreOrder, scoreBoundaryAt } from '../domain/divisions';
import { isValidClef } from '../domain/clef';
import type { EditorAction, EditorSession } from '../state/editor-session';

/** Staged authored-clef editing and the separate deletion confirmation. */
export function ClefChangeControls({
  session,
  dispatch,
}: {
  session: EditorSession;
  dispatch: Dispatch<EditorAction>;
}) {
  const selection = session.selection;
  const target =
    selection.kind === 'clef-change'
      ? session.history.present.clefChanges.find(
          (c) => c.id === selection.clefChangeId,
        )
      : null;
  const transaction = session.clefTransaction;
  const panel = useRef<HTMLDivElement>(null);
  const transactionId = transaction?.id,
    candidate = transaction?.candidate;
  useLayoutEffect(() => {
    if (transactionId)
      panel.current
        ?.querySelector<HTMLSelectElement | HTMLButtonElement>('select,button')
        ?.focus();
  }, [transactionId, candidate]);
  const insertNeume = (after: boolean) => {
    if (!target) return;
    const order = deriveScoreOrder(session.history.present) ?? [];
    dispatch({
      type: 'insert',
      boundary: scoreBoundaryAt(
        order,
        order.findIndex((i) => i.entity.id === target.id) + Number(after),
      ),
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
  if (!transaction && (!target || isPlacementTool(session.activeTool)))
    return null;
  const confirming = !!candidate;
  return (
    <div
      ref={panel}
      className={confirming ? 'clef-dialog' : 'clef-context'}
      role={confirming ? 'dialog' : 'group'}
      aria-modal={confirming ? true : undefined}
      aria-label={
        confirming
          ? 'Choose pitch preservation'
          : transaction
            ? 'Edit selected clef'
            : 'Selected clef'
      }
      onKeyDown={(e) => {
        if (e.key === 'Tab' && confirming) {
          const controls = [
            ...(panel.current?.querySelectorAll<HTMLButtonElement>('button') ??
              []),
          ];
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      {confirming && transaction ? (
        <>
          <p>
            {candidate.clefChanges.some((c) => c.id === transaction.id)
              ? 'This clef changes the pitch interpretation of existing notes.'
              : 'Remove this clef and choose how to interpret the following notes.'}
          </p>
          {transaction.policyError ? (
            <p role="status">{transaction.policyError}</p>
          ) : null}
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
              dispatch({ type: 'confirm-clef-change', preserve: 'noteheads' })
            }
          >
            Preserve noteheads
          </button>{' '}
          <button
            type="button"
            onClick={() => dispatch({ type: 'cancel-clef-change' })}
          >
            Cancel clef change
          </button>
        </>
      ) : transaction ? (
        <>
          <strong>Edit selected clef</strong>
          {transaction.policyError ? (
            <p role="status">{transaction.policyError}</p>
          ) : null}
          <ClefDraft
            clef={transaction.clef}
            onChange={(clef) => dispatch({ type: 'draft-clef-change', clef })}
          />
          <button
            type="button"
            onClick={() => dispatch({ type: 'apply-clef-change' })}
          >
            Apply clef change
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'cancel-clef-change' })}
          >
            Cancel clef change
          </button>
          <span className="clef-context__hint">
            Draft only. Apply commits; Escape cancels.
          </span>
        </>
      ) : target ? (
        <>
          <strong>
            Selected {target.clef.type.toUpperCase()} clef · line{' '}
            {target.clef.staffLine}
          </strong>
          <button
            type="button"
            disabled={!!(session.pendingHistory || session.lyricMove)}
            onClick={() =>
              dispatch({ type: 'start-clef-change', id: target.id })
            }
          >
            Edit clef change
          </button>
          <button
            type="button"
            disabled={!!(session.pendingHistory || session.lyricMove)}
            onClick={() => {
              dispatch({ type: 'start-clef-change', id: target.id });
              dispatch({ type: 'apply-clef-change', remove: true });
            }}
          >
            Delete clef change
          </button>
          <button type="button" onClick={() => insertNeume(false)}>
            Insert {session.rememberedKind} before clef
          </button>
          <button type="button" onClick={() => insertNeume(true)}>
            Insert {session.rememberedKind} after clef
          </button>
        </>
      ) : null}
    </div>
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
      </label>
      <label>
        Line{' '}
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
