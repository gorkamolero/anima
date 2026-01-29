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
  
  # Path-specific dialogue based on Devil Reef outcome
  IF surface_path
    # SURFACE: They escaped together, she left months later
    IF kat_left_note
      hermes: "You said you were sorry."
      kat: "I was."
      kat: "I am."
    ELSE
      hermes: "You didn't even say goodbye."
      kat: "I couldn't."
      kat: "If I'd tried to write it down..."
      kat: "I would have stayed."
    END
    hermes: "I had you. We got out."
    kat: "I know."
    kat: "You just didn't want to believe it."
    kat: "Neither did I."
  ELSE
    # CURRENT/DEPTH: She stayed at the reef, he left alone
    hermes: "I've been coming here for a year."
    hermes: "Hoping you'd—"
    kat: "I know."
    kat: "I felt you. Every time."
  END
  
  kat: "I'm sorry."
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
