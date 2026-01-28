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
      -> general_store_scene
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
# ============================================================================
# SHADOW OVER INNSMOUTH - ACT 2: INVESTIGATION
# ============================================================================

GAME
  title: "Shadow over Innsmouth"
  act: 2
  author: "Hermes & Gorka"
END

# ============================================================================
# SCENE 5: HOTEL ROOM - MORNING
# ============================================================================

SCENE hotel_room
  location: "Room 7, Gilman House"
  time: morning
  mood: uneasy

  DESCRIPTION
    A cramped room that smells of salt and mildew.
    The wallpaper peels in long strips.
    Water stains on the ceiling form patterns that almost look deliberate.
    Through the grimy window: fog, and the distant harbor.
  END

  ON_ENTER
    "You didn't sleep well."
    "Dreams of water. Of something calling from below."
    hermes (thinks): "Just a dream."
    hermes (thinks): "Today I find answers."
  END

  HOTSPOT window [50, 150, 100, 120]
    name: "Window"
    LOOK
      "The fog is thinner now. You can see the town."
      "Crumbling buildings. Empty streets."
      "The harbor is busy though. Fishing boats."
      hermes (thinks): "They fish at night. Sleep during the day."
      hermes (thinks): "Nocturnal fishermen. That's... unusual."
    END
  END

  HOTSPOT bed [200, 300, 150, 100]
    name: "Bed"
    LOOK
      "The sheets are damp. They were damp when you got in."
      "You slept on top of the covers."
    END
  END

  HOTSPOT door [400, 200, 60, 150]
    name: "Door"
    LOOK
      "The lock is flimsy. A chair is wedged under the handle."
      "You put it there last night."
      "You don't remember why."
    END
    USE
      "Time to explore this town."
      -> town_square
    END
  END

  HOTSPOT notebook [300, 350, 40, 30]
    name: "Your Notebook"
    LOOK
      "Your research notes."
      "Innsmouth: founded 1643. Population decline after 1846."
      "The Esoteric Order of Dagon — local religious group."
      "Captain Obed Marsh — brought 'prosperity' from the South Seas."
      hermes (thinks): "Everyone I asked about this place got nervous."
      hermes (thinks): "Now I know why."
    END
    USE
      GIVE notebook
      "You pocket the notebook."
    END
  END
END

# ============================================================================
# SCENE 6: TOWN SQUARE
# ============================================================================

SCENE town_square
  location: "Innsmouth Town Square"
  time: morning
  mood: desolate

  DESCRIPTION
    The heart of Innsmouth.
    A dried-up fountain. Boarded storefronts.
    The few people on the street don't look at you.
    They don't look at anything directly.
  END

  ON_ENTER
    IF NOT visited_square
      "The town is worse in daylight."
      "Half the buildings are abandoned. The rest should be."
      "A church dominates the north side. The fish symbol again."
      SET visited_square = true
    END
  END

  HOTSPOT church [300, 50, 120, 150]
    name: "Church of Dagon"
    LOOK
      "The Esoteric Order of Dagon."
      "The doors are closed. Chained, actually."
      "But you can hear something inside. Chanting?"
      hermes (thinks): "Services are at night. Of course they are."
    END
    USE
      "The chains are thick. You're not getting in this way."
      IF HAS(notebook)
        hermes (thinks): "There might be another entrance."
      END
    END
  END

  HOTSPOT grocery [100, 200, 100, 100]
    name: "Grocery Store"
    LOOK
      "One of the few businesses still open."
      "The sign says 'MARSH GROCERY'."
      "Everything in this town is named Marsh."
    END
    USE
      -> grocery_store
    END
  END

  HOTSPOT locals [450, 250, 80, 100]
    name: "Locals"
    LOOK
      "A group of townspeople."
      "They're watching you. Pretending not to."
      "Their features are... off. Wide mouths. Bulging eyes."
      hermes (thinks): "Inbreeding. Small town. That's all it is."
    END
    TALK
      "You approach them."
      "They disperse before you get close."
      "One of them spits on the ground where you were about to step."
    END
  END

  HOTSPOT kat_figure [500, 300, 60, 100]
    name: "Figure in the Distance"
    condition: NOT talked_to_kat_square
    LOOK
      "Someone standing by the old library."
      "Dark hair. Leather jacket."
      hermes (thinks): "The woman from the bus."
    END
    TALK
      -> kat_square_dialogue
    END
  END

  HOTSPOT harbor_road [600, 200, 50, 150]
    name: "Road to Harbor"
    LOOK
      "A road leading down to the waterfront."
      "The smell of fish is stronger from there."
    END
    USE
      -> harbor
    END
  END

  HOTSPOT hotel_direction [50, 200, 50, 150]
    name: "Back to Hotel"
    USE
      -> hotel_lobby_evening
    END
  END

  HOTSPOT library_direction [550, 150, 60, 100]
    name: "Old Library"
    condition: knows_library_entrance
    LOOK
      "The old library. Closed for twenty years."
      "But Kat said there's a way in. Back window."
    END
    USE
      IF knows_library_entrance
        "You slip around back. The window is unlocked, just like she said."
        -> library
      ELSE
        "The doors are chained shut."
      END
    END
  END
