import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StoryInterpreter } from './interpreter';
import * as fs from 'fs';
import * as path from 'path';

const TEST_STORY_PATH = path.join(__dirname, 'test.story');

const TEST_STORY_CONTENT = `
SCENE start
  location: "Test Room"
  DESCRIPTION
    You are in a white room.
    There is a door here.
  END
  HOTSPOT door
    name: "Heavy Door"
    LOOK
      It looks heavy.
    END
  END
END
`;

describe('StoryInterpreter', () => {
  let interpreter: StoryInterpreter;

  beforeEach(() => {
    fs.writeFileSync(TEST_STORY_PATH, TEST_STORY_CONTENT);
    interpreter = new StoryInterpreter();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STORY_PATH)) {
      fs.unlinkSync(TEST_STORY_PATH);
    }
  });

  it('should load a simple story file and parse scenes', () => {
    interpreter.load(TEST_STORY_PATH);
    
    const scene = interpreter.getScene('start');
    expect(scene).toBeDefined();
    expect(scene?.id).toBe('start');
    expect(scene?.location).toBe('Test Room');
    
    expect(scene?.description).toEqual([
      'You are in a white room.',
      'There is a door here.'
    ]);

    const door = scene?.hotspots.get('door');
    expect(door).toBeDefined();
    expect(door?.name).toBe('Heavy Door');
    expect(door?.look).toEqual(['It looks heavy.']);
  });
});
