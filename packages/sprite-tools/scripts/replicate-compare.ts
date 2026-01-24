#!/usr/bin/env npx tsx
/**
 * replicate-compare.ts - Compare image generation models for character consistency
 *
 * Tests multiple models on Replicate for:
 * - Character extraction from reference
 * - Pose changes while maintaining style
 * - Background removal / green screen generation
 *
 * MODELS TESTED:
 *   - FLUX.1 Kontext (image editing, cartoonify)
 *   - FLUX.2 Dev (multi-reference consistency)
 *   - FLUX.1 Schnell (fast, commercial OK)
 *   - Animagine XL (anime/illustration)
 *   - Playground 2.5 (Midjourney-like)
 *   - HiDream-I1 (17B artistic)
 *
 * USAGE:
 *   REPLICATE_API_TOKEN=xxx npx tsx scripts/replicate-compare.ts \
 *     --reference sources/ash-idle-clean.png \
 *     --prompt "Character walking to the left" \
 *     --output-dir sources/comparisons
 */

import Replicate from "replicate";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

config();

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_API_TOKEN) {
  console.error("ERROR: REPLICATE_API_TOKEN not found in environment");
  process.exit(1);
}

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

// Model configurations
const MODELS = {
  "flux-kontext": {
    id: "black-forest-labs/flux-kontext-dev",
    name: "FLUX.1 Kontext",
    description: "Image editing with text instructions",
    supportsImageInput: true,
    inputKey: "input_image",
  },
  "flux-2-dev": {
    id: "black-forest-labs/flux-2-dev",
    name: "FLUX.2 Dev",
    description: "Multi-reference consistency, 32B params",
    supportsImageInput: true,
    inputKey: "input_images",  // Array
  },
  "flux-redux": {
    id: "black-forest-labs/flux-redux-dev",
    name: "FLUX Redux",
    description: "Style/character variations (no prompt)",
    supportsImageInput: true,
    inputKey: "redux_image",
    noPrompt: true,
  },
  "flux-schnell": {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX.1 Schnell",
    description: "Fast text-to-image",
    supportsImageInput: false,
  },
  "flux-dev": {
    id: "black-forest-labs/flux-dev",
    name: "FLUX.1 Dev",
    description: "Quality text-to-image",
    supportsImageInput: false,
  },
};

