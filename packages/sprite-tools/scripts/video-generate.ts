#!/usr/bin/env npx tsx
/**
 * video-generate.ts - Test video generation models for character animation
 *
 * Tests multiple models for rubberhose animation style:
 * - Minimax Video-01-Live (~$0.50/video) - Best for animation/Live2D
 * - Luma Ray Flash 2 540p ($0.033/sec) - Has native loop option
 * - Veo 3.1 ($0.10/sec) - Highest quality (uses veo-video.ts)
 *
 * USAGE:
 *   cd packages/sprite-tools
 *   npx tsx scripts/video-generate.ts --model minimax --image sources/valid/ashley-cherub-standing.png
 *   npx tsx scripts/video-generate.ts --model luma --image sources/valid/ashley-cherub-standing.png --loop
 *   npx tsx scripts/video-generate.ts --all --image sources/valid/ashley-cherub-standing.png
 */

import Replicate from "replicate";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

config();

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_API_TOKEN) {
  console.error("ERROR: REPLICATE_API_TOKEN not found in environment");
  console.error("Make sure you have a .env file with REPLICATE_API_TOKEN=...");
  process.exit(1);
}

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

// Model configurations for video generation
const VIDEO_MODELS = {
  minimax: {
    id: "minimax/video-01-live",
    name: "Minimax Video-01-Live",
    description: "Animation/Live2D style, ~$0.50/video",
    cost: "$0.50",
    duration: "5s",
  },
  luma: {
    id: "luma/ray-flash-2-540p",
    name: "Luma Ray Flash 2 540p",
    description: "Fast, cheap, has loop option, $0.033/sec",
    cost: "$0.17/5s",
    duration: "5s",
  },
  sora: {
    id: "openai/sora-2-pro",
    name: "Sora 2 Pro",
    description: "OpenAI best quality, $0.10/sec",
    cost: "$0.40/4s",
    duration: "4s",
  },
  veo: {
    id: "google/veo-3.1",
    name: "Veo 3.1",
    description: "Google best quality, $0.10/sec",
    cost: "$0.40/4s",
    duration: "4s",
  },
};

// Default prompts for rubberhose animation
const PROMPTS = {
  idle: "Subtle idle animation, gentle breathing motion, slight body sway, rubberhose cartoon style, 1920s animation, smooth fluid movement, Betty Boop style, static background",
  walk: "Walking animation cycle, rubberhose cartoon style, fluid bouncy arm swing, 1920s cartoon movement, Betty Boop Cuphead style, arms move like rubber hoses, smooth looping walk cycle, static background",
};

