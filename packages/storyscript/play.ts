import { StoryInterpreter } from './src/interpreter.ts';
import * as fs from 'fs';

const storyPath = process.argv[2] || '../../adventures/shadow-over-innsmouth/story/act1.story';
const content = fs.readFileSync(storyPath, 'utf-8');

const interpreter = new StoryInterpreter();
interpreter.load(content);
const output = interpreter.start();
console.log(output);
