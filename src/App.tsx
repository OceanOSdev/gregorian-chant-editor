import { ChantEditor } from './editor/components/ChantEditor';
import { exampleDocument } from './editor/domain/example-document';
import './App.css';

function App() {
  return (
    <>
      <header>
        <p className="preview-notice">
          Experimental preview — committed edits save in this browser. Export
          files for backups.
        </p>
      </header>
      <ChantEditor document={exampleDocument} />
    </>
  );
}

export default App;
