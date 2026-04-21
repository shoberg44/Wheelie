# 🧠 Wheelie V1: MVP Architecture Blueprint

## 1. Trigger & Performance Layer (Protecting the CPU)
**Goal:** Provide high-value insight on completed thoughts while keeping local system resource usage near zero.

* **The "Completed Thought" Triggers:** Trigger the pipeline strictly on File Save and Large Paste Events. This guarantees Wheelie is evaluating complete, structurally sound code rather than half-written, un-parsable fragments.
* **The Copy-Paste Interceptor:** Intercepting pasted code *before* the developer wastes time renaming variables to make it fit into their project is Wheelie's highest ROI feature.
* **Incremental Parsing:** Instead of re-parsing an entire massive file, use Tree-sitter’s incremental parsing. It takes the previous AST, looks at the exact lines the user just edited, and only updates those specific nodes.
* **Diff-Only Embedding:** Do not re-embed the whole file into Qdrant on save. Only generate new vectors for functions or code slices whose AST hashes have actually changed since the last save.

---

## 2. Filtering & Slicing Layer (Scope Determination)
**Goal:** Extract the exact right chunk of code using pure AST mathematical weight, keeping the logic small enough to fit within an ML model's context window.

**How we measure:** Tree-sitter calculates a Complexity Score for any given block of code by counting control-flow nodes (`if`, `for`, `while`, `switch`, `&&`, `||`) and Sinks (variable mutations, API calls, DOM updates). 

**Container Nodes (Not just functions):** Wheelie doesn't just look for function keywords. It looks for cohesive Container Nodes. A massive `for` loop sitting in the global scope of a script, or a dense `useEffect` hook (a `call_expression`), are evaluated exactly the same way.

### The Routing Logic

| Bucket | Complexity Score | Characteristics | Action |
| :--- | :--- | :--- | :--- |
| **A: The Trivial** | **0 to 3** | Simple getters/setters, basic UI wrappers, straight-line variable assignments. | **Drop it.** Do not encode this into the database. It is boilerplate. |
| **B: The Cohesive** | **4 to 12** | A focused algorithm doing one or two things well (e.g., a custom sorting loop, a date formatter). | **Target for ML Embedding.** This is the perfect size for accurate intent matching. |
| **C: The Monolith** | **> 12** | A "God function" intertwining multiple independent data flows. | **Trigger Slicer.** Do not embed the whole thing. It will exceed ML context windows and become muddy noise. |

### How the Slicer Works (For Bucket C)
1. **Identify Sinks:** Wheelie reads bottom-up from identified Sinks (returns, API calls). 
2. **Walk Backward:** It walks backward up the AST and extracts both Data Dependencies (variable declarations) and Control Dependencies (parent `if` statements or loops). 
3. **Preserve Context:** If two distinct loops exist inside a single parent `if` statement, they are sliced into two separate logical chunks, but *both* chunks will retain the parent `if` statement so the ML model knows the algorithm is conditional.

---

## 3. Normalization & Mapping Layer (The Universal Skeleton)
**Goal:** Strip out human language noise so the ML model focuses purely on algorithmic logic, while saving the variable context for code generation later.

1. **The Variable Map:** Before stripping the code, map the user's specific variables to generic slots (e.g., parameter `userCart` maps to `{{input_1}}`; return variable `totalPrice` maps to `{{output}}`).
2. **Anonymize Variables:** Translate the AST variables to `VAR_1`, `VAR_2`. *Why? Because ML models are trained on English. Stripping "pizzaPrice" prevents the model from classifying the code as "food-related" and forces it to look at the math.*
3. **Preserve Primitive Types:** Replace literal values with their explicit data type (e.g., `TYPE_NUMBER`, `TYPE_STRING`) rather than generic blanks to differentiate between math and string manipulation.
4. **Preserve Native Intent:** Keep core language APIs untouched (`.map`, `fetch`, `Math.max`) as they act as semantic anchors.
5. **Strip Noise:** Remove comments and whitespace nodes entirely.

---

