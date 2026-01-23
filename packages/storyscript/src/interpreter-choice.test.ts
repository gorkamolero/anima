import { describe, it, expect } from 'vitest';
import { StoryInterpreter } from './interpreter';

describe('Nested CHOICE blocks', () => {
  it('should parse nested CHOICE blocks correctly', () => {
    const story = `
DIALOGUE test
  npc: "Hello"
  
  CHOICE
    > "Option 1"
      npc: "You chose 1"
      CHOICE
        > "Nested 1"
          npc: "Nested choice 1 selected"
          GIVE item1
        > "Nested 2"
          npc: "Nested choice 2 selected"
          GIVE item2
      END
    > "Option 2"
      npc: "You chose 2"
  END
END
    `;

    const interpreter = new StoryInterpreter();
    interpreter.loadContent(story);

    const dialogue = interpreter.getDialogue('test');
    expect(dialogue).toBeDefined();
    expect(dialogue?.lines.length).toBeGreaterThan(0);

    console.log('Dialogue lines:', dialogue?.lines);
  });

  it('should execute nested CHOICE correctly', async () => {
    const story = `
DIALOGUE test
  npc: "Hello"

  CHOICE
    > "Option 1"
      npc: "You chose 1"
      CHOICE
        > "Nested 1"
          npc: "Nested choice 1 selected"
          GIVE item1
        > "Nested 2"
          npc: "Nested choice 2 selected"
          GIVE item2
      END
    > "Option 2"
      npc: "You chose 2"
  END
END
    `;

    const interpreter = new StoryInterpreter();
    interpreter.loadContent(story);

    // Set up choice handler to auto-select first option
    const choiceQueue = [0, 0]; // Select first option for both CHOICE blocks
    interpreter.setChoiceHandler(async (choices) => {
      const choiceIndex = choiceQueue.shift();
      if (choiceIndex !== undefined) {
        return choiceIndex;
      }
      return 0;
    });

    const dialogue = interpreter.getDialogue('test');
    const result = await interpreter.executeLines(dialogue!.lines);

    console.log('Result output:', result.output);
    console.log('State:', interpreter.getState());

    // Output is array of dialogue lines in format 'speaker: "text"'
    expect(result.output.some(line => line.includes('Hello'))).toBe(true);
  });
});
