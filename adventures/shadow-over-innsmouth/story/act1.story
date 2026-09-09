# Shadow Over Innsmouth — Act 1: Arrival
# StoryScript format v0.1

GAME "Shadow Over Innsmouth"
  author: "Ajna Games"
  act: 1
  title: "Arrival"

# ============================================================================
# SCENE 1: BUS STATION
# ============================================================================

SCENE bus_station
  location: "Arkham Bus Depot"
  time: morning
  mood: mundane_unease
  tension: 2/10
  expected_duration: 5 minutes
  emotional_beat: "curiosity, first warnings"

  DESCRIPTION
    A small-town bus depot. Diesel and stale coffee.
    Fluorescent lights hum and flicker.
    A hand-written schedule lists two destinations: BOSTON and INNSMOUTH.
    The clerk looks like he's been here for thirty years.
  END

  ON_ENTER
    hermes (thinks): "Innsmouth. The town nobody talks about."
    hermes (thinks): "Every folklorist I asked changed the subject."
    hermes (thinks): "That's exactly why I'm here."
  END

  HOTSPOT ticket_window [120, 200, 80, 100]
    name: "Ticket Window"
    LOOK
      "Scratched plexiglass. A faded schedule."
      "Someone scratched 'DONT GO' into the counter."
      hermes (thinks): "Charming."
    END
    TALK
      -> ticket_clerk_dialogue
    END
  END

  HOTSPOT schedule_board [300, 100, 100, 60]
    name: "Schedule Board"
    LOOK
      "BOSTON — 8:00 AM, 12:00 PM, 4:00 PM, 8:00 PM"
      "INNSMOUTH — 10:00 AM, 6:00 PM"
      hermes (thinks): "Only two buses a day. And the last one back is at 4."
      hermes (thinks): "I'll have to stay overnight."
    END
  END

  HOTSPOT bench [400, 300, 150, 80]
    name: "Waiting Bench"
    LOOK
      "A young woman sits alone, away from everyone else."
      "Dark hair, leather jacket, headphones."
      "She's staring out the window at nothing."
      hermes (thinks): "Wonder where she's going."
    END
    TALK
      "She doesn't hear you. Or pretends not to."
      "The music bleeding from her headphones sounds like static."
    END
  END

  HOTSPOT vending_machine [50, 300, 60, 120]
    name: "Vending Machine"
    LOOK
      "Coffee, soda, and something called 'Fish Crackers.'"
      "The fish crackers are sold out."
    END
    USE
      "I'm not hungry. Or thirsty. Just anxious."
    END
  END

  HOTSPOT exit [600, 250, 50, 150]
    name: "Bus Platform"
    USE
      IF NOT HAS(bus_ticket)
        hermes (thinks): "I should get my ticket first."
      ELSE
        -> bus_boarding
      END
    END
  END
END

# ----------------------------------------------------------------------------

DIALOGUE ticket_clerk_dialogue
  clerk: "Help you?"
  
  CHOICE
    > "One ticket to Innsmouth, please."
      clerk: "..."
      clerk: "Innsmouth?"
      clerk: "You sure about that?"
      CHOICE
        > "I'm sure. Just the ticket."
          "He shrugs. Pushes the ticket across."
          clerk: "Two dollars. Bus leaves in ten."
          GIVE bus_ticket
          hermes (thinks): "Everyone has the same reaction."
          -> END
        > "Why does everyone keep saying that?"
          clerk: "Saying what?"
          hermes: "Acting like Innsmouth is... I don't know. Cursed."
          clerk: "..."
          clerk: "I didn't say nothing."
          clerk: "Two dollars."
          GIVE bus_ticket
          SET clerk_warned = true
          hermes (thinks): "He knows something."
          -> END
        > "What's wrong with Innsmouth?"
          clerk: "Nothing. Nice town. Good fishing."
          clerk: "Folks just keep to themselves, is all."
          hermes: "But?"
          clerk: "No buts. Two dollars for the ticket."
          GIVE bus_ticket
          SET clerk_suspicious = true
          -> END
      END
    > "What can you tell me about Innsmouth?"
      clerk: "It's a town. Up the coast."
      clerk: "Used to be big in shipping. Gold refinery."
      clerk: "Quiet now."
      hermes: "I heard there was some trouble there. Years back."
      clerk: "Wouldn't know about that."
      clerk: "You buying a ticket or not?"
      -> ticket_clerk_dialogue
    > "Never mind."
      clerk: "Suit yourself."
      -> END
  END
