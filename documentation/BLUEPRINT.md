# Wheelie V1: MVP Architecture Blueprint

## 1. Trigger & Performance Layer (Protecting the CPU)
**Goal:** Provide high-value insight on completed thoughts while keeping local system resource usage near zero.

* **The "Completed Thought" Triggers:** Trigger the pipeline strictly on File Save and Large Paste Events. This guarantees Wheelie is evaluating complete, structurally sound code rather than half-written, un-parsable fragments.
* **The Copy-Paste Interceptor:** Intercepting pasted code *before* the developer wastes time renaming variables to make it fit into their project is Wheelie's highest ROI feature.
* **Incremental Parsing:** Instead of re-parsing an entire massive file, use Tree-sitter’s incremental parsing. It takes the previous AST, looks at the exact lines the user just edited, and only updates those specific nodes.
* **Diff-Only Embedding:** Do not re-embed the whole file into Qdrant on save. Only generate new vectors for functions or code slices whose AST hashes have actually changed since the last save.

---

## 2. Filtering & Slicing Layer (Scope Determination)
**Goal:** Extract the exact right chunk of code using pure AST mathematical weight, completely ignoring arbitrary line-number limits.

**How we measure:** Tree-sitter calculates a Complexity Score for any given block of code by counting control-flow nodes (`if`, `for`, `while`, `switch`, `&&`, `||`) and Sinks (variable mutations, API calls, DOM updates). 

**Container Nodes (Not just functions):** Wheelie doesn't just look for function keywords. It looks for cohesive Container Nodes. A massive `for` loop sitting in the global scope of a script, or a dense `useEffect` hook (a `call_expression`), are evaluated exactly the same way.

### The Routing Logic

| Bucket | Complexity Score | Characteristics | Action |
| :--- | :--- | :--- | :--- |
| **A: The Trivial** | **0 to 3** | Simple getters/setters, basic UI wrappers, straight-line variable assignments. | **Drop it.** Do not encode this into the database. It is boilerplate. |
| **B: The Cohesive** | **4 to 12** | A focused algorithm doing one or two things well (e.g., a custom sorting loop, a date formatter). | **Encode as one vector.** This is the exact structural weight of standard library functions. |
| **C: The Monolith** | **> 12** | A "God function" intertwining multiple independent data flows (e.g., calculating cart + formatting string + API call). | **Trigger Slicer.** Do not encode the whole thing. It will be muddy noise. |

### How the Slicer Works (For Bucket C)
1. **Identify Sinks:** Wheelie reads bottom-up from identified Sinks (returns, API calls). 
2. **Walk Backward:** It walks backward up the AST and extracts both Data Dependencies (variable declarations) and Control Dependencies (parent `if` statements or loops). 
3. **Preserve Context:** If two distinct loops exist inside a single parent `if` statement, they are sliced into two separate vectors, but *both* vectors will retain the parent `if` statement so the math knows the algorithm is conditional.

---

## 3. Normalization & Mapping Layer (The Universal Skeleton)
**Goal:** Strip out human noise so the vector math works, but save the context so Wheelie can write the replacement code later.

1. **The Variable Map:** Before stripping the code, map the user's specific variables to generic slots (e.g., parameter `userCart` maps to `{{input_1}}`; return variable `totalPrice` maps to `{{output}}`).
2. **Anonymize Variables:** Translate the AST variables to `VAR_1`, `VAR_2` so the structural embedding is pure.
3. **Preserve Primitive Types:** Replace literal values with their explicit data type (e.g., `TYPE_NUMBER`, `TYPE_STRING`) rather than generic blanks to differentiate between math and string manipulation.
4. **Preserve Native Intent:** Keep core language APIs untouched (`.map`, `fetch`, `Math.max`) as they act as semantic anchors.
5. **Strip Noise:** Remove comments and whitespace nodes entirely.

---

## 4. Actionability Engine (The UX Mandate)
**Goal:** Generate the exact, contextual code snippet the user needs so they can accept the suggestion with zero friction, while respecting system resources.

