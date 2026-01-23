# Act 1 Integration Test Spec

## Goal
Verify the engine can play through Shadow Over Innsmouth Act 1 end-to-end.

## Story File
`../../adventures/shadow-over-innsmouth/story/act1.story`

## Critical Path (minimum viable playthrough)

### Scene 1: bus_station
1. Start in bus_station
2. Talk to ticket_window → triggers ticket_clerk_dialogue
3. Select choice to buy ticket → should GIVE bus_ticket
4. Use exit (Bus Platform) → should transition since HAS(bus_ticket)

### Scene 2: bus_interior
1. Arrive in bus_interior
2. Look around, optionally talk to Kat
3. Wait/proceed to arrive in Innsmouth

### Scene 3: innsmouth_square (or similar)
1. Arrive in Innsmouth
2. Find the hotel
3. Talk to clerk → get room_key

### End Condition
- Player has: bus_ticket, room_key
- Player visited: bus_station, bus_interior, innsmouth (arrival scene)

## Test Implementation

Create `src/integration/act1.integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { HeadlessRunner } from '../HeadlessRunner';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Act 1 Integration', () => {
  const storyPath = join(__dirname, '../../../../adventures/shadow-over-innsmouth/story/act1.story');
  const storyContent = readFileSync(storyPath, 'utf-8');

  it('should complete critical path: buy ticket → board bus → arrive Innsmouth → get room key', () => {
    const runner = new HeadlessRunner(storyContent);
    
    const result = runner.run([
      // Scene 1: Buy ticket
      { type: 'assertScene', target: 'bus_station' },
      { type: 'talkTo', target: 'ticket_window' },
      { type: 'selectChoice', value: 0 }, // "One ticket to Innsmouth"
      { type: 'assertInventory', target: 'bus_ticket', value: true },
      
      // Board bus
      { type: 'use', target: 'exit' },
      { type: 'assertScene', target: 'bus_interior' },
      
      // Arrive in Innsmouth (may need to trigger/wait)
      // ... continue based on actual story flow
      
      // Get room key
      // { type: 'talkTo', target: 'hotel_clerk' },
      // { type: 'assertInventory', target: 'room_key', value: true },
    ]);

    expect(result.passed).toBe(true);
    if (!result.passed) {
      console.error('Failures:', result.failures);
    }
  });

  it('should block exit without ticket', () => {
    const runner = new HeadlessRunner(storyContent);
    
    const result = runner.run([
      { type: 'assertScene', target: 'bus_station' },
      { type: 'use', target: 'exit' }, // Should fail - no ticket
      { type: 'assertScene', target: 'bus_station' }, // Still here
    ]);

    expect(result.passed).toBe(true);
  });
});
```

## Notes for Implementation

1. HeadlessRunner needs to handle DIALOGUE choices via `selectChoice`
2. May need to add `waitForScene` or similar for transitions
3. Check actual scene IDs in act1.story (bus_interior, innsmouth_square, etc.)
4. The test should fail first, then we fix engine gaps

## Acceptance Criteria

- [ ] Test loads act1.story without errors
- [ ] Test can buy ticket (dialogue + choice + GIVE)
- [ ] Test can board bus (USE exit with HAS check)
- [ ] Test verifies inventory state
- [ ] Test verifies scene transitions
