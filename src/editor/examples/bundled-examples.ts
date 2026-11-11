import { decodeDocument } from '../persistence/native-document';

// Discover all .chant.json files in the examples directory.
const demos = import.meta.glob<string>('./*.chant.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const bundledExamples = Object.entries(demos).map(
  ([path, contents]) => {
    const parsed = JSON.parse(contents);

    return {
      id: path,
      name: parsed.document.title,
    };
  },
);

// Decode on each deliberate load: no shared mutable semantic document.
export function loadBundledExample(id: string) {
  const contents = demos[id];

  if (contents === undefined) {
    throw new Error('Unknown bundled example.');
  }

  return decodeDocument(contents);
}
