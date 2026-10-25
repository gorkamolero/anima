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

  HOTSPOT harbor_boat [550, 350, 110, 70]
    name: "Abel's Boat — Devil Reef"
    LOOK
      "A boat waits at the harbor. One more chance to find her."
    END
    USE
      -> devil_reef_approach
    END
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
