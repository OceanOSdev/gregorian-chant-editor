import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { DivisionIcon } from './DivisionIcon';
import { EntryIcon, NeumeFamilyMenu, PunctumIcon } from './NeumeFamilyMenu';
import {
  familyActiveKind,
  familyPrimaryTool,
  familyRememberedKind,
  isFamilyPrimaryPressed,
  isPaletteButtonPressed,
  paletteButtonCommand,
  paletteButtonLabel,
  paletteControls,
  quilismaFigureTool,
  type ButtonPaletteTool,
  type FamilyMenuTool,
  type FamilyPrimaryTool,
  type QuilismaFigure,
} from './notation-palette-tools';
import type { DivisionKind } from '../domain/chant-document';
import {
  nextPaletteTool,
  paletteTools,
  type PaletteTool,
} from '../interaction/palette-navigation';
import type { GraphicalNeumeKind } from '../neume-entry-pitches';
import { focusAndReveal } from '../rendering/focus-visibility';
import { neumeName, type EditorFocusRequest } from '../state/editor-session';
import {
  isPunctumFamilyKind,
  neumeFamilyMembers,
  placeEntryTool,
  type EditorTool,
  type NeumeFamily,
} from '../state/editor-tool';

const divisionKinds = ['minima', 'minor', 'maior', 'finalis'] as const;

/** Imperative reset for document replacement; see `reset` below. */
export interface NotationPaletteHandle {
  /**
   * Forget presentation memory (roving stop and remembered division kind)
   * when New, Import or reload replaces the document. Called from the same
   * event handler as the replacement, so both land in one render.
   */
  reset(): void;
}

interface NotationPaletteProps {
  ref?: Ref<NotationPaletteHandle>;
  /** The session's armed tool; drives every pressed/active state. */
  activeTool: EditorTool;
  /** The session's remembered entry kind, shown by its family control. */
  rememberedKind: GraphicalNeumeKind;
  quilismaFigure: QuilismaFigure;
  /** Lyric move, pending history or a clef transaction blocks tool changes. */
  disabled: boolean;
  /** Only `palette` requests are handled here; others belong to the score. */
  focusRequest: EditorFocusRequest | null;
  onArmTool: (tool: EditorTool) => void;
  onSelectTool: () => void;
  onFocusRequestHandled: (request: EditorFocusRequest) => void;
}

/**
 * The notation tools toolbar and its Quilisma figure choice.
 *
 * Owns presentation-only browser state: the roving tab stop, the DOM buttons
 * used to move focus, and the remembered division kind. Tool choices are sent
 * to the session through `onArmTool`/`onSelectTool`; nothing here changes
 * semantic selection, and keyboard browsing never arms a tool.
 */