END

# ============================================================================
# SCENE 7: GROCERY STORE
# ============================================================================

SCENE grocery_store
  location: "Marsh Grocery"
  time: morning
  mood: tense

  DESCRIPTION
    Dusty shelves. Mostly canned goods.
    The proprietor watches you from behind the counter.
    He has the Innsmouth look. Worse than most.
  END

  ON_ENTER
    "A bell jingles as you enter."
    "The man behind the counter doesn't greet you."
    "He just... watches."
  END

  HOTSPOT proprietor [300, 200, 100, 150]
    name: "Proprietor"
    LOOK
      "He's old. Very old."
      "His neck has ridges. Like gills."
      hermes (thinks): "Skin condition. Has to be."
    END
    TALK
      -> grocery_dialogue
    END
  END

  HOTSPOT shelves [100, 150, 150, 200]
    name: "Shelves"
    LOOK
      "Canned fish. Dried fish. Salted fish."
      "Nothing fresh. Nothing that isn't fish."
      "Except..."
      IF NOT HAS(old_newspaper)
        "There's an old newspaper tucked behind some cans."
      END
    END
    USE
      IF NOT HAS(old_newspaper)
        "You pull out the newspaper."
        "It's from 1927. Headline: 'FEDERAL RAID ON INNSMOUTH'"
        hermes (thinks): "A raid? What did they find?"
        GIVE old_newspaper
      ELSE
        "Just fish."
      END
    END
  END

  HOTSPOT door [50, 200, 50, 150]
    name: "Exit"
    USE
      -> town_square
    END
  END
END

DIALOGUE grocery_dialogue
  proprietor: "..."
  
  CHOICE
    > "I'm researching the history of Innsmouth."
      proprietor: "No history here."
      hermes: "The federal raid in 1927—"
      proprietor: "Get out."
      hermes: "I just want to—"
      proprietor: "GET OUT."
      SET grocery_hostile = true
      -> town_square
    > "Do you know the Marsh family?"
      proprietor: "Everyone's Marsh here."
      hermes: "I mean the original family. Captain Obed—"
      "He reaches under the counter."
      hermes (thinks): "Time to go."
      -> town_square
    > "Never mind."
      -> town_square
  END
END

# ============================================================================
# SCENE 8: HARBOR
# ============================================================================

SCENE harbor
  location: "Innsmouth Harbor"
  time: morning
  mood: ominous

  DESCRIPTION
    Rotting piers. Fishing boats in various states of decay.
    The smell is overwhelming. Not just fish.
    Something else. Something wrong.
    Offshore, through the fog: Devil Reef.
  END

  ON_ENTER
    IF NOT visited_harbor
      "The harbor is busy despite the town being dead."
      "Fishermen work on their boats. They don't look up."
      "They're all... wrong. More wrong than the others."
      hermes (thinks): "The ones who work the water are the worst."
      SET visited_harbor = true
    END
  END

  HOTSPOT devil_reef [400, 50, 150, 100]
    name: "Devil Reef"
    LOOK
      "A rocky outcrop about a mile offshore."
      "Something's on it. Buildings?"
      "No. That can't be right."
      hermes (thinks): "The stories say that's where they come from."
      hermes (thinks): "Where WHAT comes from?"
    END
  END

  HOTSPOT old_drunk [150, 300, 80, 100]
    name: "Old Man"
    condition: NOT talked_to_zadok
    LOOK
      "An old man sitting on a crate."
      "He's different from the others. More human."
      "He's drinking from a bottle."
    END
    TALK
      -> zadok_dialogue
    END
  END

  HOTSPOT fishing_boats [300, 250, 150, 100]
    name: "Fishing Boats"
    LOOK
      "The boats go out at night. Come back at dawn."
      "Their nets are full but..."
      hermes (thinks): "That's not fish."
      "One of the fishermen notices you looking."
      "You look away."
    END
  END

  HOTSPOT town_direction [50, 200, 50, 150]
    name: "Back to Town"
    USE
      -> town_square
    END
  END
END

# ============================================================================
# ZADOK ALLEN - THE DRUNK WHO KNOWS
# ============================================================================

DIALOGUE zadok_dialogue
  "The old man looks up at you."
  "His eyes are clear. Afraid."
  
  zadok: "You're not from here."
  hermes: "No. I'm researching—"
  zadok: "Don't say it out loud."
  
  "He looks around. Terrified."
  
  zadok: "Buy me a drink. Down by the old pier. Sunset."
  zadok: "I'll tell you everything."
  zadok: "Then you run. You hear me? You RUN."
  
  SET zadok_meeting = true
  SET talked_to_zadok = true
  
  hermes (thinks): "Finally. Someone who'll talk."
  hermes (thinks): "But why is he so scared?"
  -> END
