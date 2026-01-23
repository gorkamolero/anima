#!/usr/bin/env node
import { StoryInterpreter } from './interpreter.js';

async function main() {
  const args = process.argv.slice(2);

  // Version flag
  if (args.includes('--version') || args.includes('-v')) {
    console.log('storyscript v0.1.0');
    process.exit(0);
  }

  // Help flag
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const imageFlag = args.includes('--images') || args.includes('-i');
  const storyFiles = args.filter(a => !a.startsWith('-'));

  if (storyFiles.length === 0) {
    printHelp();
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

function printHelp() {
  console.log(`
StoryScript - Point-and-click adventure game DSL interpreter

Usage:
  storyscript <story.story> [options]
  npx @anima/storyscript <story.story> [options]

Options:
  --images, -i   Open AI-generated scene images in browser
  --version, -v  Show version number
  --help, -h     Show this help message

REPL Commands (during gameplay):
  look, l           Look around (scene description)
  look <target>     Look at something
  talk <target>     Talk to someone
  use <target>      Use something
  hotspots, h       List available hotspots
  inventory, i      Show inventory
  state             Show game state (debug)
  quit, q           Exit game

Example:
  storyscript adventures/my-game/story/act1.story
`);
}

main().catch(console.error);
