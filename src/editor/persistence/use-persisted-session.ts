import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChantDocument } from '../domain/chant-document';
import {
  createEditorSession,
  reduceEditorSession,
  type EditorAction,
} from '../state/editor-session';
import { BrowserDocument, autosaveKey } from './browser-document';

export function usePersistedSession(initialDocument: ChantDocument) {
  const [initial] = useState(() => {
    const persistence = new BrowserDocument(() => window.localStorage);
    return {
      persistence,
      session: createEditorSession(persistence.load(initialDocument)),
    };
  });
  const { persistence } = initial;
  const [session, setSession] = useState(initial.session);
  const current = useRef(session);
  const [, refresh] = useState(0);
  const update = useCallback(
    (next: typeof session) => {
      if (next.history.present !== current.current.history.present)
        persistence.save(next.history.present);
      current.current = next;
      setSession(next);
      refresh((n) => n + 1);
    },
    [persistence],
  );
  const dispatch = useCallback(
    (action: EditorAction) => {
      update(reduceEditorSession(current.current, action));
    },
    [update],
  );
  useEffect(() => {
    const check = () => {
      persistence.check();
      refresh((n) => n + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === autosaveKey || event.key === null) check();
    };
    window.addEventListener('storage', storage);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', check);
    };
  }, [persistence]);
  const replace = (document: ChantDocument) => {
    const next = createEditorSession(document);
    // Replacement, including an equal document, is a new history root and save boundary.
    persistence.save(document);
    current.current = next;
    setSession(next);
    refresh((n) => n + 1);
  };
  const reload = () => {
    const document = persistence.load(current.current.history.present);
    if (!persistence.needsRecovery) {
      const next = createEditorSession(document);
      current.current = next;
      setSession(next);
    }
    refresh((n) => n + 1);
    return !persistence.needsRecovery;
  };
  const replaceCache = () => {
    persistence.save(current.current.history.present, true);
    refresh((n) => n + 1);
  };
  return {
    session,
    dispatch,
    replace,
    reload,
    replaceCache,
    status: persistence.status,
    savedLocally: persistence.savedLocally,
    needsRecovery: persistence.needsRecovery,
    recoverySource: persistence.recoverySource,
  };
}