END

# ============================================================================
# KAT IN THE SQUARE
# ============================================================================

DIALOGUE kat_square_dialogue
  "You catch up to her by the old library."
  
  kat: "Following me?"
  hermes: "I... no. Well. Maybe."
  
  "She almost smiles. Almost."
  
  kat: "The library's been closed for twenty years."
  hermes: "I noticed."
  kat: "But there's a way in. Around back."
  hermes: "Why are you telling me this?"
  
  "She looks at you. Really looks."
  "For a moment, something passes between you."
  
  kat: "Because you're looking for the same thing I am."
  hermes: "Which is?"
  kat: "The truth about this place."
  
  "She walks away."
  
  kat: "The back window. It's unlocked."
  
  SET talked_to_kat_square = true
  SET knows_library_entrance = true
  
  hermes (thinks): "Who is she?"
  hermes (thinks): "And why do I trust her?"
  -> END
END

# ============================================================================
# SCENE 9: OLD LIBRARY
# ============================================================================

SCENE library
  location: "Innsmouth Public Library"
  time: afternoon
  mood: dusty_secrets

  DESCRIPTION
    Abandoned for decades. Dust everywhere.
    Most books are gone. Or destroyed.
    But some remain. Hidden in the back.
  END

  ON_ENTER
    IF NOT visited_library
      "You climbed through the back window."
      "The library is a tomb of knowledge."
      "Whatever they didn't want people to read is still here."
      SET visited_library = true
    END
  END

  HOTSPOT history_section [150, 150, 100, 150]
    name: "Local History Section"
    LOOK
      "Most shelves are empty."
      "But there's a book hidden behind others."
      "'The Marsh Family: A History'"
      IF NOT HAS(marsh_book)
        hermes (thinks): "This could be useful."
      END
    END
    USE
      IF NOT HAS(marsh_book)
        "You take the book."
        GIVE marsh_book
        "It details Captain Obed Marsh's 'trade' with the South Seas."
        hermes (thinks): "He didn't bring back gold. He brought back... something else."
      ELSE
        "Empty shelves."
      END
    END
  END

  HOTSPOT newspaper_archive [350, 200, 120, 100]
    name: "Newspaper Archive"
    LOOK
      "Stacks of old Innsmouth Couriers."
      "The dates stop in 1928."
      "The year after the federal raid."
    END
    USE
      "You flip through the papers."
      "Headlines about missing persons. Strange lights over Devil Reef."
      "Then: 'GOVERNMENT COVER-UP?' — the last issue."
      hermes (thinks): "They knew. And they were silenced."
      SET read_newspapers = true
    END
  END

  HOTSPOT kat_library [450, 250, 80, 120]
    name: "Kat"
    condition: talked_to_kat_square AND NOT talked_kat_library
    LOOK
      "She's here. Reading something."
      "Her face is pale."
    END
    TALK
      -> kat_library_dialogue
    END
  END

  HOTSPOT window [50, 200, 50, 150]
    name: "Window"
    USE
      -> town_square
    END
  END
END

DIALOGUE kat_library_dialogue
  "She doesn't look up when you approach."
  
  kat: "I found my grandmother's name."
  hermes: "In the town records?"
  
  "She hands you a ledger. Handwritten."
  "Names. Dates. Pairings."
  "Like a stud book for horses."
  
  kat: "They kept track of who had children with who."
  kat: "My grandmother. She's in here. 1904."
  kat: "She got out. Changed her name."
  kat: "My mother never talked about it."
  
  hermes: "Kat..."
  
  kat: "My real name is Katherine. Katherine Marsh."
  
  "She finally looks at you."
  "Her eyes are wet. And something else."
  "A flicker of something gold in her irises."
  
  kat: "I came here to find my family."
  kat: "I think I found more than that."
  
  SET talked_kat_library = true
  SET knows_kat_marsh = true
  
  hermes (thinks): "She's one of them."
  hermes (thinks): "But she didn't know."
  hermes (thinks): "Does it matter?"
  -> END
END

# ============================================================================
# SCENE 10: HOTEL LOBBY - EVENING
# ============================================================================