export function NotationPalette({
  ref,
  activeTool,
  rememberedKind,
  quilismaFigure,
  disabled,
  focusRequest,
  onArmTool,
  onSelectTool,
  onFocusRequestHandled,
}: NotationPaletteProps) {
  const buttons = useRef(new Map<PaletteTool, HTMLButtonElement>());
  const [rovingTool, setRovingTool] = useState<PaletteTool>('select');
  const [divisionKind, setDivisionKind] = useState<DivisionKind>('minima');

  useImperativeHandle(ref, () => ({
    reset() {
      setRovingTool('select');
      setDivisionKind('minima');
    },
  }));

  function focusTool(tool: PaletteTool) {
    const button = buttons.current.get(tool);
    setRovingTool(tool);
    if (button) focusAndReveal(button);
  }

  // `T` (focus-palette) and Select-mode returns arrive as session requests.
  useLayoutEffect(() => {
    if (focusRequest?.kind !== 'palette') return;
    focusTool(focusRequest.tool);
    onFocusRequestHandled(focusRequest);
  }, [focusRequest, onFocusRequestHandled]);

  function registerButton(tool: PaletteTool) {
    return (button: HTMLButtonElement | null) => {
      if (button) buttons.current.set(tool, button);
      else buttons.current.delete(tool);
    };
  }

  function rovingProps(tool: PaletteTool) {
    return {
      tabIndex: rovingTool === tool ? 0 : -1,
      onFocus: () => setRovingTool(tool),
    };
  }

  function browseTools(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const focusedTool =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button')?.dataset.tool
        : undefined;
    const current = paletteTools.find((tool) => tool === focusedTool);
    const next = current && nextPaletteTool(current, event.key);
    if (!next) return;
    event.preventDefault();
    focusTool(next);
  }

  /** Roving-focus and arming wiring shared by both kinds of split control. */
  function splitControlProps(
    primaryTool: FamilyPrimaryTool,
    menuTool: FamilyMenuTool,
  ) {
    return {
      primaryRef: registerButton(primaryTool),
      buttonRef: registerButton(menuTool),
      primaryProps: {
        type: 'button' as const,
        ...rovingProps(primaryTool),
        'aria-pressed': isFamilyPrimaryPressed(primaryTool, activeTool),
        disabled,
        onClick: () => {
          if (primaryTool === 'minima') setDivisionKind('minima');
          onArmTool(familyPrimaryTool(primaryTool));
        },
      },
      buttonProps: {
        type: 'button' as const,
        'data-tool': menuTool,
        ...rovingProps(menuTool),
        disabled,
      },
    };
  }

  function renderDivisionFamily() {
    return (
      <NeumeFamilyMenu<DivisionKind>
        key="minima"
        family="Division"
        familyClassName="division-menu"
        variants={divisionKinds}
        label={neumeName}
        icon={(kind) => <DivisionIcon kind={kind} />}
        active={
          activeTool.kind === 'place-division' ? activeTool.divisionKind : null
        }
        remembered={divisionKind}
        onChoose={(kind) => {
          setDivisionKind(kind);
          onArmTool({ kind: 'place-division', divisionKind: kind });
        }}
        {...splitControlProps('minima', 'division-menu')}
      />
    );
  }

  function renderNeumeFamily(family: NeumeFamily) {
    return (
      <NeumeFamilyMenu<GraphicalNeumeKind>
        key={family}
        family={neumeName(family)}
        familyClassName={`${family}-menu`}
        variants={neumeFamilyMembers[family]}
        label={neumeName}
        icon={(kind) =>
          isPunctumFamilyKind(kind) ? (
            <PunctumIcon kind={kind} />
          ) : (
            <EntryIcon kind={kind} />
          )
        }
        active={familyActiveKind(family, activeTool)}
        remembered={familyRememberedKind(family, rememberedKind)}
        onChoose={(kind) => onArmTool(placeEntryTool(kind))}
        {...splitControlProps(family, `${family}-menu`)}
      />
    );
  }

  function renderButton(tool: ButtonPaletteTool) {
    return (
      <button
        key={tool}
        type="button"
        data-tool={tool}
        disabled={disabled}
        ref={registerButton(tool)}
        {...rovingProps(tool)}
        aria-pressed={isPaletteButtonPressed(tool, activeTool)}
        onClick={() => {
          const command = paletteButtonCommand(tool, quilismaFigure);
          if (command.type === 'select-tool') onSelectTool();
          else onArmTool(command.tool);
        }}
      >
        {paletteButtonLabel(tool)}
      </button>
    );
  }

  return (
    <>
      <div
        className="neume-palette"
        role="toolbar"
        aria-label="Notation tools"
        aria-describedby="palette-instructions"
        data-notation-shortcuts
        onKeyDown={browseTools}
      >
        {paletteControls.map((control) =>
          control.kind === 'division-family'
            ? renderDivisionFamily()
            : control.kind === 'neume-family'
              ? renderNeumeFamily(control.family)
              : renderButton(control.tool),
        )}
      </div>
      <label className="quilisma-figure">
        Quilisma figure{' '}
        <select
          aria-label="Quilisma figure"
          value={quilismaFigure}
          disabled={disabled}
          onChange={(event) =>
            onArmTool(
              quilismaFigureTool(
                event.target.value === 'scandicus' ? 'scandicus' : 'podatus',
              ),
            )
          }
        >
          <option value="podatus">Podatus</option>
          <option value="scandicus">Scandicus</option>
        </select>
      </label>
    </>
  );
}