async function imageToDataUri(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function generateWithMinimax(
  imagePath: string,
  prompt: string,
  outputPath: string
): Promise<boolean> {
  console.log("\n[Minimax Video-01-Live] Starting...");
  console.log(`[Minimax] Prompt: ${prompt}`);

  try {
    const imageUri = await imageToDataUri(imagePath);

    const input = {
      prompt: prompt,
      first_frame_image: imageUri,
      prompt_optimizer: true,
    };

    console.log("[Minimax] Running prediction (this may take 1-2 minutes)...");

    const output = await replicate.run("minimax/video-01-live", { input });

    // Extract video URL
    let videoUrl: string | null = null;

    if (typeof output === "string") {
      videoUrl = output;
    } else if (output && typeof output === "object") {
      const out = output as Record<string, unknown>;
      if (out.video && typeof out.video === "string") {
        videoUrl = out.video;
      } else if (typeof (out as { href?: string }).href === "string") {
        videoUrl = (out as { href: string }).href;
      } else {
        // Try to get URL from FileOutput
        const maybeFileOutput = out as { url?: () => { href?: string } };
        if (typeof maybeFileOutput.url === "function") {
          const urlResult = maybeFileOutput.url();
          videoUrl = urlResult?.href || String(urlResult);
        } else {
          videoUrl = String(output);
        }
      }
    }

    if (!videoUrl || !videoUrl.startsWith("http")) {
      console.error("[Minimax] No valid video URL in output");
      console.error("[Minimax] Raw output:", JSON.stringify(output, null, 2));
      return false;
    }

    // Download video
    console.log(`[Minimax] Downloading video...`);
    const response = await fetch(videoUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    console.log(`[Minimax] ✓ Saved: ${outputPath}`);
    return true;
  } catch (error) {
    console.error("[Minimax] Error:", error);
    return false;
  }
}

async function generateWithVeo(
  imagePath: string,
  prompt: string,
  outputPath: string,
  aspectRatio: string = "9:16"
): Promise<boolean> {
  console.log("\n[Veo 3.1] Starting...");
  console.log(`[Veo] Prompt: ${prompt}`);
  console.log(`[Veo] Aspect: ${aspectRatio}`);

  try {
    const imageUri = await imageToDataUri(imagePath);

    const input = {
      prompt: prompt,
      image: imageUri,
      duration: 4,
      aspect_ratio: aspectRatio,
      generate_audio: false,
    };

    console.log("[Veo] Running prediction (this may take 1-3 minutes)...");

    const output = await replicate.run("google/veo-3.1", { input });

    // Extract video URL
    let videoUrl: string | null = null;

    if (typeof output === "string") {
      videoUrl = output;
    } else if (output && typeof output === "object") {
      const out = output as Record<string, unknown>;
      if (out.video && typeof out.video === "string") {
        videoUrl = out.video;
      } else if (typeof (out as { href?: string }).href === "string") {
        videoUrl = (out as { href: string }).href;
      } else {
        const maybeFileOutput = out as { url?: () => { href?: string } };
        if (typeof maybeFileOutput.url === "function") {
          const urlResult = maybeFileOutput.url();
          videoUrl = urlResult?.href || String(urlResult);
        } else {
          videoUrl = String(output);
        }
      }
    }

    if (!videoUrl || !videoUrl.startsWith("http")) {
      console.error("[Veo] No valid video URL in output");
      console.error("[Veo] Raw output:", JSON.stringify(output, null, 2));
      return false;
    }

    // Download video
    console.log(`[Veo] Downloading video...`);
    const response = await fetch(videoUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    console.log(`[Veo] ✓ Saved: ${outputPath}`);
    return true;
  } catch (error) {
    console.error("[Veo] Error:", error);
    return false;
  }
}

async function generateWithSora(
  imagePath: string,
  prompt: string,
  outputPath: string
): Promise<boolean> {
  console.log("\n[Sora 2 Pro] Starting...");
  console.log(`[Sora] Prompt: ${prompt}`);

  try {
    const imageUri = await imageToDataUri(imagePath);

    const input = {
      prompt: prompt,
      input_reference: imageUri,
      seconds: 4,
      aspect_ratio: "portrait",
    };

    console.log("[Sora] Running prediction (this may take 1-3 minutes)...");

    const output = await replicate.run("openai/sora-2-pro", { input });

    // Extract video URL
    let videoUrl: string | null = null;

    if (typeof output === "string") {
      videoUrl = output;
    } else if (output && typeof output === "object") {
      const out = output as Record<string, unknown>;
      if (out.video && typeof out.video === "string") {
        videoUrl = out.video;
      } else if (typeof (out as { href?: string }).href === "string") {
        videoUrl = (out as { href: string }).href;
      } else {
        const maybeFileOutput = out as { url?: () => { href?: string } };
        if (typeof maybeFileOutput.url === "function") {
          const urlResult = maybeFileOutput.url();
          videoUrl = urlResult?.href || String(urlResult);
        } else {
          videoUrl = String(output);
        }
      }
    }

    if (!videoUrl || !videoUrl.startsWith("http")) {
      console.error("[Sora] No valid video URL in output");
      console.error("[Sora] Raw output:", JSON.stringify(output, null, 2));
      return false;
    }

    // Download video
    console.log(`[Sora] Downloading video...`);
    const response = await fetch(videoUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    console.log(`[Sora] ✓ Saved: ${outputPath}`);
    return true;
  } catch (error) {
    console.error("[Sora] Error:", error);
    return false;
  }
}

async function generateWithLuma(
  imagePath: string,
  prompt: string,
  outputPath: string,
  loop: boolean = false
): Promise<boolean> {
  console.log("\n[Luma Ray Flash 2] Starting...");
  console.log(`[Luma] Prompt: ${prompt}`);
  console.log(`[Luma] Loop: ${loop}`);

  try {
    const imageUri = await imageToDataUri(imagePath);

    const input: Record<string, unknown> = {
      prompt: prompt,
      start_image: imageUri,
      aspect_ratio: "9:16",
      duration: 5,
      loop: loop,
    };

    console.log("[Luma] Running prediction (this may take 30-60 seconds)...");

    const output = await replicate.run("luma/ray-flash-2-540p", { input });

    // Extract video URL
    let videoUrl: string | null = null;

    if (typeof output === "string") {
      videoUrl = output;
    } else if (output && typeof output === "object") {
      const out = output as Record<string, unknown>;
      if (out.video && typeof out.video === "string") {
        videoUrl = out.video;
      } else if (typeof (out as { href?: string }).href === "string") {
        videoUrl = (out as { href: string }).href;
      } else {
        const maybeFileOutput = out as { url?: () => { href?: string } };
        if (typeof maybeFileOutput.url === "function") {
          const urlResult = maybeFileOutput.url();
          videoUrl = urlResult?.href || String(urlResult);
        } else {
          videoUrl = String(output);
        }
      }
    }

    if (!videoUrl || !videoUrl.startsWith("http")) {
      console.error("[Luma] No valid video URL in output");
      console.error("[Luma] Raw output:", JSON.stringify(output, null, 2));
      return false;
    }

    // Download video
    console.log(`[Luma] Downloading video...`);
    const response = await fetch(videoUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);

    console.log(`[Luma] ✓ Saved: ${outputPath}`);
    return true;
  } catch (error) {
    console.error("[Luma] Error:", error);
    return false;
  }
}

// Parse arguments
const args = process.argv.slice(2);
let imagePath = "";
let modelKey = "";
let promptType: "idle" | "walk" | "custom" = "idle";
let customPrompt = "";
let outputDir = "sources/videos";
let loop = false;
let runAll = false;
let aspectRatio = "9:16";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--image" && args[i + 1]) {
    imagePath = args[++i];
  } else if (args[i] === "--model" && args[i + 1]) {
    modelKey = args[++i];
  } else if (args[i] === "--prompt" && args[i + 1]) {
    customPrompt = args[++i];
    promptType = "custom";
  } else if (args[i] === "--idle") {
    promptType = "idle";
  } else if (args[i] === "--walk") {
    promptType = "walk";
  } else if (args[i] === "--output-dir" && args[i + 1]) {
    outputDir = args[++i];
  } else if (args[i] === "--loop") {
    loop = true;
  } else if (args[i] === "--aspect" && args[i + 1]) {
    aspectRatio = args[++i];
  } else if (args[i] === "--all") {
    runAll = true;
  } else if (args[i] === "--list") {
    console.log("Available video models:");
    for (const [key, model] of Object.entries(VIDEO_MODELS)) {
      console.log(`  ${key}: ${model.name}`);
      console.log(`    ${model.description}`);
    }
    console.log("\nDefault prompts:");
    console.log(`  --idle: "${PROMPTS.idle}"`);
    console.log(`  --walk: "${PROMPTS.walk}"`);
    process.exit(0);
  } else if (args[i] === "--help") {
    console.log("Usage: npx tsx scripts/video-generate.ts --model <model> --image <path> [options]");
    console.log("\nOptions:");
    console.log("  --model <name>     Model to use: minimax, luma");
    console.log("  --image <path>     Input image path");
    console.log("  --idle             Use idle animation prompt (default)");
    console.log("  --walk             Use walk cycle prompt");
    console.log("  --prompt <text>    Custom prompt");
    console.log("  --output-dir       Output directory (default: sources/videos)");
    console.log("  --loop             Enable loop mode (Luma only)");
    console.log("  --all              Test all models");
    console.log("  --list             List available models and prompts");
    process.exit(0);
  }
}

if (!imagePath) {
  console.error("ERROR: --image is required");
  console.log("Usage: npx tsx scripts/video-generate.ts --model <model> --image <path>");
  console.log("       npx tsx scripts/video-generate.ts --help");
  process.exit(1);
}

if (!runAll && !modelKey) {
  console.error("ERROR: --model or --all is required");
  process.exit(1);
}

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Determine prompt
const prompt = customPrompt || PROMPTS[promptType];

async function main() {
  console.log("=== Video Generation Test ===");
  console.log(`Image: ${imagePath}`);
  console.log(`Prompt type: ${promptType}`);
  console.log(`Output dir: ${outputDir}`);

  const results: Record<string, boolean> = {};
  const timestamp = Date.now();
  const baseName = path.basename(imagePath, path.extname(imagePath));

  if (runAll) {
    // Test all models
    console.log("\nRunning all models...\n");

    // Minimax
    const minimaxOutput = path.join(outputDir, `${baseName}-minimax-${promptType}-${timestamp}.mp4`);
    results.minimax = await generateWithMinimax(imagePath, prompt, minimaxOutput);

    // Luma (with loop for idle)
    const lumaLoop = promptType === "idle";
    const lumaOutput = path.join(outputDir, `${baseName}-luma-${promptType}${lumaLoop ? "-loop" : ""}-${timestamp}.mp4`);
    results.luma = await generateWithLuma(imagePath, prompt, lumaOutput, lumaLoop);
  } else {
    // Single model
    const outputPath = path.join(outputDir, `${baseName}-${modelKey}-${promptType}-${timestamp}.mp4`);

    if (modelKey === "minimax") {
      results.minimax = await generateWithMinimax(imagePath, prompt, outputPath);
    } else if (modelKey === "luma") {
      results.luma = await generateWithLuma(imagePath, prompt, outputPath, loop);
    } else if (modelKey === "sora") {
      results.sora = await generateWithSora(imagePath, prompt, outputPath);
    } else if (modelKey === "veo") {
      results.veo = await generateWithVeo(imagePath, prompt, outputPath, aspectRatio);
    } else {
      console.error(`Unknown model: ${modelKey}`);
      process.exit(1);
    }
  }

  // Summary
  console.log("\n=== Results ===");
  for (const [model, success] of Object.entries(results)) {
    console.log(`${success ? "✓" : "✗"} ${VIDEO_MODELS[model as keyof typeof VIDEO_MODELS]?.name || model}`);
  }

  console.log(`\nOutput directory: ${outputDir}`);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