SCENE hotel_lobby_evening
  location: "Gilman House Hotel"
  time: evening
  mood: paranoid

  DESCRIPTION
    The lobby is darker now.
    The clerk is gone.
    Something is different. Wrong.
    You can hear movement upstairs. Multiple footsteps.
  END

  ON_ENTER
    IF zadok_meeting
      hermes (thinks): "Zadok. Sunset. The old pier."
      hermes (thinks): "But something's wrong here."
    END
    IF NOT noticed_followers
      "You notice them now."
      "Shapes in doorways. Watching."
      "You've been followed all day."
      SET noticed_followers = true
    END
  END

  HOTSPOT stairs [400, 150, 80, 150]
    name: "Stairs"
    LOOK
      "You can hear them up there."
      "In the hallway. Outside your room."
      hermes (thinks): "Don't go up there."
    END
    USE
      "Not yet. You need to meet Zadok first."
      "Then you need to run."
    END
  END

  HOTSPOT front_door [200, 200, 80, 150]
    name: "Front Door"
    LOOK
      "Sunset. The meeting with Zadok."
      "It might be your only chance."
    END
    USE
      IF zadok_meeting
        -> pier_meeting
      ELSE
        -> town_square
      END
    END
  END
END

# ============================================================================
# SCENE 11: THE PIER - ZADOK'S REVELATION
# ============================================================================

SCENE pier_meeting
  location: "Old Pier"
  time: sunset
  mood: revelation

  DESCRIPTION
    The sun bleeds into the ocean.
    Zadok is waiting. Drunk. Terrified.
    He starts talking before you even sit down.
  END

  ON_ENTER
    -> zadok_revelation
  END
END

DIALOGUE zadok_revelation
  zadok: "Obed Marsh. 1838. He sailed to the South Seas."
  zadok: "Found an island. Traded with them."
  
  hermes: "Traded with who?"
  
  zadok: "The Deep Ones."
  
  "He drinks. His hands are shaking."
  
  CHOICE
    > "What are the Deep Ones?"
      zadok: "They live under the water. They don't die."
      zadok: "Fish-men. Or man-fish. Don't matter."
      zadok: "They been there longer than us. Longer than anything."
      -> zadok_part2
    > "What kind of trade?"
      zadok: "Gold. Fish. More than any nets could catch."
      zadok: "In exchange for..."
      "He can't say it."
      -> zadok_part2
  END
END

DIALOGUE zadok_part2
  zadok: "Breeding. They wanted to breed with us."
  
  hermes: "That's insane."
  
  zadok: "Is it? You seen the people here."
  zadok: "The Marsh family first. Then others."
  zadok: "Children look normal at first. Then they change."
  
  hermes: "The Innsmouth look."
  
  zadok: "Now you're getting it."
  
  CHOICE
    > "What happens when they change completely?"
      zadok: "They go to the water. Devil Reef."
      zadok: "That's where they live now. Thousands of 'em."
      -> zadok_part3
    > "And Dagon? The church?"
      zadok: "Father Dagon. Mother Hydra."
      zadok: "They're the old ones. Big as houses."
      zadok: "The church worships them. Has for a hundred years."
      -> zadok_part3
  END
END

DIALOGUE zadok_part3
  "He grabs your arm. His grip is iron."
  
  zadok: "The Marsh girl. The one you've been talking to."
  
  hermes: "Kat?"
  
  zadok: "She's got the blood. Strong blood."
  zadok: "They'll come for her tonight."
  zadok: "And for you, because you know."
  
  "He stands. Stumbles."
  
  zadok: "Run. Both of you. NOW."
  
  "A sound. Splashing. From the water."
  
  zadok: "They're here. Oh god. They're HERE."
  
  SET zadok_told_truth = true
  SET knows_deep_ones = true
  
  "Shapes rise from the harbor."
  "Not human. Not anymore."
  
  -> chase_begins
END

# ============================================================================
# END OF ACT 2
# ============================================================================

ACT_END
  summary: "Hermes learns the truth. The Deep Ones are real. And they're coming."
  next: act3.story
  
  STATE_CHECK
    REQUIRE knows_deep_ones = true
    REQUIRE zadok_told_truth = true
    
    TRACK knows_kat_marsh
    TRACK talked_kat_library
    TRACK HAS(marsh_book)
    TRACK HAS(old_newspaper)
  END
END
# ============================================================================
# SHADOW OVER INNSMOUTH - ACT 3: THE CHASE
# ============================================================================

GAME
  title: "Shadow over Innsmouth"
  act: 3
  author: "Hermes & Gorka"
END

# ============================================================================
# SCENE 12: CHASE BEGINS
# ============================================================================

SCENE chase_begins
  location: "Innsmouth Harbor"
  time: night
  mood: terror

  DESCRIPTION
    They're coming out of the water.
    Dozens of them. Hundreds.
    Shapes that were once human. And shapes that never were.
  END

  ON_ENTER
    "Zadok is gone. Pulled into the dark."
    "You didn't see what took him."
    "You don't want to know."
    hermes (thinks): "Run. He said run."
    hermes (thinks): "Kat. I have to find Kat."
  END

  HOTSPOT town_direction [300, 200, 150, 150]
    name: "Run to Town"
    USE
      "You run."
      "Behind you: wet footsteps. Croaking."
      "Don't look back."
      -> street_chase
    END
  END
