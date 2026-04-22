/**
 * ============================================================================
 *  Semantic Code Embedding — Proof of Concept
 * ============================================================================
 *
 *  Goal: Prove that transformer-based embeddings can identify functionally
 *        equivalent code (same *intent*) even when the surface-level syntax
 *        is completely different, while correctly down-ranking code that
 *        shares syntax but has different intent.
 *
 *  Model : Xenova/all-MiniLM-L6-v2  (runs locally via ONNX, no API key)
 *  Metric: Cosine Similarity
 *
 *  Run:
 *    npm install
 *    npm start
 * ============================================================================
 */

import { pipeline } from "@xenova/transformers";

// ─── Cosine Similarity ──────────────────────────────────────────────────────

/**
 * Computes the cosine similarity between two equal-length numeric vectors.
 * Returns a value in [-1, 1] where 1 = identical direction.
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

// ─── Code Snippets (Normalized Variable Names) ─────────────────────────────

const snippets = {
  target: {
    label: "Target — Lodash-style chunk",
    code: `function VAR_1(VAR_2, VAR_3) {
  const VAR_4 = [];
  for (let VAR_5 = 0; VAR_5 < VAR_2.length; VAR_5 += VAR_3) {
    VAR_4.push(VAR_2.slice(VAR_5, VAR_5 + VAR_3));
  }
  return VAR_4;
}`,
  },

  matchA: {
    label: "Match A — Naive for-loop chunk",
    code: `function VAR_1(VAR_2, VAR_3) {
  const VAR_4 = [];
  let VAR_5 = 0;
  for (; VAR_5 < VAR_2.length; VAR_5 += VAR_3) {
    VAR_4.push(VAR_2.slice(VAR_5, VAR_5 + VAR_3));
  }
  return VAR_4;
}`,
  },

  matchB: {
    label: "Match B — while + splice chunk",
    code: `function VAR_1(VAR_2, VAR_3) {
  const VAR_4 = [];
  const VAR_5 = [...VAR_2];
  while (VAR_5.length > 0) {
    VAR_4.push(VAR_5.splice(0, VAR_3));
  }
  return VAR_4;
}`,
  },

  noiseA: {
    label: "Noise A — Sum array (for loop)",
    code: `function VAR_1(VAR_2) {
  let VAR_3 = 0;
  for (let VAR_4 = 0; VAR_4 < VAR_2.length; VAR_4++) {
    VAR_3 += VAR_2[VAR_4];
  }
  return VAR_3;
}`,
  },

  noiseB: {
    label: "Noise B — String concatenation",
    code: `function VAR_1(VAR_2, VAR_3) {
  let VAR_4 = "";
  for (let VAR_5 = 0; VAR_5 < VAR_2.length; VAR_5++) {
    VAR_4 += VAR_2[VAR_5] + VAR_3;
  }
  return VAR_4.slice(0, -VAR_3.length);
}`,
  },
};

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n⏳ Loading model (first run will download ~80 MB)…\n");

  // Load the feature-extraction pipeline with the local ONNX model
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );

  // Generate an embedding for a single code string.
  // mean_pooling + normalize gives a single unit vector per snippet.
  async function embed(text) {
    const output = await extractor(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }

  console.log("🔢 Generating embeddings for all 5 snippets…\n");

  const targetEmbedding = await embed(snippets.target.code);

  // Build results for the 4 comparison snippets
  const results = [];
  for (const key of ["matchA", "matchB", "noiseA", "noiseB"]) {
    const { label, code } = snippets[key];
    const embedding = await embed(code);
    const similarity = cosineSimilarity(targetEmbedding, embedding);
    results.push({ label, similarity });
  }

  // Sort descending by similarity
  results.sort((a, b) => b.similarity - a.similarity);

  // ─── Pretty-print results ──────────────────────────────────────────────

  const SEP = "═".repeat(62);
  const THIN = "─".repeat(62);

  console.log(SEP);
  console.log(
    `  ${"Snippet".padEnd(42)} ${"Cosine Sim".padStart(12)}  Result`
  );
  console.log(SEP);

  for (const { label, similarity } of results) {
    const score = similarity.toFixed(4);
    const bar = similarity >= 0.75 ? "✅ MATCH" : "❌ NOISE";
    console.log(`  ${label.padEnd(42)} ${score.padStart(12)}  ${bar}`);
  }

  console.log(THIN);
  console.log(
    "  Threshold: >= 0.75 → MATCH  |  < 0.75 → NOISE  (illustrative)\n"
  );

  // ─── Interpretation ────────────────────────────────────────────────────

  const matchScores = results
    .filter((r) => r.label.startsWith("Match"))
    .map((r) => r.similarity);
  const noiseScores = results
    .filter((r) => r.label.startsWith("Noise"))
    .map((r) => r.similarity);

  const lowestMatch = Math.min(...matchScores);
  const highestNoise = Math.max(...noiseScores);

  console.log("📊 Interpretation:");
  if (lowestMatch > highestNoise) {
    console.log(
      "   ✅ SUCCESS — All functional matches scored higher than all noise."
    );
    console.log(
      `   Gap: lowest match (${lowestMatch.toFixed(4)}) > highest noise (${highestNoise.toFixed(4)})`
    );
    console.log(
      "   → Embeddings capture *intent*, not just *syntax*.\n"
    );
  } else {
    console.log(
      "   ⚠️  OVERLAP — Some noise scored as high as a functional match."
    );
    console.log(
      "   → Additional normalization or a fine-tuned model may be needed.\n"
    );
  }
}

main().catch(console.error);
