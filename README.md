# Wheelie 🛞

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Tauri](https://img.shields.io/badge/Built_with-Tauri-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![Powered by Rust](https://img.shields.io/badge/Powered_by-Rust-black?logo=rust)](https://www.rust-lang.org/)

Wheely is a high-performance, local desktop application built with Tauri and Rust. By parsing the Abstract Syntax Tree (AST) of a codebase, it embeds pure structural logic rather than variable names. It runs silently in the background, proactively detecting when custom code can be replaced by existing open-source libraries to reduce technical debt and codebase bloat.

## 🚀 Core Features

* **The "Reinvented Wheel" Detector:** Ships with a pre-populated, embedded vector database of anonymized open-source libraries (like `lodash` and `date-fns`). As you code, Wheely instantly alerts you if your custom logic structurally matches an existing, optimized library function.
* **Zero Cold-Start:** Because the library database is pre-packaged, the tool provides immediate, actionable insights on Day 1, File 1, without needing a massive internal codebase to establish context.
* **Privacy-First & Offline:** Powered by a local Qdrant vector database and Rust-native LLM orchestration. Your code never leaves your machine.
* **Specification Drift Detection:** Cross-references structural codebase changes with team communication (Git logs, Slack) to detect when code behavior diverges from documented intent.

## 🏗️ Architecture & Tech Stack

**Frontend (UI)**
* **React.js:** Component-driven user interface.
* **Tailwind CSS (v4 Oxide):** High-performance styling engine powered by Rust.

**Backend (Engine)**
* **Tauri (Rust):** Lightweight desktop shell providing native OS access without browser sandbox restrictions or heavy RAM usage.
* **`notify`:** Hooks directly into the OS file-watcher to trigger analysis instantly on save, bypassing the need for IDE-specific extensions.
* **`tree-sitter`:** Generates the AST to execute *Tiered Whitelisting*—stripping subjective variables and third-party utility names while preserving native APIs and framework lifecycles.

**Data & AI Infrastructure**
* **Qdrant (Local Mode):** Rust-native vector database running entirely offline via local storage.
* **SQLite:** Relational metadata management.
* **LangChain-Rust:** Orchestration layer for semantic overlap analysis.

## 🧠 How It Works (The Pipeline)

1.  **Watch:**