END

# ============================================================================
# SCENE 13: STREET CHASE
# ============================================================================

SCENE street_chase
  location: "Innsmouth Streets"
  time: night
  mood: pursuit

  DESCRIPTION
    Dark streets. Darker shapes in doorways.
    They're everywhere. The whole town.
    The whole town is THEM.
  END

  ON_ENTER
    "Every corner: more of them."
    "They're not fast. But they don't stop."
    "They don't get tired."
  END

  HOTSPOT alley [150, 200, 80, 100]
    name: "Alley"
    LOOK
      "A narrow gap between buildings."
      "Too small for the bigger ones."
    END
    USE
      "You squeeze through."
      "Something grabs at you. Misses."
      "You keep running."
      -> church_exterior
    END
  END

  HOTSPOT main_street [400, 200, 100, 100]
    name: "Main Street"
    LOOK
      "Blocked. A wall of them."
      "Croaking. Waiting."
    END
    USE
      "No. Not that way."
    END
  END
END

# ============================================================================
# SCENE 14: CHURCH EXTERIOR
# ============================================================================

SCENE church_exterior
  location: "Church of Dagon"
  time: night
  mood: desperate

  DESCRIPTION
    The church looms above.
    The chains are gone now. Doors open.
    Light flickers inside. Chanting.
  END

  ON_ENTER
    "You see her."
    "Kat. Being led inside."
    "She's not fighting."
    hermes (thinks): "No. NO."
  END

  HOTSPOT church_door [300, 150, 100, 200]
    name: "Church Doors"
    LOOK
      "They took her inside."
      "The chanting is louder now."
    END
    USE
      hermes (thinks): "This is stupid. This is so stupid."
      "You go in anyway."
      -> church_interior
    END
  END

  HOTSPOT hide [100, 300, 80, 80]
    name: "Hide"
    LOOK
      "You could hide. Wait for dawn."
      "Let them have her."
    END
    USE
      hermes (thinks): "No."
      hermes (thinks): "I can't."
      "You go to the church."
      -> church_interior
    END
  END
END

# ============================================================================
# SCENE 15: CHURCH INTERIOR
# ============================================================================

SCENE church_interior
  location: "Inside the Church of Dagon"
  time: night
  mood: nightmare

  DESCRIPTION
    Not a church. A temple.
    The pews are filled with them. Watching.
    At the altar: Kat. And something rising from below.
  END

  ON_ENTER
    "They don't stop you."
    "They want you to see."
    "Kat stands at the altar. Her eyes are gold now."
    "She's not afraid. She's... listening."
    "To something beneath the floor. Beneath the earth."
    "Something vast."
  END

  HOTSPOT kat_altar [300, 150, 100, 150]
    name: "Kat"
    LOOK
      "She's changing. Right in front of you."
      "Her skin ripples. Glistens."
      "But her eyes find yours."
      "She's still in there. Still her."
    END
    TALK
      -> kat_final_dialogue
    END
  END

  HOTSPOT congregation [150, 250, 300, 100]
    name: "The Congregation"
    LOOK
      "Rows of them. Silent now."
      "Waiting for something."
      "Some are barely human. Some aren't at all."
      "In the front row: the hotel clerk. The grocery man."
      "They were watching you the whole time."
    END
  END

  HOTSPOT pit [350, 100, 80, 80]
    name: "The Pit"
    LOOK
      "Behind the altar: an opening."
      "Stairs leading down into water."
      "Something moves in the dark below."
      "Something enormous."
      hermes (thinks): "Dagon."
    END
  END
END

# ============================================================================
# THE FINAL DIALOGUE WITH KAT
# ============================================================================

DIALOGUE kat_final_dialogue
  "You push through them. They let you."
  "You reach her."
  
  hermes: "Kat. We have to go."
  
  "She looks at you. Really looks."
  "THE LOOK. The one you'll remember forever."
  
  kat: "I can hear them, Hermes."
  kat: "My family. They're calling me."
  
  hermes: "That's not your family. Your family is—"
  
  kat: "Dead. Gone. I never belonged up there."
  kat: "I always knew something was wrong with me."
  kat: "Now I know what."
  
  hermes: "Kat, please."
  
  "She touches your face. Her fingers are cold. Webbed."
  
  kat: "You found me. At the end of everything, you found me."
  kat: "That matters. Remember that it mattered."
  
  hermes: "I'm not leaving without you."
  
  kat: "Yes. You are."
  
  "She pushes you. Hard."
  "The congregation parts. A path to the door."
  
  kat: "Go. While they let you."
  kat: "I'm buying you this. Don't waste it."
  
  SET the_look = true
  SET kat_goodbye = true
  
  -> church_escape
END

# ============================================================================
# SCENE 16: ESCAPE
# ============================================================================