## 4. The Semantic Embedding Layer (The ML Upgrade)
**Goal:** Translate the Normalized Skeleton into a mathematical representation of *functional intent* (what the code does, not just how it's written).

* **The Engine:** A lightweight, local Neural Code Embedding model (e.g., `all-MiniLM-L6-v2` or a quantized `CodeBERT` running via Rust crates like `candle` or `tch-rs`).
* **The Input:** The pre-processed, noise-free string from the Normalization Layer.
* **The Output:** A high-dimensional vector array that represents the "DNA" of the algorithm.
* **The Advantage:** Unlike structural hashing, the ML model understands that a `for` loop used for summation and a `.reduce()` method used for summation share the exact same intent, mapping them to the exact same area in the vector database.

---

## 5. Actionability Engine (The UX Mandate)
**Goal:** Generate the exact, contextual code snippet the user needs so they can accept the suggestion with zero friction, while respecting system resources.

### Resolution Methods
* **The Generic Usage Snippet (Library Swaps):** Because strict 1:1 variable templates fail due to "Signature Mismatch" (e.g., missing optional arguments), the database provides an `import` statement and a Generic Usage Template. Wheelie surfaces how the library expects to be called, allowing the developer to mentally bridge the remaining gap in seconds.
* **The Path Resolver (Internal Deduplication):** If Qdrant returns a match from the `local_repo` collection, Rust checks if the target function is exported. If yes, it calculates the relative path (e.g., `../utils/math`) and generates the contextual `import` statement.

### Gamification & Settings
* **Configurable Confidence:** Default the similarity threshold to 95% (strict) to prevent false-positive fatigue.
* **The Complexity Leaderboard:** Wheelie maintains a dedicated UI tab tracking the top 10 most complex, monolithic functions in the user's repository using the Tree-sitter scores. 

---

## 6. Library Database Strategy (Data Acquisition)
**Goal:** Build a high-accuracy, pre-packaged database of library functions without relying on brittle source-code scraping.

* **The Abstraction Gap:** Library source code is highly optimized and abstract. If you embed `lodash` source code directly, it will not mathematically match a user's naive custom function.
* **Synthetic Target Generation:** Use an LLM offline during your database generation phase. Prompt it to write 5 variations of how a junior-to-mid level developer would *naively* write a custom function for a specific task.
* **Embed and Link:** Run these naive synthetic variations through Wheelie's normalization and ML embedding pipeline, upload them into Qdrant, and link their metadata back to the robust library equivalent. 

---

## 7. Multi-Language Architecture (The Adapter Pattern)
**Goal:** Support multiple languages without requiring a total rewrite of the core Rust engine.

* **The Problem:** Tree-sitter creates completely different AST node structures for each language.
* **The Trait Interface:** Define a `LanguageAdapter` trait in Rust with generic methods like `is_function_node()`, `get_control_flow_complexity()`, and `generate_import_statement()`.
* **The Implementation:** Write specific adapters (e.g., `TypeScriptAdapter`, `PythonAdapter`) that contain the messy, language-specific AST string names. The core engine never looks at hardcoded string names; it just asks the active adapter.
* **Database Silos:** Qdrant collections are siloed by language (e.g., `typescript_libraries`, `python_libraries`). Wheelie uses the file extension to point Qdrant to the correct collection and load the correct Adapter.

---

## 8. The Unified V1 Pipeline (Execution Flow)

1. **Trigger:** User Saves File OR Pastes a block of code.
2. **Adapter Initialization:** Wheelie detects the file extension and loads the appropriate `LanguageAdapter`.
3. **Parse:** Tree-sitter incrementally updates the AST.
4. **Map & Normalize:** The Adapter extracts user variables to a map, replaces literals with Primitive Types, and strips noise to create the structural skeleton string.
5. **Calculate Vector (The ML Step):** Rust passes the skeleton string to the local Neural Embedding Model to calculate the Semantic Vector.
6. **Query:** Send the Semantic Vector to the language-specific Qdrant collections.
7. **Resolve:** Generate the Generic Usage Snippet for libraries, or resolve local paths for internal deduplication.
8. **Action:** Surface the lightweight notification with the import snippet and the on-demand "Auto-Integrate" LLM button. Update the Complexity Leaderboard.

---

## 9. The Safety Net & Pivot Architecture (Risk Mitigation)
**Goal:** Guarantee the survival and utility of the product even if the core vector matching or deterministic code translation yields brittle results in real-world testing. 

This section defines the three tiers of architectural fallbacks, ranging from a UX escape hatch to complete product pivots.

### Tier 1: The Opt-In LLM Auto-Integrator (The UX Escape Hatch)
*Use this when the vector database successfully finds a match, but the deterministic variable template fails due to "Signature Mismatch" (e.g., messy user variables or missing optional arguments).*

* **The UX Pivot:** To prevent CPU spikes and latency, an LLM should never run automatically in the background. It must be an opt-in user action.
* **The Execution:** When Wheelie surfaces a library match, it provides a simple "Copy Import" button and a secondary **"✨ Auto-Integrate"** button.
* **The Handoff:** If the user clicks Auto-Integrate, Wheelie boots a tiny, lightning-fast local LLM (like Llama.cpp), passes it the Qdrant-verified library name and the user's messy code, and prompts it to perform the exact contextual variable mapping. 
* **The Result:** This buys the 2-3 seconds of latency needed, keeping resource drain strictly on-demand while providing "magic" code generation when the user explicitly requests it.

### Tier 2: The "RAG" Approach / LLM-as-a-Judge (Pivot 1)
*Use this if Semantic Code Embeddings generate too many False Positives (e.g., returning 85% matches for code that looks similar but functions differently).*

* **The Architecture Shift:** Demote Qdrant from "The Decider" to "The Filter." 
* **The Execution:**
  1. Wheelie embeds the user's code and asks Qdrant for the top 3 potential library matches.
  2. Instead of showing these to the user, the backend passes the user's code and the top 3 matches to a fast local ML model.
  3. **The Prompt:** *"You are a strict static analyzer. Does this custom code perform the exact same logical function as `[Library A, B, or C]`? Answer only YES or NO."*
* **The Result:** Qdrant cheaply narrows down the universe of code, and the LLM provides the final, highly accurate deterministic check, practically eliminating false positives.

### Tier 3: The "Pure Linter" Pivot (Pivot 2)
*Use this if Neural Code Embeddings are too heavy for local systems, or if semantic matching fails entirely across the board.*

* **The Architecture Shift:** Completely abandon the ML Neural Embedder, abandon the external Library Database, and revert to the pure Tree-sitter Structural Hashing pipeline.
* **The Execution:** Wheelie drops the goal of replacing custom code with open-source libraries. Instead, it queries the `local_repo` Qdrant collection using strict structural vectors.
* **The Result:** Wheelie becomes a blazing-fast, silent internal deduplication tool. It catches exact copy-pasted duplicate functions hiding in different files within the user's own repository. This guarantees 100% accuracy and remains a highly valuable, commercially viable Developer Experience product.