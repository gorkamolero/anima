#!/usr/bin/env tsx
/**
 * StoryScript Direct Interpreter
 *
 * A line-by-line interpreter for StoryScript .story files. Parses and executes
 * story content directly without building an intermediate AST, using a state
 * machine to manage game progression.
 *
 * Features:
 * - Scene management with hotspots and descriptions
 * - Dialogue system with branching choices
 * - Inventory tracking
 * - Conditional logic and triggers
 * - Interactive REPL for gameplay
 */

import * as fs from 'fs';
import * as readline from 'readline';
import { exec } from 'child_process';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents the current state of the game
 */
interface GameState {
  scene: string;
  inventory: Set<string>;
  flags: Record<string, string | number | boolean>;
}

/**
 * Represents an interactive object in a scene
 */
interface Hotspot {
  id: string;
  name: string;
  look: string[];
  talk: string[];
  use: string[];
}

/**
 * Represents a scene in the story
 */
interface Scene {
  id: string;
  location: string;
  description: string[];
  onEnter: string[];
  hotspots: Map<string, Hotspot>;
}

/**
 * Represents a dialogue tree
 */
interface Dialogue {
  id: string;
  lines: string[];
}

/**
 * Represents a conditional trigger
 */
interface Trigger {
  id: string;
  requirements: string[];
  cutscene: string[];
  goto: string;
}

// ============================================================================
// Types
// ============================================================================

export interface StoryHandlers {
  onLine?: (line: { speaker?: string; text: string; type: 'dialogue' | 'narration' | 'thought' }) => Promise<void>;
  onChoice?: (choices: { text: string; content: string[] }[]) => Promise<number>;
  onSetFlag?: (name: string, value: any) => void;
  onGiveItem?: (item: string) => void;
  onDialogueStart?: (id: string) => void;
  onDialogueEnd?: () => void;
  onSceneEnter?: (sceneId: string) => void;
  onCutscene?: (lines: string[]) => Promise<void>;
  onTrigger?: (triggerId: string) => void;
  onActComplete?: (actId: number, state: { inventory: string[]; flags: Record<string, unknown> }) => void;
}

export type ChoiceHandler = (choices: { text: string; content: string[] }[]) => Promise<number>;

interface GameState {
  scene: string;
  inventory: Set<string>;
  flags: Record<string, string | number | boolean>;
}

interface Hotspot {
  id: string;
  name: string;
  look: string[];
  talk: string[];
  use: string[];
}

interface Scene {
  id: string;
  location: string;
  description: string[];
  onEnter: string[];
  hotspots: Map<string, Hotspot>;
}

interface Dialogue {
  id: string;
  lines: string[];
}

interface Trigger {
  id: string;
  requirements: string[];
  cutscene: string[];
  goto: string;
}

// ============================================================================
// Interpreter
// ============================================================================

/**
 * Main interpreter class for StoryScript files
 *
 * Parses .story files and provides an interactive REPL for playing
 * point-and-click adventure games.
 */
export class StoryInterpreter {
  private lines: string[] = [];
  private state: GameState;
  private scenes: Map<string, Scene> = new Map();
  private dialogues: Map<string, Dialogue> = new Map();
  private triggers: Map<string, Trigger> = new Map();
  private rl: readline.Interface | null = null;
  private choiceHandler: ChoiceHandler | null = null;
  private handlers: StoryHandlers = {};
  private choiceResolvers: ((index: number) => void)[] = [];
  private imageGenEnabled = false;

  constructor() {
    this.state = {
      scene: '',
      inventory: new Set(),
      flags: {},
    };
  }

  getScene(id: string): Scene | undefined {
    return this.scenes.get(id);
  }

  getDialogue(id: string): Dialogue | undefined {
    return this.dialogues.get(id);
  }

  getTrigger(id: string): Trigger | undefined {
    return this.triggers.get(id);
  }

  getState(): GameState {
    return this.state;
  }

  setInventory(items: string[] | Set<string>): void {
    if (Array.isArray(items)) {
      this.state.inventory = new Set(items);
    } else {
      this.state.inventory = items;
    }
  }

  setFlags(flags: Record<string, string | number | boolean>): void {
    this.state.flags = { ...flags };
  }

  setCurrentScene(sceneId: string): void {
    this.state.scene = sceneId;
  }

  enableImageGen(): void {
    this.imageGenEnabled = true;
  }