END

# ----------------------------------------------------------------------------

TRIGGER bus_boarding
  REQUIRE HAS(bus_ticket)
  
  CUTSCENE
    "The bus to Innsmouth idles on the platform."
    "It's older than the others. Dirtier."
    "The driver watches you approach. He doesn't blink."
    hermes (thinks): "Here we go."
  END
  
  -> bus_interior
END

# ============================================================================
# SCENE 2: BUS INTERIOR
# ============================================================================

SCENE bus_interior
  location: "Bus to Innsmouth"
  time: morning
  mood: confined_tension
  tension: 3/10
  expected_duration: 4 minutes
  emotional_beat: "isolation, Kat introduction, driver's wrongness"

  DESCRIPTION
    The bus smells of salt and mildew.
    Most seats are empty. The upholstery is stained.
    The woman from the depot sits near the back.
    The driver hasn't stopped staring at the road.
  END

  ON_ENTER
    "You find a seat in the middle."
    "The bus lurches forward."
    "Through the dirty window, Arkham disappears behind you."
  END

  HOTSPOT driver [100, 150, 80, 100]
    name: "Bus Driver"
    LOOK
      "Joe Sargent, according to his badge."
      "Narrow face. Bulging eyes. Skin that looks... damp."
      hermes (thinks): "He hasn't blinked once."
      hermes (thinks): "Maybe it's a medical condition."
    END
    TALK
      hermes: "Nice day for a drive."
      "The driver grunts. Doesn't turn around."
      hermes: "...Okay then."
    END
  END

  HOTSPOT kat [450, 280, 100, 80]
    name: "Woman in Back"
    LOOK
      "She's taken her headphones off. Staring out the window."
      "Dark circles under her eyes. Like she hasn't slept."
      "There's something familiar about her face."
      hermes (thinks): "We're the only passengers."
      hermes (thinks): "Both going to the same place nobody goes."
    END
    TALK
      -> kat_bus_dialogue
    END
  END

  HOTSPOT window [300, 200, 150, 100]
    name: "Window"
    LOOK
      IF NOT looked_at_window
        "Farmland. Stone walls. Normal New England."
        "The further north, the emptier it gets."
        SET looked_at_window = true
      ELSE
        "Salt marsh now. Fog rolling in."
        "I can smell the sea. Something rotting underneath."
        hermes (thinks): "That smell. Like dead fish left in the sun."
      END
    END
  END

  HOTSPOT your_bag [350, 350, 60, 40]
    name: "Your Bag"
    LOOK
      "Your research satchel. Notebook, camera, reference books."
      "Everything you need to document folklore."
      hermes (thinks): "If there's anything left to document."
    END
  END

  HOTSPOT rest [250, 320, 80, 60]
    name: "Close Your Eyes"
    USE
      IF NOT talked_to_kat_bus
        "You should talk to her first."
        "It's a long ride."
      ELSE
        "You close your eyes."
        "The bus rocks. The engine drones."
        "You don't sleep. But time passes."
        -> bus_arrives
      END
    END
  END
END

# ----------------------------------------------------------------------------

DIALOGUE kat_bus_dialogue
  IF talked_to_kat_bus
    "She's got her headphones back in."
    "The conversation's over."
    -> END
  END
  
  hermes: "Heading to Innsmouth too?"
  
  kat: "..."
  kat: "No, I'm on this bus for the scenic route."
  
  hermes (thinks): "Okay. Not friendly."
  
  CHOICE
    > "Sorry. Just making conversation."
      kat: "Don't."
      SET talked_to_kat_bus = true
      SET kat_impression = cold
      -> END
    > "Business or pleasure?"
      kat: "What?"
      hermes: "The trip. Business or pleasure?"
      kat: "..."
      kat: "Family."
      hermes: "You have family in Innsmouth?"
      kat: "Maybe. That's what I'm finding out."
      SET talked_to_kat_bus = true
      SET kat_impression = curious
      SET kat_revealed_family = true
      -> END
    > "I'm Hermes, by the way."
      kat: "..."
      kat: "Good for you."
      SET talked_to_kat_bus = true
      SET kat_impression = cold
      -> END
  END