async function imageToDataUri(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function runModel(
  modelKey: string,
  referenceImage: string | null,
  prompt: string,
  outputPath: string
): Promise<boolean> {
  const model = MODELS[modelKey as keyof typeof MODELS];
  if (!model) {
    console.error(`Unknown model: ${modelKey}`);
    return false;
  }

  console.log(`\n[${model.name}] Starting...`);

  try {
    let input: Record<string, unknown> = {
      prompt: prompt,
      output_format: "png",
    };

    // Add image input for models that support it
    if (model.supportsImageInput && referenceImage) {
      const imageUri = await imageToDataUri(referenceImage);
      const modelConfig = model as any;

      if (modelConfig.inputKey === "input_images") {
        // FLUX.2 Dev - array of images
        input = {
          prompt: prompt,
          input_images: [imageUri],
          aspect_ratio: "match_input_image",
          output_format: "png",
        };
      } else if (modelConfig.noPrompt) {
        // Redux - no prompt, just image variations
        input = {
          [modelConfig.inputKey]: imageUri,
          aspect_ratio: "9:16",
          output_format: "png",
          num_inference_steps: 28,
        };
      } else {
        // Kontext and others - single image with prompt
        input = {
          prompt: prompt,
          [modelConfig.inputKey]: imageUri,
          aspect_ratio: "match_input_image",
          output_format: "png",
        };
      }
    } else {
      // Text-only models - include character description in prompt
      input = {
        prompt: `${prompt}. Cartoon character, hand-painted style, clean black outlines, vibrant colors, solid green background (#00FF00).`,
        width: 768,
        height: 1344,
        output_format: "png",
      };
    }

    console.log(`[${model.name}] Running prediction...`);

    const output = await replicate.run(model.id as `${string}/${string}`, { input });

    // Handle different output formats
    let imageUrl: string | null = null;
    console.log(`[${model.name}] Raw output type:`, typeof output);

    if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      if (typeof first === "string") {
        imageUrl = first;
      } else if (first && typeof first === "object") {
        // Could be FileOutput or URL object
        if (first instanceof URL || (first as any).constructor?.name === "URL") {
          imageUrl = (first as any).href;
        } else if (typeof (first as any).url === "function") {
          // FileOutput - url() returns URL object
          const result = (first as any).url();
          imageUrl = result?.href || String(result);
        } else if ((first as any).href) {
          imageUrl = (first as any).href;
        } else {
          imageUrl = String(first);
        }
      }
    } else if (typeof output === "string") {
      imageUrl = output;
    } else if (output && typeof output === "object") {
      // Could be FileOutput, URL object, or object with url
      const out = output as any;
      console.log(`[${model.name}] Output constructor:`, out.constructor?.name);

      if (out.constructor?.name === "FileOutput" && typeof out.url === "function") {
        // Replicate FileOutput - url() returns URL object
        const urlObj = out.url();
        imageUrl = urlObj?.href || String(urlObj);
      } else if (output instanceof URL || out.constructor?.name === "URL") {
        // Native URL object
        imageUrl = out.href;
      } else if (out.href) {
        // URL-like object
        imageUrl = out.href;
      } else if (typeof out.url === "function") {
        const result = out.url();
        imageUrl = result?.href || String(result);
      } else if (typeof out.url === "string") {
        imageUrl = out.url;
      } else {
        // Try to get string representation
        imageUrl = String(output);
        if (!imageUrl.startsWith("http")) {
          imageUrl = null;
        }
      }
    }

    console.log(`[${model.name}] Extracted URL:`, imageUrl, typeof imageUrl);

    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
      console.error(`[${model.name}] No valid image URL in output:`, JSON.stringify(output, null, 2));
      return false;
    }

    // Download image
    console.log(`[${model.name}] Downloading from: ${imageUrl.substring(0, 80)}...`);
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    console.log(`[${model.name}] Saved: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`[${model.name}] Error:`, error);
    return false;
  }
}

async function runComparison(
  referenceImage: string,
  prompt: string,
  outputDir: string,
  modelsToTest: string[] = Object.keys(MODELS)
) {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log("=== Replicate Model Comparison ===");
  console.log(`Reference: ${referenceImage}`);
  console.log(`Prompt: ${prompt}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Models: ${modelsToTest.join(", ")}`);

  const results: Record<string, boolean> = {};

  for (const modelKey of modelsToTest) {
    const outputPath = path.join(outputDir, `${modelKey}.png`);
    results[modelKey] = await runModel(modelKey, referenceImage, prompt, outputPath);
  }

  console.log("\n=== Results ===");
  for (const [model, success] of Object.entries(results)) {
    console.log(`${success ? "✓" : "✗"} ${model}`);
  }

  // Open output directory
  console.log(`\nOpening: ${outputDir}`);
}

// Parse arguments
const args = process.argv.slice(2);
let reference = "";
let prompt = "Same character in a walking pose, full body, solid green background";
let outputDir = "sources/comparisons";
let models: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--reference" && args[i + 1]) {
    reference = args[++i];
  } else if (args[i] === "--prompt" && args[i + 1]) {
    prompt = args[++i];
  } else if (args[i] === "--output-dir" && args[i + 1]) {
    outputDir = args[++i];
  } else if (args[i] === "--models" && args[i + 1]) {
    models = args[++i].split(",");
  } else if (args[i] === "--list") {
    console.log("Available models:");
    for (const [key, model] of Object.entries(MODELS)) {
      console.log(`  ${key}: ${model.name} - ${model.description}`);
    }
    process.exit(0);
  }
}

if (!reference) {
  console.log("Usage: npx tsx scripts/replicate-compare.ts --reference <image> [options]");
  console.log("\nOptions:");
  console.log("  --prompt <text>       Prompt for generation");
  console.log("  --output-dir <path>   Output directory");
  console.log("  --models <list>       Comma-separated model keys");
  console.log("  --list                List available models");
  process.exit(1);
}

runComparison(reference, prompt, outputDir, models.length > 0 ? models : undefined);
