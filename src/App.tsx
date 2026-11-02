import { ChantEditor } from './editor/components/ChantEditor';
import { useState } from 'react';
import { readRecovery } from './app/recovery';
import './App.css';

function App() {
  const [recovery] = useState(readRecovery);
  return (
    <ChantEditor
      document={recovery.document}
      initialWarning={recovery.warning}
    />
  );
}

export default App;