END

# ----------------------------------------------------------------------------

TRIGGER bus_arrives
  REQUIRE talked_to_kat_bus
  
  CUTSCENE
    "You open your eyes."
    "The landscape has changed. Fog everywhere."
    "The bus slows."
    "Through the murk, shapes emerge. Buildings."
    "Old buildings. Crooked. Leaning toward the water."
    driver: "Innsmouth."
    "The driver's voice is wet. Gurgling."
    driver: "Last stop."
    "The woman stands. Already at the door."
    "She doesn't look back."
    hermes (thinks): "Here we go."
  END
  
  -> innsmouth_streets
END

# ============================================================================
# SCENE 3: INNSMOUTH STREETS
# ============================================================================

SCENE innsmouth_streets
  location: "Innsmouth — Main Street"
  time: afternoon
  mood: wrong
  tension: 4/10
  expected_duration: 6 minutes
  emotional_beat: "wrongness, exploration, dread"

  DESCRIPTION
    The town is dying. You can smell it.
    Salt and rot and something else. Fish, but not fresh.
    Buildings lean at angles that shouldn't be possible.
    The few people on the street stop and stare as you pass.
  END

  ON_ENTER
    "The bus pulls away. You're alone."
    hermes (thinks): "Where did she go?"
    "The woman from the bus has vanished into the fog."
    hermes (thinks): "Okay. Hotel first. Then research."
    hermes (thinks): "This place..."
    hermes (thinks): "Something is very wrong here."
  END

  HOTSPOT street_people [200, 300, 100, 60]
    name: "Locals"
    LOOK
      "They stand in doorways. Watching."
      "Their faces are... wrong."
      "Not deformed, exactly. But wrong."
      "Too narrow. Eyes too far apart. Skin too shiny."
      hermes (thinks): "Inbreeding? Or something else?"
    END
    TALK
      "You approach. They retreat into shadows."
      "Nobody wants to talk."
    END
  END

  HOTSPOT general_store [100, 200, 80, 100]
    name: "General Store"
    LOOK
      "Barnaby's General Goods"
      "Looks closed. But you can see movement inside."
    END
    USE
      -> grocery_store
    END
  END

  HOTSPOT church [400, 150, 100, 120]
    name: "Church"
    LOOK
      "Not a normal church."
      "The steeple has been modified. The cross is gone."
      "In its place: something that looks like a fish."
      "A sign reads: ESOTERIC ORDER OF DAGON"
      hermes (thinks): "Dagon. That's Mesopotamian. Fish god."
      hermes (thinks): "What's it doing in Massachusetts?"
    END
    USE
      "The doors are locked. Heavy. Iron."
      "You can hear chanting inside. Low. Rhythmic."
      hermes (thinks): "I'll come back."
    END
  END

  HOTSPOT hotel_sign [550, 200, 80, 40]
    name: "Hotel Sign"
    LOOK
      "A weathered sign: GILMAN HOUSE"
      "Looks like the only hotel in town."
      "A light flickers in the window."
    END
  END

  HOTSPOT hotel_entrance [550, 280, 70, 100]
    name: "Gilman House Entrance"
    USE
      -> hotel_lobby
    END
  END

  HOTSPOT waterfront_road [650, 350, 50, 80]
    name: "Road to Waterfront"
    LOOK
      "The road slopes down toward the harbor."
      "The fog is thicker there. You can hear the water."
    END
    USE
      "Later. I should find a place to stay first."
    END
  END
END

# ============================================================================
# SCENE 4: HOTEL LOBBY
# ============================================================================

