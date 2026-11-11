import { decodeDocument } from '../persistence/native-document';

// Discover all .chant.json files in the examples directory.
const exampleSources = import.meta.glob<string>('./*.chant.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const bundledExamples = Object.entries(exampleSources)
  .flatMap(([path, contents]) => {
    try {
      return [{ id: path, name: decodeDocument(contents).title }];
    } catch (error) {
      console.error(
        `Invalid bundled example ${path}; omitted from Load example.`,
        error,
      );
      return [];
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Decode on each deliberate load: no shared mutable semantic document.
export function loadBundledExample(id: string) {
  if (!Object.hasOwn(exampleSources, id)) {
    throw new Error('Unknown bundled example.');
  }

  return decodeDocument(exampleSources[id]);
}
