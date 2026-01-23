# StoryScript

A minimal language for point-and-click adventures. Direct interpretation — no JSON, no AST.

## Philosophy

- **Token-efficient**: Designed for LLM generation
- **Human-readable**: Writers can edit directly
- **Direct execution**: The format IS the runtime

## Core Blocks

### SCENE

Defines a location. Contains description and hotspots.

```
SCENE bus_station
  location: "Arkham Bus Depot"
  
  DESCRIPTION
    A small-town bus depot. Diesel and stale coffee.
    The clerk looks bored.
  END
  
  ON_ENTER
    hermes (thinks): "This is the place."
  END
  
  HOTSPOT ticket_window
    name: "Ticket Window"
    LOOK
      "Scratched plexiglass."
    END
    TALK
      -> buy_ticket
    END
  END
END
```

### HOTSPOT

Interactive object within a scene. Supports LOOK, TALK, USE.

```
HOTSPOT vending_machine
  name: "Vending Machine"
  bounds: 100,200,50,100
  
  LOOK
    "Out of order. Has been for years."
  END
  
  USE
    IF HAS(coin)
      "It eats your coin. Nothing happens."
    ELSE
      hermes (thinks): "Need a coin."
    END
  END
END
```

### DIALOGUE

Branching conversation. Uses CHOICE for player decisions.

```
DIALOGUE buy_ticket
  clerk: "Help you?"
  
  CHOICE
    > "One ticket to Innsmouth."
      clerk: "Innsmouth? You sure?"
      CHOICE
        > "I'm sure."
          clerk: "Two dollars."
          GIVE bus_ticket
          -> END
        > "What's wrong with it?"
          clerk: "Nothing. Just... nothing."
          -> END
      END
    > "Never mind."
      -> END
  END
END
```

### TRIGGER

Conditional event. Fires when requirements met.

```
TRIGGER bus_boarding
  REQUIRE HAS(bus_ticket)
  REQUIRE AT(bus_station)
  
  CUTSCENE
    The bus idles on the platform.
    hermes (thinks): "Here we go."
  END
  
  -> bus_interior
END
```

## Commands

### GIVE

Adds item to inventory.

```
GIVE flashlight
```

### SET

Sets a flag.

```
SET talked_to_clerk = true
SET suspicion = 3
```

### Transition (->)

Goes to scene, dialogue, or END.

```
-> next_scene
-> some_dialogue
-> END
```

## Conditions

### IF / ELSE

Conditional logic within any block.

```
IF HAS(key)
  "The door opens."
  -> next_room
ELSE
  "Locked."
END
```

### Condition Types

```
HAS(item)           # Player has item
NOT HAS(item)       # Player doesn't have item
AT(scene)           # Player is at scene
flag_name           # Flag is truthy
flag_name = value   # Flag equals value
```

## Text Lines

### Narrative

Plain text is narration.

```
The room is dark.
Something moves in the corner.
```

### Dialogue

Speaker prefix with colon.

```
clerk: "Help you?"
hermes: "One ticket."
```

### Thoughts

Speaker with (thinks) modifier.

```
hermes (thinks): "This doesn't feel right."
```

## Running

```bash
tsx packages/storyscript/src/interpreter.ts adventures/shadow-over-innsmouth/story/act1.story
```

## REPL Commands

```
look              # Scene description
look <target>     # Examine hotspot
talk <target>     # Talk to hotspot
use <target>      # Use hotspot
hotspots          # List hotspots
inventory         # Show inventory
state             # Debug state
quit              # Exit
```