  private openImageForScene(scene: Scene): void {
    if (!this.imageGenEnabled) return;

    // Build a prompt from the scene description
    const descText = scene.description
      .filter(line => !line.trim().startsWith('IF ') && !line.trim().startsWith('->'))
      .join(' ')
      .replace(/"/g, '')
      .trim();

    if (!descText) return;

    // Add style guidance for better results
    const prompt = `1930s noir adventure game scene: ${descText}, stylized art, moody lighting`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=450&nologo=true`;

    // Open in default browser
    const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${openCmd} "${url}"`, (err) => {
      if (err) console.log('[Image gen unavailable]');
    });
  }

  // ==========================================================================
  // File Loading & Parsing
  // ==========================================================================

  /**
   * Loads and parses a StoryScript file
   *
   * @param filePath - Path to the .story file to load
   * @throws {Error} If file cannot be read or is empty
   */
  load(filePath: string): void {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path provided');
    }

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
    }

    this.loadContent(content);
  }

  setChoiceHandler(handler: ChoiceHandler): void {
    this.choiceHandler = handler;
  }

  setHandlers(handlers: StoryHandlers): void {
    this.handlers = handlers;
    // Map legacy choiceHandler if present in new handlers
    if (handlers.onChoice) {
      this.choiceHandler = handlers.onChoice;
    }
  }

  /**
   * Loads story content from string
   *
   * @param content - StoryScript content string
   * @throws {Error} If content is empty
   */
  loadContent(content: string): void {
    if (!content.trim()) {
      throw new Error('Story content is empty');
    }

    this.lines = content.split('\n');
    this.parseFile();
  }

  /**
   * Parses all top-level blocks in the loaded file
   *
   * Iterates through lines and delegates to appropriate parsers based on
   * block type (SCENE, DIALOGUE, TRIGGER).
   */
  private parseFile(): void {
    let i = 0;
    while (i < this.lines.length) {
      const line = this.lines[i].trim();

      if (line.startsWith('SCENE ')) {
        i = this.parseScene(i);
      } else if (line.startsWith('DIALOGUE ')) {
        i = this.parseDialogue(i);
      } else if (line.startsWith('TRIGGER ')) {
        i = this.parseTrigger(i);
      } else {
        i++;
      }
    }
  }

  /**
   * Parses a SCENE block and all its contents
   *
   * @param startIndex - The line index where SCENE starts
   * @returns The line index after parsing is complete
   */
  private parseScene(startIndex: number): number {
    const headerLine = this.lines[startIndex].trim();
    const id = headerLine.replace('SCENE ', '').trim();

    if (!id) {
      console.warn('Warning: SCENE block at line ' + (startIndex + 1) + ' has no ID');
    }

    const scene: Scene = {
      id,
      location: '',
      description: [],
      onEnter: [],
      hotspots: new Map(),
    };

    let i = startIndex + 1;
    while (i < this.lines.length) {
      const line = this.lines[i].trim();

      // Scene ends when we hit END at indent 0, or another SCENE/DIALOGUE/TRIGGER
      if ((line === 'END' && this.getIndent(this.lines[i]) === 0) ||
          line.startsWith('SCENE ') ||
          line.startsWith('DIALOGUE ') ||
          line.startsWith('TRIGGER ')) {
        this.scenes.set(id, scene);
        if (!this.state.scene && id) this.state.scene = id;
        return line === 'END' ? i + 1 : i;
      }

      if (line.startsWith('location:')) {
        scene.location = line.replace('location:', '').trim().replace(/"/g, '');
      } else if (line === 'DESCRIPTION') {
        const [desc, nextI] = this.parseTextBlock(i + 1);
        scene.description = desc;
        i = nextI;
        continue;
      } else if (line === 'ON_ENTER') {
        const [enter, nextI] = this.parseTextBlock(i + 1);
        scene.onEnter = enter;
        i = nextI;
        continue;
      } else if (line.startsWith('HOTSPOT ')) {
        const [hotspot, nextI] = this.parseHotspot(i);
        scene.hotspots.set(hotspot.id, hotspot);
        i = nextI;
        continue;
      }

      i++;
    }

    this.scenes.set(id, scene);
    if (!this.state.scene && id) this.state.scene = id;
    return i;
  }

  /**
   * Parses a text block (DESCRIPTION, ON_ENTER, CUTSCENE, etc.)
   *
   * @param startIndex - The line index where the block starts
   * @returns A tuple of [content lines, next line index]
   */
  private parseTextBlock(startIndex: number): [string[], number] {
    const content: string[] = [];
    let i = startIndex;

    while (i < this.lines.length) {
      const line = this.lines[i].trim();

      if (line === 'END') {
        return [content, i + 1];
      }

      if (line && !line.startsWith('#')) {
        content.push(line);
      }

      i++;
    }

    return [content, i];
  }

  /**
   * Parses a HOTSPOT block within a scene
   *
   * @param startIndex - The line index where HOTSPOT starts
   * @returns A tuple of [hotspot object, next line index]
   */
  private parseHotspot(startIndex: number): [Hotspot, number] {
    const headerLine = this.lines[startIndex].trim();
    // HOTSPOT id [x, y, w, h] or HOTSPOT id
    const match = headerLine.match(/HOTSPOT\s+(\w+)/);
    const id = match ? match[1] : 'unknown';

    if (id === 'unknown') {
      console.warn('Warning: HOTSPOT at line ' + (startIndex + 1) + ' has invalid ID');
    }

    const hotspot: Hotspot = {
      id,
      name: id,
      look: [],
      talk: [],
      use: [],
    };

    let i = startIndex + 1;
    const hotspotIndent = this.getIndent(this.lines[startIndex]);

    while (i < this.lines.length) {
      const line = this.lines[i].trim();
      const indent = this.getIndent(this.lines[i]);

      // End of hotspot when we hit END at or below hotspot level
      if (line === 'END' && indent <= hotspotIndent + 2) {
        return [hotspot, i + 1];
      }

      if (line.startsWith('name:')) {
        hotspot.name = line.replace('name:', '').trim().replace(/"/g, '');
      } else if (line === 'LOOK') {
        const actionIndent = indent;
        const [content, nextI] = this.parseActionBlock(i + 1, actionIndent);
        hotspot.look = content;
        i = nextI;
        continue;
      } else if (line === 'TALK') {
        const actionIndent = indent;
        const [content, nextI] = this.parseActionBlock(i + 1, actionIndent);
        hotspot.talk = content;
        i = nextI;
        continue;
      } else if (line === 'USE') {
        const actionIndent = indent;
        const [content, nextI] = this.parseActionBlock(i + 1, actionIndent);
        hotspot.use = content;
        i = nextI;
        continue;
      }

      i++;
    }

    return [hotspot, i];
  }

  /**
   * Parses an action block (LOOK, TALK, USE content)
   *
   * @param startIndex - The line index where the action block starts
   * @param actionIndent - The indent level of the action keyword
   * @returns A tuple of [content lines, next line index]
   */
  private parseActionBlock(startIndex: number, actionIndent: number): [string[], number] {
    const content: string[] = [];
    let i = startIndex;

    while (i < this.lines.length) {
      const line = this.lines[i].trim();
      const indent = this.getIndent(this.lines[i]);

      // END closes this action block (END at same indent as LOOK/TALK/USE)
      if (line === 'END' && indent === actionIndent) {
        return [content, i + 1];
      }

      if (line && !line.startsWith('#')) {
        content.push(line);
      }

      i++;
    }

    return [content, i];
  }

  /**
   * Parses a DIALOGUE block
   *
   * @param startIndex - The line index where DIALOGUE starts
   * @returns The line index after parsing is complete
   */
  private parseDialogue(startIndex: number): number {
    const headerLine = this.lines[startIndex].trim();
    const id = headerLine.replace('DIALOGUE ', '').trim();

    const dialogue: Dialogue = { id, lines: [] };

    let i = startIndex + 1;
    const baseIndent = this.getIndent(this.lines[startIndex]);

    while (i < this.lines.length) {
      const line = this.lines[i].trim();
      const indent = this.getIndent(this.lines[i]);

      // Dialogue ends at END with same indent as DIALOGUE
      if (line === 'END' && indent === baseIndent) {
        this.dialogues.set(id, dialogue);
        return i + 1;
      }

      // Also end if we hit another top-level block
      if ((line.startsWith('SCENE ') || line.startsWith('DIALOGUE ') ||
           line.startsWith('TRIGGER ')) && indent === 0) {
        this.dialogues.set(id, dialogue);
        return i;
      }

      if (line && !line.startsWith('#')) {
        dialogue.lines.push(line);
      }
      i++;
    }

    this.dialogues.set(id, dialogue);
    return i;
  }

  /**
   * Parses a TRIGGER block
   *
   * @param startIndex - The line index where TRIGGER starts
   * @returns The line index after parsing is complete
   */
  private parseTrigger(startIndex: number): number {
    const headerLine = this.lines[startIndex].trim();
    const id = headerLine.replace('TRIGGER ', '').trim();

    const trigger: Trigger = {
      id,
      requirements: [],
      cutscene: [],
      goto: '',
    };

    let i = startIndex + 1;
    const baseIndent = this.getIndent(this.lines[startIndex]);

    while (i < this.lines.length) {
      const line = this.lines[i].trim();
      const indent = this.getIndent(this.lines[i]);

      if (line === 'END' && indent === baseIndent) {
        this.triggers.set(id, trigger);
        return i + 1;
      }

      if (line.startsWith('REQUIRE ')) {
        trigger.requirements.push(line.replace('REQUIRE ', ''));
      } else if (line === 'CUTSCENE') {
        const [content, nextI] = this.parseTextBlock(i + 1);
        trigger.cutscene = content;
        i = nextI;
        continue;
      } else if (line.startsWith('-> ')) {
        trigger.goto = line.replace('-> ', '').trim();
      }

      i++;
    }

    this.triggers.set(id, trigger);
    return i;
  }

  /**
   * Calculates the indentation level of a line
   *
   * @param line - The line to measure
   * @returns The number of leading whitespace characters
   */
  private getIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  // ==========================================================================
  // Condition Evaluation
  // ==========================================================================

  /**
   * Evaluates a condition string against the current game state
   *
   * Supported condition formats:
   * - HAS(item) - checks if item is in inventory
   * - NOT HAS(item) - checks if item is NOT in inventory
   * - variable == value - compares variables
   * - variable != value - compares variables
   * - variable > value - numeric comparison
   * - variable < value - numeric comparison
   * - variable >= value - numeric comparison
   * - variable <= value - numeric comparison
   * - variable_name - truthy check
   *
   * @param cond - The condition string to evaluate
   * @returns True if condition is met, false otherwise
   */
  private evaluateCondition(cond: string): boolean {
    cond = cond.trim();
    return this.parseOrExpression(cond);
  }

  private parseOrExpression(cond: string): boolean {
    const parts = this.splitByTopLevelOperator(cond, 'OR');
    if (parts.length > 1) {
      return parts.some(part => this.parseAndExpression(part.trim()));
    }
    return this.parseAndExpression(cond);
  }

  private parseAndExpression(cond: string): boolean {
    const parts = this.splitByTopLevelOperator(cond, 'AND');
    if (parts.length > 1) {
      return parts.every(part => this.parseNotExpression(part.trim()));
    }
    return this.parseNotExpression(cond);
  }

  private parseNotExpression(cond: string): boolean {
    cond = cond.trim();
    
    if (cond.startsWith('NOT ')) {
      return !this.parseNotExpression(cond.slice(4).trim());
    }
    
    if (cond.startsWith('(') && cond.endsWith(')')) {
      const inner = cond.slice(1, -1).trim();
      if (this.isBalancedParentheses(inner)) {
        return this.parseOrExpression(inner);
      }
    }
    
    return this.evaluateSimpleCondition(cond);
  }

  private evaluateSimpleCondition(cond: string): boolean {
    cond = cond.trim();

    // NOT HAS(item)
    if (cond.startsWith('NOT HAS(')) {
      const item = cond.match(/NOT HAS\((\w+)\)/)?.[1];
      return item ? !this.state.inventory.has(item) : false;
    }

    // HAS(item)
    if (cond.startsWith('HAS(')) {
      const item = cond.match(/HAS\((\w+)\)/)?.[1];
      return item ? this.state.inventory.has(item) : false;
    }

    // variable comparisons
    const compMatch = cond.match(/(\w+)\s*(>=|<=|!=|==|=|>|<)\s*(.+)/);
    if (compMatch) {
      const [, varName, op, valStr] = compMatch;
      const left = this.state.flags[varName];
      let right: string | number | boolean = valStr.trim();

      // Parse right side
      if (right === 'true') right = true;
      else if (right === 'false') right = false;
      else if (/^\d+$/.test(right)) right = parseInt(right, 10);

      switch (op) {
        case '=':
        case '==': return left === right;
        case '!=': return left !== right;
        case '>': return (left as number) > (right as number);
        case '<': return (left as number) < (right as number);
        case '>=': return (left as number) >= (right as number);
        case '<=': return (left as number) <= (right as number);
      }
    }

    // Bare variable (truthy check)
    return !!this.state.flags[cond];
  }

  private splitByTopLevelOperator(cond: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let i = 0;

    while (i < cond.length) {
      const char = cond[i];

      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (depth === 0 && cond.slice(i, i + operator.length) === operator && this.isWordBoundary(cond[i - 1]) && this.isWordBoundary(cond[i + operator.length])) {
        parts.push(current);
        current = '';
        i += operator.length;
        continue;
      } else {
        current += char;
      }

      i++;
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  private isWordBoundary(char: string | undefined): boolean {
    if (!char) return true;
    return /\s/.test(char) || char === '(' || char === ')';
  }

  private isBalancedParentheses(s: string): boolean {
    let depth = 0;
    for (const char of s) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth < 0) return false;
    }
    return depth === 0;
  }

  // ==========================================================================
  // Line Execution
  // ==========================================================================

  /**
   * Executes a single StoryScript line and returns its output
   *
   * Handles various line types:
   * - GIVE item - adds item to inventory
   * - SET variable = value - sets game flag
   * - speaker: "text" - dialogue line
   * - speaker (thinks): "text" - internal monologue
   * - "text" - narrative text
   *
   * @param line - The line to execute
   * @param allowPlain - Whether to allow plain text output
   * @returns The output string, or null if no output
   */
  private async executeSingleLine(line: string, allowPlain = false): Promise<string | null> {
    line = line.trim();
    
    // Skip empty and comments
    if (!line || line.startsWith('#')) return null;
    
    // Skip keywords (these are structural, not content)
    if (/^(SCENE|DIALOGUE|TRIGGER|HOTSPOT|DESCRIPTION|ON_ENTER|LOOK|TALK|USE|CHOICE|IF|ELSE|END|REQUIRE|CUTSCENE|AFTER|GAME|ACT_END|STATE_CHECK|TRACK|EXAMINE)\b/.test(line)) {
      return null;
    }
    
    // Skip property lines
    if (/^(location|time|mood|tension|expected_duration|emotional_beat|key_moment|author|act|title|name|summary|next):/.test(line)) {
      return null;
    }
    
    // GIVE item
    if (line.startsWith('GIVE ')) {
      const item = line.replace('GIVE ', '').trim();
      this.state.inventory.add(item);
      if (this.handlers.onGiveItem) this.handlers.onGiveItem(item);
      return `\n✓ [You received: ${item}]\n`;
    }
    
    // SET variable = value
    if (line.startsWith('SET ')) {
      const setMatch = line.match(/SET\s+(\w+)\s*=\s*(.+)/);
      if (setMatch) {
        const [, varName, valStr] = setMatch;
        let value: string | number | boolean = valStr.trim();

        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value, 10);
        else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);

        this.state.flags[varName] = value;
        if (this.handlers.onSetFlag) this.handlers.onSetFlag(varName, value);
      }
      return null;
    }
    
    // Dialogue line: speaker (thinks): "text"
    const thinksMatch = line.match(/^(\w+)\s*\(thinks\):\s*"(.+)"$/);
    if (thinksMatch) {
      const [, speaker, text] = thinksMatch;
      if (this.handlers.onLine) {
        await this.handlers.onLine({ speaker, text, type: 'thought' });
      }
      return `${speaker} (thinks): "${text}"`;
    }
    
    // Dialogue line: speaker: "text"
    const dialogueMatch = line.match(/^(\w+):\s*"(.+)"$/);
    if (dialogueMatch) {
      const [, speaker, text] = dialogueMatch;
      if (this.handlers.onLine) {
        await this.handlers.onLine({ speaker, text, type: 'dialogue' });
      }
      return `${speaker}: "${text}"`;
    }
    
    // Narrative (quoted string)
    if (line.startsWith('"') && line.endsWith('"')) {
      const text = line.slice(1, -1);
      if (this.handlers.onLine) {
        await this.handlers.onLine({ text, type: 'narration' });
      }
      return text;
    }
    
    // Plain narrative text (for descriptions, etc.)
    if (allowPlain && !line.startsWith('>') && !line.startsWith('->')) {
      if (this.handlers.onLine) {
        await this.handlers.onLine({ text: line, type: 'narration' });
      }
      return line;
    }
    
    return null;
  }

  public async executeLines(lines: string[]): Promise<{ output: string[]; goto?: string }> {
    const output: string[] = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Goto
      if (line.startsWith('-> ')) {
        const target = line.replace('-> ', '').trim();
        return { output, goto: target };
      }
      
      // Handle IF blocks
      if (line.startsWith('IF ')) {
        const result = await this.executeIfBlock(lines, i);
        output.push(...result.output);
        if (result.goto) return { output, goto: result.goto };
        i = result.nextIndex;
        continue;
      }
      
      // Handle CHOICE blocks
      if (line === 'CHOICE') {
        const result = await this.executeChoiceBlock(lines, i);
        output.push(...result.output);
        if (result.goto) return { output, goto: result.goto };
        i = result.nextIndex;
        continue;
      }
      
      // Regular line
      const result = await this.executeSingleLine(line);
      if (result) {
        output.push(result);
      }
      
      i++;
    }
    
    return { output };
  }

  private async executeIfBlock(lines: string[], startIndex: number): Promise<{ output: string[]; goto?: string; nextIndex: number }> {
    const condLine = lines[startIndex].trim();
    const condMatch = condLine.match(/^IF\s+(.+)$/);
    const condition = condMatch ? condMatch[1] : '';
    
    const result = this.evaluateCondition(condition);
    
    // Find the matching ELSE/END
    let i = startIndex + 1;
    let depth = 1;
    let elseIndex = -1;
    let endIndex = -1;
    
    while (i < lines.length && depth > 0) {
      const line = lines[i].trim();
      
      if (line.startsWith('IF ')) depth++;
      else if (line === 'ELSE' && depth === 1) elseIndex = i;
      else if (line === 'END') {
        depth--;
        if (depth === 0) endIndex = i;
      }
      
      i++;
    }
    
    if (endIndex === -1) endIndex = lines.length;
    
    // Execute appropriate branch
    let branchLines: string[];
    if (result) {
      const branchEnd = elseIndex !== -1 ? elseIndex : endIndex;
      branchLines = lines.slice(startIndex + 1, branchEnd);
    } else if (elseIndex !== -1) {
      branchLines = lines.slice(elseIndex + 1, endIndex);
    } else {
      branchLines = [];
    }
    
    const execResult = await this.executeLines(branchLines);
    return { ...execResult, nextIndex: endIndex + 1 };
  }

  private async executeChoiceBlock(lines: string[], startIndex: number): Promise<{ output: string[]; goto?: string; nextIndex: number }> {
    const output: string[] = [];
    const choices: { text: string; content: string[] }[] = [];

    let i = startIndex + 1;
    let depth = 1;
    let endIndex = lines.length;

    // Debug: Log what we're parsing
    console.log('[executeChoiceBlock] Starting at line', startIndex, 'depth', depth);
    
    // Parse all choices
    while (i < lines.length && depth > 0) {
      const line = lines[i].trim();
      
      if (line === 'CHOICE') {
        depth++;
        i++;
        continue;
      }
      
      if (line === 'END') {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
        i++;
        continue;
      }
      
      if (line.startsWith('> ') && depth === 1) {
        // Choice option - extract text
        let text = line.slice(2).trim();
        // Handle [bracketed] or "quoted" text
        if (text.startsWith('[') && text.includes(']')) {
          text = text.slice(1, text.indexOf(']'));
        } else if (text.startsWith('"')) {
          text = text.slice(1, text.lastIndexOf('"'));
        }
        
        // Collect content until next choice at depth 1, or END
        const content: string[] = [];
        let j = i + 1;
        let depth = 0; // Track depth of nested CHOICE/END blocks

        while (j < lines.length) {
          const nextLine = lines[j].trim();

          if (nextLine === 'CHOICE') {
            depth++;
          } else if (nextLine === 'END') {
            if (depth > 0) {
              depth--;
            } else {
              break; // End of this CHOICE block
            }
          } else if (nextLine.startsWith('> ') && depth === 0) {
            break; // Next choice option at same level
          }

          content.push(nextLine);
          j++;
        }
        
        console.log('[executeChoiceBlock] Choice option:', text, 'content lines:', content.length);
        choices.push({ text, content });
        i = j;
        continue;
      }
      
      i++;
    }
    
    if (choices.length === 0) {
      return { output, nextIndex: endIndex + 1 };
    }
    
    // Display choices
    output.push('\n--- CHOICES ---');
    choices.forEach((c, idx) => {
      output.push(`  ${idx + 1}. ${c.text}`);
    });
    output.push('');
    
    // Print current output before prompting
    for (const line of output) {
      console.log(line);
    }
    output.length = 0;
    
    // Get user choice
    let choiceNum: number;
    if (this.choiceHandler) {
      choiceNum = await this.choiceHandler(choices);
    } else {
      choiceNum = await this.promptChoice(choices.length);
    }

    if (choiceNum > 0 && choiceNum <= choices.length) {
      const selected = choices[choiceNum - 1];
      console.log('[executeChoiceBlock] Executing choice:', selected.text, 'with', selected.content.length, 'lines');
      const result = await this.executeLines(selected.content);
      output.push(...result.output);
      if (result.goto) return { output, goto: result.goto, nextIndex: endIndex + 1 };
    }
    
    return { output, nextIndex: endIndex + 1 };
  }

  // ==========================================================================
  // REPL & Main Loop
  // ==========================================================================

  private async promptChoice(max: number): Promise<number> {
    return new Promise((resolve) => {
      this.rl!.question(`Choose (1-${max}): `, (answer) => {
        const num = parseInt(answer, 10);
        resolve(isNaN(num) ? 0 : num);
      });
    });
  }

  private async prompt(msg: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl!.question(msg, resolve);
    });
  }

  async run(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n=== StoryScript Interpreter ===\n');
    
    // Enter first scene
    await this.enterScene(this.state.scene);

    // Main REPL loop
    while (true) {
      const input = await this.prompt('\n> ');
      const cmd = input.trim().toLowerCase();
      
      if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') break;
      
      if (cmd === 'help' || cmd === '?') {
        this.showHelp();
        continue;
      }
      
      if (cmd === 'look' || cmd === 'l') {
        await this.enterScene(this.state.scene, true);
        continue;
      }
      
      if (cmd === 'inventory' || cmd === 'inv' || cmd === 'i') {
        this.showInventory();
        continue;
      }
      
      if (cmd === 'hotspots' || cmd === 'h') {
        this.showHotspots();
        continue;
      }
      
      if (cmd === 'state' || cmd === 'debug') {
        this.showState();
        continue;
      }
      
      // Parse commands: look/talk/use <target>
      const cmdMatch = cmd.match(/^(look|talk|use)\s+(.+)$/);
      if (cmdMatch) {
        const [, verb, target] = cmdMatch;
        await this.doAction(verb.toUpperCase() as 'LOOK' | 'TALK' | 'USE', target);
        continue;
      }
      
      // Short form: just target name (default to look)
      const scene = this.scenes.get(this.state.scene);
      if (scene) {
        const hotspot = this.findHotspot(scene, cmd);
        if (hotspot) {
          await this.doAction('LOOK', cmd);
          continue;
        }
      }
      
      console.log('Unknown command. Type "help" for help.');
    }

    this.rl.close();
    console.log('\nGoodbye!');
  }

  private showHelp(): void {
    console.log(`
Commands:
  look, l           - Look around (scene description)
  look <target>     - Look at something
  talk <target>     - Talk to someone/something
  use <target>      - Use something
  hotspots, h       - List available hotspots
  inventory, inv, i - Show inventory
  state, debug      - Show game state
  quit, exit, q     - Exit game
`);
  }

  private showInventory(): void {
    if (this.state.inventory.size === 0) {
      console.log('Inventory is empty.');
    } else {
      console.log('Inventory:', Array.from(this.state.inventory).join(', '));
    }
  }

  private showHotspots(): void {
    const scene = this.scenes.get(this.state.scene);
    if (!scene) return;
    
    console.log('\nHotspots:');
    for (const [id, hotspot] of scene.hotspots) {
      const actions: string[] = [];
      if (hotspot.look.length) actions.push('look');
      if (hotspot.talk.length) actions.push('talk');
      if (hotspot.use.length) actions.push('use');
      console.log(`  ${hotspot.name} [${actions.join(', ')}]`);
    }
  }

  private showState(): void {
    console.log('\n--- Game State ---');
    console.log('Scene:', this.state.scene);
    console.log('Inventory:', Array.from(this.state.inventory));
    console.log('Flags:', this.state.flags);
  }

  public async enterScene(sceneId: string, skipOnEnter = false): Promise<void> {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      console.log(`Scene not found: ${sceneId}`);
      return;
    }

    this.state.scene = sceneId;

    if (this.handlers.onSceneEnter) {
      this.handlers.onSceneEnter(sceneId);
    }

    // Generate scene image in background (opens in browser)
    this.openImageForScene(scene);

    console.log(`\n=== ${scene.location || sceneId} ===\n`);
    
    // Show description (allow plain text)
    for (const line of scene.description) {
      const result = await this.executeSingleLine(line, true);
      if (result) console.log(result);
    }
    
    // Execute on_enter
    if (!skipOnEnter && scene.onEnter.length > 0) {
      console.log('');
      for (const line of scene.onEnter) {
        // Handle -> transitions in ON_ENTER
        if (line.trim().startsWith('->')) {
          const target = line.replace('->', '').trim();
          await this.handleGoto(target);
          continue;
        }
        const result = await this.executeSingleLine(line, true);
        if (result) console.log(result);
      }
    }
  }

  private findHotspot(scene: Scene, target: string): Hotspot | undefined {
    target = target.toLowerCase();
    for (const [id, hotspot] of scene.hotspots) {
      if (id.toLowerCase() === target || 
          hotspot.name.toLowerCase() === target ||
          hotspot.name.toLowerCase().includes(target)) {
        return hotspot;
      }
    }
    return undefined;
  }

  private async doAction(verb: 'LOOK' | 'TALK' | 'USE', target: string): Promise<void> {
    const scene = this.scenes.get(this.state.scene);
    if (!scene) return;
    
    const hotspot = this.findHotspot(scene, target);
    if (!hotspot) {
      console.log(`I don't see "${target}" here.`);
      return;
    }
    
    let content: string[];
    switch (verb) {
      case 'LOOK': content = hotspot.look; break;
      case 'TALK': content = hotspot.talk; break;
      case 'USE': content = hotspot.use; break;
    }
    
    if (content.length === 0) {
      console.log(`I can't ${verb.toLowerCase()} that.`);
      return;
    }
    
    console.log('');
    const result = await this.executeLines(content);
    
    for (const line of result.output) {
      console.log(line);
    }
    
    // Handle goto
    if (result.goto) {
      await this.handleGoto(result.goto);
    }
  }

  public async handleGoto(target: string): Promise<void> {
    if (target === 'END' || target === 'GAME_END') {
      console.log('\n========================================');
      console.log('THE END');
      console.log('========================================\n');
      return;
    }
    
    if (target === 'ACT_END') {
      // End of act
      const currentAct = typeof this.state.flags['current_act'] === 'number'
        ? this.state.flags['current_act']
        : 1;

      // Emit act complete event with current state
      if (this.handlers.onActComplete) {
        this.handlers.onActComplete(currentAct, {
          inventory: Array.from(this.state.inventory),
          flags: { ...this.state.flags },
        });
      }

      console.log('\n' + '='.repeat(50));
      console.log('ACT ' + currentAct + ' COMPLETE');
      console.log('='.repeat(50));
      console.log('\nThe story continues in the next act file...');
      console.log('(End of recorded session)\n');
      return;
    }
    
    if (target === 'GAME_END_TOGETHER') {
      console.log('\n========================================');
      console.log('THE END');
      console.log('========================================');
      console.log('\nShe found her family.');
      console.log('He found his.');
      console.log('Some people belong to the sea.');
      console.log('\nThank you for playing.\n');
      return;
    }
    
    // Check if it's a dialogue
    if (this.dialogues.has(target)) {
      await this.runDialogue(target);
      return;
    }
    
    // Check if it's a trigger
    if (this.triggers.has(target)) {
      await this.runTrigger(target);
      return;
    }
    
    // Check if it's a scene
    if (this.scenes.has(target)) {
      await this.enterScene(target);
      return;
    }
    
    console.log(`[Unknown target: ${target}]`);
  }

  private async runDialogue(dialogueId: string): Promise<void> {
    const dialogue = this.dialogues.get(dialogueId);
    if (!dialogue) return;
    
    if (this.handlers.onDialogueStart) this.handlers.onDialogueStart(dialogueId);

    console.log('');
    const result = await this.executeLines(dialogue.lines);
    
    for (const line of result.output) {
      console.log(line);
    }
    
    if (this.handlers.onDialogueEnd) this.handlers.onDialogueEnd();

    if (result.goto && result.goto !== 'END') {
      await this.handleGoto(result.goto);
    }
  }

  private async runTrigger(triggerId: string): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return;

    // Check requirements
    for (const req of trigger.requirements) {
      if (!this.evaluateCondition(req)) {
        console.log(`[Requirement not met: ${req}]`);
        return;
      }
    }

    // Emit trigger:execute event before trigger content
    if (this.handlers.onTrigger) {
      this.handlers.onTrigger(triggerId);
    }

    // Show cutscene
    if (trigger.cutscene.length > 0) {
      // Call handler if available
      if (this.handlers.onCutscene) {
        await this.handlers.onCutscene(trigger.cutscene);
      }

      // Also print to console for REPL mode
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║            --- CUTSCENE ---              ║');
      console.log('╚══════════════════════════════════════════╝\n');
      for (const line of trigger.cutscene) {
        const result = await this.executeSingleLine(line, true);
        if (result) console.log(result);
      }
      console.log('\n══════════════════════════════════════════════\n');
    }

    // Goto
    if (trigger.goto) {
      await this.handleGoto(trigger.goto);
    }
  }
}


