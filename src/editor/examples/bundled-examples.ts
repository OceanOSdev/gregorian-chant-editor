import paterNosterSource from './pater-noster.chant.json?raw';
import { decodeDocument } from '../persistence/native-document';

export const bundledExamples = [{ id: 'pater-noster', name: 'Pater Noster' }];

// Decode on each deliberate load: no shared mutable semantic document.
export function loadBundledExample(id: string) {
  if (id !== 'pater-noster') throw new Error('Unknown bundled example.');
  return decodeDocument(paterNosterSource);
}
