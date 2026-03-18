import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [titleMsg, setTitleMsg] = useState("Waiting for backend...");

  async function newTitle() {
    let response: string = await invoke("get_title");
    setTitleMsg(response);

  }

  return (
    <main className="container">
      <h1>
        Hello :)
      </h1>
      
      <button 
        onClick={newTitle} 
        className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Click Me!
      </button>

      <p>
        {titleMsg}
      </p>
    </main>
  );
}

export default App;