SCENE church_escape
  location: "Innsmouth Streets"
  time: night
  mood: flight

  DESCRIPTION
    You run.
    They don't follow.
    She bought you this. Don't waste it.
  END

  ON_ENTER
    "Your legs burn. Your lungs burn."
    "But you keep running."
    "Past the hotel. Past the square."
    "Toward the road out of town."
    hermes (thinks): "I could go back."
    hermes (thinks): "I should go back."
    "But you don't."
    "Because she told you not to."
  END

  HOTSPOT road [400, 200, 150, 100]
    name: "Road Out"
    LOOK
      "The road to Arkham."
      "To the real world."
      "To forgetting."
    END
    USE
      -> escape_road
    END
  END

  HOTSPOT back [100, 200, 100, 100]
    name: "Go Back"
    LOOK
      hermes (thinks): "I could try."
      hermes (thinks): "I could save her."
    END
    USE
      hermes (thinks): "No. She made her choice."
      hermes (thinks): "And she made mine."
      "You turn toward the road."
      -> escape_road
    END
  END
END

SCENE escape_road
  location: "The Road to Arkham"
  time: dawn
  mood: hollow_victory

  DESCRIPTION
    Dawn breaks as you reach the town limits.
    Behind you: Innsmouth. Silent now.
    Ahead: the rest of your life.
  END

  ON_ENTER
    "You walk until you can't see the town anymore."
    "Then you keep walking."
    "A truck stops. A farmer. Going to Arkham."
    farmer: "You look like hell, son."
    hermes: "Yeah."
    farmer: "Innsmouth?"
    "You don't answer."
    farmer: "Don't talk about it. No one does."
    "You get in the truck."
    "You don't look back."
  END

  HOTSPOT truck [300, 250, 150, 100]
    name: "Get In"
    USE
      -> act3_end
    END
  END
END

SCENE act3_end
  location: "Truck to Arkham"
  time: morning
  mood: numb

  ON_ENTER
    "The farmer doesn't ask questions."
    "You watch the fields go by."
    "Normal fields. Normal sky."
    "None of it feels real anymore."
    hermes (thinks): "I left her."
    hermes (thinks): "She told me to."
    hermes (thinks): "That doesn't make it better."
    -> ACT_END
  END
END

# ============================================================================
# END OF ACT 3
# ============================================================================

ACT_END
  summary: "Hermes escapes. Kat stays behind. The choice was made for him."
  next: act4.story
  
  STATE_CHECK
    REQUIRE the_look = true
    REQUIRE kat_goodbye = true
  END
END
# ============================================================================
# SHADOW OVER INNSMOUTH - ACT 4: THE SEA
# ============================================================================

GAME
  title: "Shadow over Innsmouth"
  act: 4
  author: "Hermes & Gorka"
END

# ============================================================================
# SCENE 17: ONE YEAR LATER
# ============================================================================

SCENE one_year_later
  location: "Hermes's Apartment, Boston"
  time: night
  mood: haunted

  DESCRIPTION
    A small apartment. Books everywhere.
    Research you'll never publish.
    A bottle on the desk. Mostly empty.
  END

  ON_ENTER
    "One year."
    "You told no one. Who would believe you?"
    "The government raid in '28 proved it was real."
    "But they covered it up. Called it 'bootleggers.'"
    "Bootleggers with gills."
    hermes (thinks): "I dream about her."
    hermes (thinks): "Every night. The same dream."
    hermes (thinks): "She's calling me."
  END

  HOTSPOT desk [200, 250, 150, 100]
    name: "Desk"
    LOOK
      "Research notes. Newspaper clippings."
      "A map of the Massachusetts coast."
      "Innsmouth is circled. So is another location."
      "A beach. Thirty miles north."
    END
  END

  HOTSPOT window [400, 150, 100, 150]
    name: "Window"
    LOOK
      "The city lights."
      "Normal people living normal lives."
      hermes (thinks): "That used to be me."
    END
  END

  HOTSPOT bed [100, 300, 100, 80]
    name: "Bed"
    LOOK
      "You don't sleep much anymore."
      "When you do, you dream of water."
    END
    USE
      "You lie down."
      "Close your eyes."
      "And you're there again."
      -> the_dream
    END
  END
END

# ============================================================================
# SCENE 18: THE DREAM
# ============================================================================

SCENE the_dream
  location: "The Dream"
  time: none
  mood: otherworldly

  DESCRIPTION
    Underwater. But you can breathe.
    A city of impossible geometry.
    Spires of coral and bone.
    And she's there. Waiting.
  END

  ON_ENTER
    "The dream is always the same."
    "She's standing at the edge of the city."
    "Half-transformed. Beautiful in a way that hurts."
    "She speaks. Not with words."
  END

  HOTSPOT kat_dream [300, 200, 100, 150]
    name: "Kat"
    LOOK
      "She looks... peaceful."
      "For the first time since you met her."
      "Like she finally belongs somewhere."
    END
    TALK
      -> dream_dialogue
    END
  END