### Resolution Methods
* **The Generic Usage Snippet (Library Swaps):** Because strict 1:1 variable templates fail due to "Signature Mismatch" (e.g., missing optional arguments), the database provides an `import` statement and a Generic Usage Template. Wheelie surfaces how the library expects to be called, allowing the developer to mentally bridge the remaining gap in seconds.
* **The Path Resolver (Internal Deduplication):** If Qdrant returns a match from the `local_repo` collection, Rust checks if the target function is exported. If yes, it calculates the relative path (e.g., `../utils/math`) and generates the contextual `import` statement.

### The Opt-In LLM Auto-Integrator (The Escape Hatch)
To prevent CPU spikes and latency, an LLM should never run automatically in the background.
1. When Wheelie surfaces a library match, it provides a "Copy Import" button and an **"Auto-Integrate"** button.
2. If the user clicks Auto-Integrate, Wheelie boots a tiny, lightning-fast local LLM (like Llama.cpp), passes it the library name and the user's messy code, and prompts it to perform the exact contextual variable mapping. 

### Gamification & Settings
* **Configurable Confidence:** Default the similarity threshold to 95% (strict) to prevent false-positive fatigue.
* **The Complexity Leaderboard:** Wheelie maintains a dedicated UI tab tracking the top 10 most complex, monolithic functions in the user's repository using the Tree-sitter scores. 

---

## 5. Library Database Strategy (Data Acquisition)
**Goal:** Build a high-accuracy, pre-packaged database of library functions without relying on brittle source-code scraping.

* **The Abstraction Gap:** Library source code is highly optimized and abstract. If you embed `lodash` source code directly, it will not mathematically match a user's naive custom function.
* **Synthetic Target Generation:** Use an LLM offline during your database generation phase. Prompt it to write 5 to 10 variations of how a junior-to-mid level developer would *naively* write a custom function for a specific task.
* **Embed and Link:** Run these naive synthetic variations through Wheelie's normalization pipeline, embed them into Qdrant, and link their metadata back to the robust library equivalent. 

---

## 6. Multi-Language Architecture (The Adapter Pattern)
**Goal:** Support multiple languages without requiring a total rewrite of the core Rust engine.

* **The Problem:** Tree-sitter creates completely different AST node structures for each language. Hardcoding logic to look for an `arrow_function` will crash the pipeline when evaluating Python.
* **The Trait Interface:** Define a `LanguageAdapter` trait in Rust with generic methods like `is_function_node()`, `get_control_flow_complexity()`, and `generate_import_statement()`.
* **The Implementation:** Write specific adapters (e.g., `TypeScriptAdapter`, `PythonAdapter`) that contain the messy, language-specific AST string names. The core engine never looks at hardcoded string names; it just asks the active adapter.
* **Database Silos:** Qdrant collections are siloed by language (e.g., `typescript_libraries`, `python_libraries`). Wheelie uses the file extension to point Qdrant to the correct collection and load the correct Adapter.

---

## 7. The Unified V1 Pipeline (Execution Flow)

1. **Trigger:** User Saves File OR Pastes a block of code.
2. **Adapter Initialization:** Wheelie detects the file extension and loads the appropriate `LanguageAdapter`.
3. **Parse:** Tree-sitter incrementally updates the AST.
4. **Map & Normalize:** The Adapter extracts user variables to a map, replaces literals with Primitive Types, and strips noise to create the structural skeleton.
5. **Filter:** Drop the Trivial (Bucket A), encode the Cohesive (Bucket B), and slice the Monoliths (Bucket C) based purely on Complexity Score and Control Dependencies.
6. **Query:** Send the normalized vector(s) to the language-specific Qdrant collections.
7. **Resolve:** Generate the Generic Usage Snippet for libraries, or resolve local paths for internal deduplication.
8. **Action:** Surface the lightweight notification with the import snippet and the on-demand "Auto-Integrate" LLM button. Update the Complexity Leaderboard.