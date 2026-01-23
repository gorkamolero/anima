#!/usr/bin/env tsx
import { StoryInterpreter } from './interpreter.js';

async function main() {
  const args = process.argv.slice(2);

  const imageFlag = args.includes('--images') || args.includes('-i');
  const storyFiles = args.filter(a => !a.startsWith('-'));

  if (storyFiles.length === 0) {
    console.log('Usage: tsx src/cli.ts <story.story> [--images]');
    console.log('  --images, -i  Open AI-generated scene images in browser');
    process.exit(1);
  }

  const interpreter = new StoryInterpreter();

  if (imageFlag) {
    interpreter.enableImageGen();
    console.log('[Image generation enabled - scenes will open in browser]');
  }

  interpreter.load(storyFiles[0]);
  await interpreter.run();
}

main().catch(console.error);