SCENE hotel_lobby
  location: "Gilman House — Lobby"
  time: afternoon
  mood: oppressive
  tension: 5/10
  expected_duration: 5 minutes
  emotional_beat: "Kat glimpse, unease, trapped feeling"
  key_moment: "First real look at Kat"

  DESCRIPTION
    The lobby smells of mildew and something else.
    Low tide, maybe. Seaweed.
    A single desk lamp flickers. The wallpaper is peeling.
    Fish motifs everywhere. On the walls. The carpet. The lamp.
  END

  ON_ENTER
    "You push through the heavy door."
    "At the front desk, a woman is just turning away."
    "Dark hair. Leather jacket. It's her."
    "She takes her room key and heads for the stairs."
    "For just a moment, she glances back."
    "Your eyes meet."
    "Then she's gone."
    hermes (thinks): "..."
    hermes (thinks): "What was that look?"
  END

  HOTSPOT front_desk [300, 250, 100, 80]
    name: "Front Desk"
    LOOK
      "Old wood, water-stained."
      "A bell. A guest book. A clerk who pretends not to see you."
    END
    TALK
      -> hotel_clerk_dialogue
    END
  END

  HOTSPOT guest_book [320, 240, 40, 20]
    name: "Guest Book"
    LOOK
      "Names. Dates. Most are smudged."
      "You see your name at the bottom: not yet signed."
      "Above it, fresh ink: 'K. Marsh'"
      hermes (thinks): "Marsh. Where have I heard that name?"
      SET saw_kat_name = true
    END
  END

  HOTSPOT stairs [500, 200, 80, 150]
    name: "Stairs"
    LOOK
      "Creaking stairs leading up into darkness."
      "You can hear footsteps above. Then a door closing."
    END
    USE
      IF NOT HAS(room_key)
        "I should check in first."
      ELSE
        -> hotel_room
      END
    END
  END

  HOTSPOT lobby_window [100, 200, 80, 100]
    name: "Window"
    LOOK
      "The fog has thickened."
      "Through it, you can just see the harbor."
      "Something moves in the water."
      "Probably just a boat."
      hermes (thinks): "Probably."
    END
  END
END

# ----------------------------------------------------------------------------

DIALOGUE hotel_clerk_dialogue
  "The clerk looks up. Slowly."
  "His eyes are too large. His skin glistens."
  
  clerk: "...Help you?"
  
  CHOICE
    > "I need a room for the night."
      clerk: "..."
      clerk: "Room seven. Top floor."
      clerk: "Two dollars."
      CHOICE
        > [Pay for the room]
          "You hand over the money."
          "His fingers are cold. And webbed?"
          hermes (thinks): "No. That's not... I imagined that."
          GIVE room_key
          clerk: "Breakfast is at seven. If you're still here."
          hermes: "If I'm still here?"
          clerk: "Check-out is at eleven."
          hermes (thinks): "That's not what he meant."
          SET hotel_checked_in = true
          -> END
        > "What did you mean, 'if I'm still here'?"
          clerk: "Check-out. Eleven AM."
          clerk: "Two dollars."
          GIVE room_key
          SET hotel_checked_in = true
          SET clerk_suspicious = true
          -> END
      END
    > "Who was that woman? The one who just left?"
      clerk: "Guest."
      hermes: "Do you know her name?"
      clerk: "..."
      clerk: "You want a room or not?"
      -> hotel_clerk_dialogue
    > "What can you tell me about this town?"
      clerk: "It's a town."
      hermes: "The church with the fish symbol—"
      clerk: "You want a room?"
      hermes (thinks): "Not a talker."
      -> hotel_clerk_dialogue
  END
END

# ============================================================================
# SCENE: HOTEL ROOM
# ============================================================================

SCENE hotel_room
  location: "Room 7, Gilman House"
  time: night
  mood: uneasy

  DESCRIPTION
    A cramped room at the top of the stairs.
    Peeling wallpaper. Water stains on the ceiling.
    The bed looks damp. Everything smells of the sea.
  END

  ON_ENTER
    "You lock the door. Wedge a chair under the handle."
    "Through the grimy window: fog, and distant lights on the water."
    "Devil Reef?"
    hermes (thinks): "Tomorrow. I'll find answers tomorrow."
    hermes (thinks): "For now... sleep."
    "You don't undress. You don't trust this place."
    "You lie on top of the covers and close your eyes."
    "The sea whispers outside."
    "Eventually, you sleep."
    -> ACT_END
  END
END

# ============================================================================
# END OF ACT 1
# ============================================================================

ACT_END
  summary: "Hermes arrives in Innsmouth. Everything is wrong."
  next: act2.story
  
  STATE_CHECK
    # Required for Act 2
    REQUIRE hotel_checked_in = true
    REQUIRE HAS(room_key)
    
    # Optional state that affects Act 2
    TRACK saw_kat_name
    TRACK kat_revealed_family
    TRACK kat_impression
    TRACK clerk_warned
    TRACK clerk_suspicious
  END
END
