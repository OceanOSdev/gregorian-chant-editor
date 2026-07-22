import { ChantEditor } from './editor/components/ChantEditor'
import { exampleDocument } from './editor/domain/example-document'
import './App.css'

function App() {
  return <ChantEditor document={exampleDocument} />
}

export default App
