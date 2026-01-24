#!/usr/bin/env npx tsx
/**
 * GPT Image Generation via Replicate (openai/gpt-image-1.5)
 *
 * Usage:
 *   npx tsx scripts/gpt5-image.ts \
 *     --prompt "2D side-scrolling game background, flat side-on view" \
 *     [--image https://url-to-reference.jpg] \
 *     [--output output.jpg] \
 *     [--aspect 16:9]
 */

import fs from "fs";
import path from "path";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!REPLICATE_API_TOKEN || !OPENAI_API_KEY) {
  console.error("Error: REPLICATE_API_TOKEN and OPENAI_API_KEY must be set");
  process.exit(1);
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[];
  error?: string;
  logs?: string;
}

async function createPrediction(
  prompt: string,
  imageUrl?: string,
  aspectRatio = "16:9"
): Promise<string> {
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    quality: "high",
    openai_api_key: OPENAI_API_KEY,
  };

  if (imageUrl) {
    input.input_images = [imageUrl];
    input.input_fidelity = "high"; // Try to match the reference closely
  }

  console.log("Creating prediction...");
  console.log("Prompt:", prompt.slice(0, 100) + (prompt.length > 100 ? "..." : ""));
  if (imageUrl) console.log("Reference:", imageUrl);

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "openai/gpt-image-1.5",
      input,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create prediction: ${response.status} ${error}`);
  }

  const prediction = (await response.json()) as ReplicatePrediction;
  console.log("Prediction ID:", prediction.id);
  return prediction.id;
}

async function pollPrediction(predictionId: string): Promise<string[]> {
  const maxAttempts = 60; // 2 minutes with 2s interval
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to poll: ${response.status}`);
    }

    const prediction = (await response.json()) as ReplicatePrediction;

    if (prediction.status === "succeeded") {
      if (!prediction.output || prediction.output.length === 0) {
        throw new Error("No output in successful prediction");
      }
      return prediction.output;
    }

    if (prediction.status === "failed") {
      throw new Error(`Prediction failed: ${prediction.error || "Unknown error"}`);
    }

    if (prediction.status === "canceled") {
      throw new Error("Prediction was canceled");
    }

    process.stdout.write(".");
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Prediction timed out after 2 minutes");
}

async function downloadImage(url: string, outputPath: string): Promise<void> {
  console.log("\nDownloading image...");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`Saved to: ${outputPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  let prompt = "";
  let imageUrl = "";
  let output = "gpt-image-output.jpg";
  let aspect = "16:9";

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--prompt" || args[i] === "-p") && args[i + 1]) {
      prompt = args[++i];
    } else if ((args[i] === "--image" || args[i] === "-i") && args[i + 1]) {
      imageUrl = args[++i];
    } else if ((args[i] === "--output" || args[i] === "-o") && args[i + 1]) {
      output = args[++i];
    } else if ((args[i] === "--aspect" || args[i] === "-a") && args[i + 1]) {
      aspect = args[++i];
    }
  }

  if (!prompt) {
    console.log(`Usage: npx tsx scripts/gpt5-image.ts --prompt "..." [options]

Options:
  -p, --prompt   Text prompt for image generation (required)
  -i, --image    URL to reference image for image-to-image
  -o, --output   Output filename (default: gpt-image-output.jpg)
  -a, --aspect   Aspect ratio: 1:1, 16:9, 9:16, 3:2, etc. (default: 16:9)

Examples:
  # Text-to-image
  npx tsx scripts/gpt5-image.ts -p "A cozy bus station at sunset, 2D game art"

  # Image-to-image (style transfer)
  npx tsx scripts/gpt5-image.ts \\
    -p "Convert to flat 2D side-view game background, Monkey Island style" \\
    -i https://example.com/reference.jpg \\
    -o dock-sideview.jpg
`);
    process.exit(1);
  }

  try {
    const predictionId = await createPrediction(prompt, imageUrl, aspect);
    const outputs = await pollPrediction(predictionId);
    console.log("\nGenerated:", outputs[0]);
    await downloadImage(outputs[0], output);
  } catch (err) {
    console.error("\nError:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