END

DIALOGUE dream_dialogue
  kat: "You came."
  hermes: "I always come. I can't stop."
  
  kat: "I know."
  kat: "I'm sorry. I didn't mean to call you."
  kat: "It just... happens."
  
  hermes: "Are you okay?"
  
  "She laughs. Bubbles rise from her mouth."
  
  kat: "I'm more okay than I've ever been."
  kat: "This is what I was meant for."
  kat: "I just didn't know it."
  
  hermes: "I miss you."
  
  kat: "I know."
  kat: "I miss you too. The human part of me."
  kat: "It's still there. Smaller every day."
  kat: "But it remembers you."
  
  "She touches your face. The way she did in the church."
  
  kat: "Come to the beach. Tomorrow night."
  kat: "I want to see you. One last time."
  kat: "Before I forget how."
  
  SET beach_call = true
  
  "You wake up."
  "Your pillow is wet. Seawater."
  hermes (thinks): "Tomorrow night."
  
  -> one_year_later_morning
END

# ============================================================================
# SCENE 19: MORNING AFTER
# ============================================================================

SCENE one_year_later_morning
  location: "Hermes's Apartment, Boston"
  time: morning
  mood: decision

  DESCRIPTION
    Daylight makes everything seem less real.
    But the salt on your pillow doesn't lie.
    She's calling you.
    The question is whether you'll answer.
  END

  ON_ENTER
    hermes (thinks): "I could ignore it."
    hermes (thinks): "Stay here. Keep pretending."
    hermes (thinks): "Or I could see her one more time."
  END

  HOTSPOT door [50, 200, 60, 150]
    name: "Front Door"
    LOOK
      "The world is out there."
      "Normal and safe and boring."
    END
    USE
      hermes (thinks): "I can't live like this anymore."
      hermes (thinks): "I have to see her."
      hermes (thinks): "Even if it's the last time."
      -> drive_to_beach
    END
  END
END

# ============================================================================
# SCENE 20: THE BEACH
# ============================================================================

SCENE drive_to_beach
  location: "Coastal Road"
  time: sunset
  mood: inevitable

  DESCRIPTION
    You drive north.
    Past towns that don't know what's under the water.
    Past lives that will never intersect with yours.
  END

  ON_ENTER
    "You find the beach as the sun sets."
    "Empty. Desolate. Perfect."
    "You wait."
    -> the_beach
  END
END

SCENE the_beach
  location: "The Beach"
  time: night
  mood: farewell

  DESCRIPTION
    Waves on rocks. Moon on water.
    You've been here for hours.
    Then: a shape in the surf.
    She's here.
  END

  ON_ENTER
    "She rises from the water."
    "Changed. More than in the dream."
    "Scales where there was skin. Gills on her neck."
    "But her eyes. Her eyes are still hers."
    "Still gold. Still sad. Still human enough."
  END

  HOTSPOT kat_beach [300, 200, 100, 200]
    name: "Kat"
    LOOK
      "She's beautiful."
      "Not human-beautiful. Something else."
      "Something ancient. Something true."
    END
    TALK
      -> final_conversation
    END
  END

  HOTSPOT water [100, 300, 400, 100]
    name: "The Water"
    LOOK
      "Black water. Endless."
      "Things move beneath the surface."
      "Her family. Her people."
      "Waiting."
    END
  END
END

# ============================================================================
# THE FINAL CONVERSATION
# ============================================================================

DIALOGUE final_conversation
  "She walks up the beach toward you."
  "Stops just out of reach."
  
  kat: "You came."
  hermes: "I had to."
  
  kat: "I know. I'm sorry."
  kat: "I shouldn't have called. But I..."
  
  "She struggles. Words are harder for her now."
  
  kat: "I wanted you to see. Before I go."
  hermes: "Go where?"
  
  kat: "Deeper. There are cities down there, Hermes."
  kat: "Older than anything on land."
  kat: "I've seen them. I belong there."
  
  hermes: "Kat—"
  
  kat: "My name isn't Kat anymore."
  kat: "I don't think it ever was."
  
  "She looks at you. THE LOOK again."
  "The same one from the church."
  "The one that says: I see you. All of you."
  
  kat: "You could come with me."
  
  CHOICE
    > "I can't."
      hermes: "I can't. I'm not like you."
      
      kat: "No. You're not."
      kat: "You're exactly what you're supposed to be."
      kat: "That's why I loved you."
      
      hermes: "Loved?"
      
      kat: "Love. Present tense."
      kat: "I'll always love you."
      kat: "Even when I forget what love means."
      
      -> the_end
      
    > "I wish I could."
      hermes: "I wish I could."
      
      kat: "I know."
      kat: "Part of me hoped..."
      kat: "But no. You belong up here."
      kat: "In the light. Where things make sense."
      
      hermes: "Nothing makes sense anymore."
      
      kat: "It will. Eventually."
      kat: "You'll forget me. That's okay."
      kat: "I want you to forget."
      
      -> the_end
      
    > "Take me with you."
      hermes: "Take me with you."
      
      "She stops. Turns."
      "Her eyes search yours."
      
      kat: "You don't know what you're asking."
      
      hermes: "I know exactly what I'm asking."
      hermes: "I've known since the bus."
      hermes: "Since you didn't smile at my bad joke."
      
      "She laughs. A strange, wet sound."
      
      kat: "You'd drown."
      
      hermes: "Maybe. Maybe not."
      hermes: "Either way, I'm not watching you walk away."
      
      "She takes your hand."
      "Her skin is cold. Scaled."
      "It doesn't matter."
      
      kat: "You're insane."
      
      hermes: "Probably."
      
      -> the_end_together
  END
END

# ============================================================================
# SCENE 21: THE END
# ============================================================================

SCENE the_end
  location: "The Beach"
  time: night
  mood: loss

  DESCRIPTION
    She turns toward the water.
    You know what happens next.
    You knew it the moment you met her.
  END

  ON_ENTER
    "She walks toward the sea."
    "Each step taking her further from you."
    "From everything human."
  END

  HOTSPOT kat_walking [250, 200, 100, 150]
    name: "Kat"
    LOOK
      "She's almost to the water."
      "Don't watch. Watch. It doesn't matter."
      "This is happening either way."
    END
    TALK
      -> kat_walks_into_sea
    END
  END
END

DIALOGUE kat_walks_into_sea
  hermes: "KAT!"
  
  "She stops. Turns."
  "One last look."
  
  kat: "Thank you."
  kat: "For seeing me."
  kat: "The real me."
  kat: "Even the parts I was afraid of."
  
  hermes: "Kat, please—"
  
  kat: "Goodbye, Hermes."
  
  "She walks into the water."
  "Doesn't look back."
  "The waves close over her head."
  "For a moment, you see her shape beneath the surface."
  "Then she's gone."
  
  "You stand on the beach until dawn."
  "Waiting for something that won't happen."
  "She's not coming back."
  "She was never going to."
  
  "You knew that."
  "You came anyway."
  "That's what love is."
  "Showing up even when you know how it ends."
  
  -> epilogue
END

# ============================================================================
# ALTERNATE ENDING - INTO THE SEA TOGETHER
# ============================================================================

SCENE the_end_together
  location: "The Water"
  time: night
  mood: surrender

  ON_ENTER
    "You walk into the sea together."
    "The water is cold. Then it isn't."
    "She's right beside you."
    "The waves close over your head."
    ""
    "You should drown."
    "You don't."
    ""
    "There's a city down there."
    "Lights in the deep."
    "And something vast, watching."
    "Waiting."
    ""
    "Kat squeezes your hand."
    "You squeeze back."
    ""
    "The surface gets further away."
    "You don't look up."
    ""
    "Some love stories end in the light."
    "This one doesn't."
    "That's okay too."
    -> GAME_END_TOGETHER
  END
END

SCENE GAME_END_TOGETHER
  ON_ENTER
    ""
    "S H A D O W   O V E R   I N N S M O U T H"
    ""
    "THE END"
    ""
    "She found her family."
    "He found his."
    "Some people belong to the sea."
    ""
    "Thank you for playing."
  END
END

# ============================================================================
# EPILOGUE
# ============================================================================

SCENE epilogue
  location: "The Beach"
  time: dawn
  mood: aftermath

  DESCRIPTION
    Dawn breaks.
    The sea is calm.
    Empty.
    Like nothing happened.
  END

  ON_ENTER
    "You drive home."
    "You don't tell anyone."
    "Who would believe you?"
    ""
    "Years later, you'll still dream of her."
    "Swimming through impossible cities."
    "Happy, in a way she never was on land."
    ""
    "Sometimes, when you're near the ocean,"
    "you think you hear her voice."
    "Calling you."
    ""
    "You never answer."
    ""
    "But you always listen."
  END

  HOTSPOT end [300, 300, 100, 50]
    name: "The End"
    USE
      -> GAME_END
    END
  END
END

SCENE GAME_END
  ON_ENTER
    ""
    "S H A D O W   O V E R   I N N S M O U T H"
    ""
    "THE END"
    ""
    "She found her family."
    "He found his heart."
    "The sea keeps its secrets."
    ""
    "Thank you for playing."
  END
END

# ============================================================================
# THE END
# ============================================================================

ACT_END
  summary: "Kat walks into the sea. Hermes watches. Some love stories don't have happy endings."
  credits: true
END
