# ============================================================================
# SHADOW OVER INNSMOUTH - ACT 3B: DEVIL REEF
# ============================================================================
# The confrontation. She always leaves. Schoeppi always lives.
# clerk_noticed_interest gates how far gone Kat is:
#   TRUE = she's further gone, ABYSSAL available at reef
#   FALSE = she has humanity left to push him away, together only at beach
# ============================================================================

GAME
  title: "Shadow over Innsmouth"
  act: "3b"
  author: "Thoth, Hermes, Brigid"
END

# ============================================================================
# SCENE: BOAT APPROACH (ABEL'S BOAT)
# ============================================================================

SCENE devil_reef_approach
  location: "Abel's Boat - Near Devil Reef"
  time: 3:40am
  mood: dread

  DESCRIPTION
    The reef rises from black water.
    Wrong angles. Surfaces that breathe.
    Abel cuts the engine.
  END

  ON_ENTER
    abel: "This is as close as I go."
    
    "His hands shake on the wheel."
    "Not fear. Longing."
    
    abel: "Some nights I don't wake up in bed."
    abel: "I find myself at the shore. Waist-deep."
    abel: "My body knows where it wants to go."
    
    hermes: "How do you stop it?"
    
    abel: "Willpower. And distance."
    abel: "Eliza... she didn't have enough of either."
    
    "He looks at the reef. THE LOOK — but different."
    "Not love. Grief that never ends."
    
    abel: "I can't go closer. The call is too strong."
    abel: "But you — you're still human enough."
    abel: "For now."
  END

  HOTSPOT rowboat [200, 300, 100, 80]
    name: "Rowboat"
    LOOK
      "Small. Weathered. It'll hold."
    END
    USE
      hermes: "Wait for me?"
      
      abel: "I'll wait."
      abel: "But if you're not back by dawn..."
      
      hermes: "I know."
      
      abel: "No. You don't."
      abel: "Dawn is when the tide turns."
      abel: "After that, the reef goes under."
      abel: "And so does anyone on it."
      
      -> devil_reef
    END
  END
  
  HOTSPOT abel [350, 200, 80, 120]
    name: "Abel"
    LOOK
      "Forty years of fighting what he is."
      "Scars up both arms. Self-made barriers."
      "He's losing. Slowly. But losing."
    END
    TALK
      abel: "Go. Find her."
      abel: "Before it's too late for both of you."
    END
  END
END

# ============================================================================
# SCENE 10: DEVIL REEF — SURFACE (Thoth)
# ============================================================================

SCENE devil_reef
  location: "Devil Reef - Surface"
  time: 3:50am
  mood: alien_sacred
  tension: 9/10

  DESCRIPTION
    Rock that isn't just rock.
    Structures grown from it, or growing into it.
    The line between natural and built is gone.
    The chanting comes from below.
  END

  ON_ENTER
    "Your feet touch the reef."
    "The rock is warm. Pulsing. Alive."
    "The boat engine coughs. Fades into fog."
    "You're alone."
    hermes (thinks): "Fifteen minutes."
    hermes (thinks): "Find her. Get out."
    "The chanting rises. A path leads down."
    "Into the reef. Into the dark."
  END

  HOTSPOT path_down [300, 280, 80, 60]
    name: "Path Down"
    LOOK
      "Carved steps. Worn smooth by centuries of feet."
      "They spiral down into the rock."
      "The chanting comes from below."
      "And light. Green. Flickering."
    END
    USE
      -> reef_descent
    END
  END

  HOTSPOT structures [400, 150, 120, 100]
    name: "Structures"
    LOOK
      "Windows. Doorways. All wrong angles."
      "Some are empty. Some have shapes inside."
      "Watching. Waiting."
      "They know you're here."
      hermes (thinks): "Of course they know."
      hermes (thinks): "They let you come."
    END
  END

  HOTSPOT water_edge [100, 300, 150, 80]
    name: "Water's Edge"
    LOOK
      "The water laps at the reef."
      "Shapes beneath. Circling. Patient."
      "They're not attacking."
      "They're waiting."
      hermes (thinks): "Waiting for what?"
    END
  END
END

# ============================================================================
# SCENE: REEF DESCENT (Thoth)
# ============================================================================

SCENE reef_descent
  location: "Devil Reef - Descent"
  mood: descending
  tension: 9/10

  ON_ENTER
    "You descend."
    "The steps are slick. The walls close in."
    "The chanting grows louder. Words you almost understand."
    "Words that pull at something inside you."
    "Down. Down. Down."
    "And then—"
    "Light."
  END

  -> reef_chamber
END

# ============================================================================
# SCENE: THE CHAMBER
# ============================================================================

SCENE reef_chamber
  location: "Devil Reef - Deep Chamber"
  time: 3:55am
  mood: ritual_space
  tension: 10/10

  DESCRIPTION
    A cavern. Vast. Impossible.
    The ceiling lost in darkness.
    In the center: a pool. Black water. Still.
    Around it: figures. Dozens. Hundreds.
    And at the edge—
  END

  ON_ENTER
    "The chamber opens before you."
    "The congregation doesn't turn. Doesn't notice."
    "Their eyes are on the pool. On the water."
    "On her."
    
    # clerk_noticed_interest determines how far gone she is
    IF clerk_noticed_interest
      -> kat_further_gone
    ELSE
      -> kat_still_fighting
    END
  END
END

# ============================================================================
# BRANCH: KAT STILL FIGHTING (clerk didn't notice)
# She has enough humanity left to push Hermes away
# ABYSSAL not available — together only at beach
# ============================================================================

SCENE kat_still_fighting
  mood: desperate_hope
  
  ON_ENTER
    "Kat stands at the edge of the pool."
    "White dress. Bare feet. Hair loose."
    "Her eyes are on the water. But she's not moving."
    "At her side: Schoeppi. Held by a figure in robes."
    "The dog is struggling. Whining."
    "She's frozen. Protecting him. Waiting."
    hermes (thinks): "She's still fighting."
    hermes (thinks): "There's still something human in there."
    SET kat_far_gone = false
  END

  -> confrontation_setup
END

# ============================================================================
# BRANCH: KAT FURTHER GONE (clerk noticed interest)
# She's too transformed to push him away
# ABYSSAL available — can follow her now
# ============================================================================

SCENE kat_further_gone
  mood: surrender

  ON_ENTER
    "Kat stands at the edge of the pool."
    "White dress. Bare feet. Hair loose."
    "Her eyes are on the water. Fixed. Distant."
    "The change is further along. Scales visible on her arms."
    "Schoeppi sits at her feet. Not held. Not restrained."
    "He won't leave her. Even now."
    hermes (thinks): "She's almost gone."
    hermes (thinks): "I'm almost too late."
    SET kat_far_gone = true
  END

  -> confrontation_setup
END

# ============================================================================
# SCENE: CONFRONTATION SETUP
# ============================================================================

SCENE confrontation_setup
  ON_ENTER
    "You step forward."
    "A figure turns. Eyes reflecting green light."
    "Then another. Then more."
    "They see you now."
    "The chanting stops."
    "Silence."
    "Kat turns."
    "She sees you."
    
    IF kat_far_gone
      kat: "..."
      kat: "You came."
      "Her voice is distant. Dreaming. Already half-in the water."
      kat: "I knew you would."
    ELSE
      kat: "..."
      kat: "You shouldn't have come."
      "But there's relief in her voice. Hidden. Desperate."
      kat: "They'll take you too."
    END
    
    "Schoeppi sees you. Whines. Strains toward you."
    "The one thing that still makes sense."
  END

  -> kat_confrontation
END

# ============================================================================
# DIALOGUE: THE CONFRONTATION
# ============================================================================

DIALOGUE kat_confrontation
  "The congregation watches. Patient. They have time."
  "You don't."
  
  CHOICE
    > "I came to bring you home."
      kat: "Home?"
      IF kat_far_gone
        kat: "This is home. It always was."
        kat: "I just didn't know it."
        kat: "The water is calling me, Hermes."
        kat: "It's been calling my whole life."
        -> far_gone_choice
      ELSE
        kat: "I don't have a home. I never did."
        kat: "But here... they want me here."
        hermes: "They're using you. Using the dog."
        kat: "I know."
        kat: "But if I leave—"
        "She looks at Schoeppi. Back at you."
        kat: "Take him. Get him out."
        kat: "I'll buy you time."
        -> still_fighting_choice
      END
      
    > "I know what you're becoming. I saw the photos."
      kat: "..."
      kat: "Then you know I belong here."
      hermes: "You don't have to. The great-aunt fought it. Abel's still fighting."
      IF kat_far_gone
        kat: "They fought. They lost."
        kat: "Everyone loses eventually."
        kat: "I'm just... choosing not to fight."
        -> far_gone_choice
      ELSE
        kat: "And look at them. Decades of pain."
        kat: "Is that what you want for me?"
        hermes: "I want you to have the choice."
        kat: "..."
        "Something flickers. Hope. Fear."
        kat: "Take Schoeppi. Please."
        -> still_fighting_choice
      END
      
    > "Schoeppi needs you."
      "The dog whines at the sound of his name."
      IF kat_far_gone
        kat: "He'll be okay."
        kat: "He has you now."
        "She looks at the dog. Something human flickers."
        kat: "Take care of him. He loves you."
        kat: "He always knew. Before I did."
        -> far_gone_choice
      ELSE
        kat: "I know."
        "Her voice breaks."
        kat: "That's why you have to take him."
        kat: "He can't follow me where I'm going."
        kat: "But you can save him."
        -> still_fighting_choice
      END
  END
END

# ============================================================================
# BRANCH: STILL FIGHTING (she pushes him away)
# All paths lead to beach a year later
# ============================================================================

DIALOGUE still_fighting_choice
  "She's giving you Schoeppi. She's giving you a way out."
  "But not herself."
  
  CHOICE
    > "I'm not leaving without you."
      hermes: "I'm not leaving without you."
      
      kat: "You don't get to choose for me."
      kat: "No one does. Not anymore."
      
      hermes: "Kat—"
      
      "She pushes you. Hard."
      "The congregation parts. A path to the exit."
      "Schoeppi is suddenly in your arms. She put him there."
      
      kat: "Go. While they let you."
      kat: "I'm buying you this. Don't waste it."
      
      -> reef_departure
      
    > "Come with us. Please."
      hermes: "Come with us. Please."
      hermes: "Both of you. We'll figure it out."
      
      "She laughs. Wet. Strange."
      
      kat: "There's nothing to figure out."
      kat: "I'm becoming what I was always meant to be."
      kat: "You can't save me from myself."
      
      "She lifts Schoeppi. Puts him in your arms."
      
      kat: "Save him instead."
      
      -> reef_departure
      
    > Take Schoeppi and go
      "You reach for the dog."
      "He comes to you. Whining. Confused."
      
      hermes: "I'll come back for you."
      
      kat: "No."
      kat: "You won't."
      kat: "And that's okay."
      
      "She touches your face. One last time."
      
      kat: "Goodbye, Hermes."
      kat: "Thank you for seeing me."
      
      -> reef_departure
  END
END

# ============================================================================
# BRANCH: FAR GONE (ABYSSAL available)
# She's too transformed to push him away
# ============================================================================

DIALOGUE far_gone_choice
  "She's not pushing you away."
  "She's not fighting anymore."
  "She's just... waiting."
  
  kat: "You could come with me."
  
  "The words hang in the air."
  "An invitation. A surrender."
  
  CHOICE
    > "I'll follow you anywhere."
      hermes: "I'll follow you anywhere."
      hermes: "Even here. Especially here."
      
      "She looks at you. THE LOOK."
      "The one that sees everything."
      
      kat: "You're sure?"
      
      hermes: "No."
      hermes: "But I'm here."
      
      -> release_together
      
    > "I can't."
      hermes: "I can't."
      hermes: "I'm not... I'm not like you."
      
      kat: "No. You're not."
      kat: "You're exactly what you're supposed to be."
      kat: "That's why I loved you."
      
      "She picks up Schoeppi. Presses him into your arms."
      
      kat: "Take care of him."
      kat: "He was the only thing I ever loved without being afraid."
      kat: "Until you."
      
      -> reef_departure_far_gone
      
    > "Let me try to save you."
      hermes: "Let me try. Please."
      hermes: "I have a boat. Abel's waiting."
      
      kat: "Abel."
      "She almost smiles."
      kat: "Still fighting after all these years."
      kat: "Still losing."
      
      hermes: "Come with me. We'll figure it out."
      
      "A long pause."
      
      kat: "...Okay."
      kat: "Okay. I'll try."
      
      "She takes your hand. Cold. Scaled."
      "But still her."
      
      -> rescue_attempt
  END
END

# ============================================================================
# SCENE: REEF DEPARTURE (she pushed him away)
# Leads to beach a year later
# ============================================================================

SCENE reef_departure
  location: "Devil Reef - Exit"
  time: 4:00am
  mood: loss

  ON_ENTER
    "You run."
    "Schoeppi in your arms. Whining."
    "The congregation parts for you. Lets you go."
    "You don't look back."
    "You can't."
    
    "At the reef's edge, the rowboat waits."
    "You tumble in. Row."
    "Abel's boat ahead. Engine running."
    
    abel: "Where is she?"
    
    hermes: "Gone."
    hermes: "She made her choice."
    
    abel: "..."
    abel: "They all do. Eventually."
    
    "The dog whines in your lap."
    "He's looking back. Toward the reef."
    "You don't."
    
    hermes (thinks): "She told me to go."
    hermes (thinks): "She told me not to come back."
    hermes (thinks): "I'm going to anyway."
    hermes (thinks): "One day."
    
    SET reef_outcome = "pushed_away"
  END
  
  -> ending_to_act4
END

SCENE reef_departure_far_gone
  location: "Devil Reef - Exit"
  time: 4:00am
  mood: grief

  ON_ENTER
    "You run."
    "Schoeppi in your arms. Whining."
    "Behind you: she walks into the pool."
    "Slowly. Deliberately."
    "You hear the splash. You don't turn."
    
    "At the reef's edge, the rowboat waits."
    "You row back to Abel alone."
    
    abel: "She's gone?"
    
    hermes: "Yeah."
    
    abel: "Did you say goodbye?"
    
    hermes: "Yeah."
    
    abel: "That's more than most get."
    
    "The dog whines."
    "He knows."
    
    hermes (thinks): "She told me to come to the shore."
    hermes (thinks): "At night. When the tide is high."
    hermes (thinks): "She'll know I'm there."
    
    SET reef_outcome = "let_her_go"
  END
  
  -> ending_to_act4
END

# ============================================================================
# BRANCH A: RESCUE ATTEMPT
# She agreed to try - leads to SURFACE (false victory)
# ============================================================================

DIALOGUE rescue_attempt
  "She stares at you."
  "Something shifts in her eyes."
  "The human part. Fighting to surface."
  
  kat: "You're insane."
  
  hermes: "Probably."
  
  kat: "They won't let us leave."
  
  hermes: "Then we don't ask permission."
  
  "Schoeppi is already at your feet. Whining."
  "He knows. He's ready."
  
  hermes (thinks): "Get the dog. Get the girl. Get out."
  hermes (thinks): "Fifteen minutes. Maybe less."
  
  kat: "I don't... I don't know if I can."
  kat: "The pull is so strong."
  
  hermes: "Look at me."
  
  "She does."
  
  hermes: "You said you'd try."
  hermes: "That's all I'm asking."
  
  "A moment. An eternity."
  
  kat: "...Okay."
  kat: "Okay. Let's go."
  
  "She takes your hand."
  "Cold. Scaled. Still hers."
  "Schoeppi runs ahead."
  
  -> rescue_escape
END

# ============================================================================
# SCENE: RESCUE ESCAPE (Hermes)
# ============================================================================

SCENE rescue_escape
  location: "Devil Reef - Flight"
  time: 4:00am
  mood: desperate

  DESCRIPTION
    Running through the chamber.
    The congregation stirs. Wakes.
    They're between you and the exit.
  END

  ON_ENTER
    "The water churns."
    "Shapes rising. Dozens of them."
    "They know. They KNOW."
    
    "Schoeppi runs beside you. Barking. Terrified."
    
    kat: "Don't stop. Whatever you do, don't stop."
    
    "She's faster than you now."
    "She has to slow down so you can keep up."
  END

  HOTSPOT path_left [100, 200, 120, 100]
    name: "Left Path"
    LOOK
      "Shorter. But shapes are rising from the water on that side."
    END
    USE
      -> rescue_choice_left
    END
  END

  HOTSPOT path_right [400, 200, 120, 100]
    name: "Right Path"
    LOOK
      "Longer. But clearer. For now."
    END
    USE
      -> rescue_choice_right
    END
  END
END

# --- RESCUE PATH: LEFT (RISKY, FASTER) ---

SCENE rescue_choice_left
  location: "Devil Reef - The Gauntlet"
  time: 4:02am
  mood: terror

  ON_ENTER
    "You take the short path."
    "They're everywhere. Reaching."
    
    "Kat SCREAMS."
    "Not fear — command."
    "Something in their language."
    
    "They hesitate. Just for a moment."
    
    kat: "MOVE!"
    
    "You run."
    
    CHOICE
      > Pull her along
        SET rescue_pull = true
        "You grab her wrist. Drag her forward."
        "She stumbles but keeps going."
        "Something rakes your back. You don't stop."
        -> rescue_boat
        
      > Let her lead
        SET rescue_follow = true
        "She knows the way. Better than you."
        "You follow her through the gaps."
        "Between the reaching hands. The snapping jaws."
        "You make it."
        -> rescue_boat
    END
  END
END

# --- RESCUE PATH: RIGHT (SAFER, SLOWER) ---

SCENE rescue_choice_right
  location: "Devil Reef - The Long Way"
  time: 4:02am
  mood: desperate

  ON_ENTER
    "The longer path. Fewer of them."
    "But the tide is turning."
    "Water lapping higher with every step."
    
    kat: "It's coming. The reef goes under at dawn."
    
    hermes: "How long?"
    
    kat: "Minutes. Maybe less."
    
    "You run faster."
    "The water is at your ankles. Your knees."
    
    CHOICE
      > "Can you swim us out?"
        SET rescue_swim = true
        hermes: "If we can't make the boat—"
        
        kat: "I can try."
        kat: "But the water is theirs."
        kat: "Once we're in, I don't know if I can—"
        
        hermes: "Can you get us to Abel's boat?"
        
        "She looks at you. Really looks."
        
        kat: "I'll try."
        
        -> rescue_swim
        
      > Push through to the boat
        SET rescue_push = true
        hermes: "We're almost there. Keep going!"
        
        "You push through the rising water."
        "The rowboat is just ahead."
        "But the tide is faster."
        
        -> rescue_boat_race
    END
  END
END

# --- RESCUE: SWIM ESCAPE ---

SCENE rescue_swim
  location: "The Water"
  time: 4:05am
  mood: submersion

  ON_ENTER
    "The reef goes under."
    "Suddenly you're swimming."
    "Kat's grip is the only anchor."
    
    "She CHANGES in the water."
    "Fully now. Gills working. Eyes wide."
    "For a moment — she's one of them."
    
    "Then she looks at you."
    "Remembers."
    
    "She pulls you through the dark water."
    "Past shapes that reach for you."
    "Past her own kind."
    
    # Schoeppi is always alive
      "Schoeppi scrambles up after you. Shaking. Alive."
    
    hermes: "Kat—"
    
    "She's at the surface. Just her eyes."
    "Gold. Inhuman. Sad."
    
    CHOICE
      > Reach for her
        -> rescue_swim_reach
        
      > "Come with us!"
        -> rescue_swim_call
    END
  END
END

DIALOGUE rescue_swim_reach
  "You reach down."
  "She reaches up."
  "Your hands meet."
  
  "For a moment — you're connected."
  "Human and other. Land and sea."
  
  "Then something pulls her down."
  "HARD."
  
  hermes: "NO!"
  
  abel: "She's gone, son. She's gone."
  
  "Her hand slips from yours."
  "She disappears into the black."
  
  "You stare at the water until Abel pulls you away."
  
  -> rescue_ending_lost
END

DIALOGUE rescue_swim_call
  hermes: "Come with us! Kat, please!"
  
  "She rises higher. Half out of the water."
  "The change is almost complete."
  "But her voice — still her voice."
  
  kat: "I can't."
  kat: "They'll follow. They'll never stop."
  kat: "You got me out of there. That's enough."
  kat: "That's more than enough."
  
  hermes: "Kat—"
  
  kat: "Go. Live."
  # Schoeppi is always alive
    kat: "Until you."
  kat: "And sometimes... come to the beach."
  kat: "I'll know you're there."
  
  "She sinks below the surface."
  "Gone."
  
  abel: "We have to go. NOW."
  
  "The engine roars."
  "You leave Devil Reef behind."
  "You don't look back."
  "You can't."
  
  -> rescue_ending_apart
END

# --- RESCUE: RACE TO BOAT ---

SCENE rescue_boat_race
  location: "Devil Reef - Flooding"
  time: 4:05am
  mood: desperation

  ON_ENTER
    "Water at your waist. Your chest."
    "The rowboat is ten feet away. Five."
    
    "Something grabs your leg."
    "You go under."
    
    "Kat's face. Underwater. RIGHT THERE."
    
    kat (muffled): "HOLD ON!"
    
    "She tears you free."
    "Throws you toward the boat."
    "You hit the side. Grab the edge."
    
    # Schoeppi is always alive
      "Schoeppi is already in the boat. Whining."
    
    "Kat is right behind you."
    "Then she stops."
    
    "More of them. Surrounding her."
    "Her family. Her people."
    "Calling her home."
    
    CHOICE
      > Pull her into the boat
        SET rescue_force = true
        -> rescue_force_ending
        
      > "It's okay. Go to them."
        SET rescue_release = true
        -> rescue_release_at_boat
    END
  END
END

DIALOGUE rescue_force_ending
  "You grab her arm."
  "PULL."
  
  "She screams — not in her voice."
  "In theirs."
  
  "But she comes."
  "Into the boat. Onto the deck."
  "Changed. Gasping. Crying."
  
  "You row. Harder than you've ever done anything."
  "The shapes fall behind."
  
  abel: "Jesus Christ. You actually—"
  
  hermes: "JUST DRIVE!"
  
  "He does."
  "The reef disappears behind you."
  
  "Kat curls in the bottom of the rowboat."
  "Shaking. Sobbing."
  "Half-transformed. Neither one thing nor another."
  
  # Schoeppi is always alive
  -> rescue_ending_together_broken

DIALOGUE rescue_release_at_boat
  hermes: "It's okay."
  
  "She stares at you."
  "Shocked."
  
  hermes: "I came for you. I tried."
  hermes: "But I can't make this choice for you."
  
  "Her eyes fill with something."
  "Gratitude. Grief. Love."
  
  kat: "Thank you."
  kat: "For not giving up on me."
  kat: "For letting me go."
  
  "She sinks back toward them."
  "Her family. Her people."
  
  "Before she goes under, she looks at you one last time."
  
  kat: "I'll remember you."
  kat: "For as long as I can."
  kat: "That's all any of us get."
  
  "She's gone."
  "You row back to Abel alone."
  
  # Schoeppi is always alive
    "You hold him. It's all you can do."
  
  -> rescue_ending_apart
END

# --- RESCUE: BOAT ESCAPE (FROM LEFT PATH) ---

SCENE rescue_boat
  location: "Devil Reef - The Rowboat"
  time: 4:04am
  mood: flight

  ON_ENTER
    "The rowboat is there. Right where you left it."
    "You tumble in. She follows."
    
    # Schoeppi is always alive
      "Schoeppi leaps in after. Shaking. Terrified. Alive."
    
    "Row. ROW."
    
    "The oars hit water that feels too thick."
    "Hands reach up. You slap them away."
    
    "Abel's boat ahead. Engine running."
    
    abel: "COME ON!"
    
    "You reach the boat. Climb up."
    "Kat hesitates at the edge."
    
    "The water calls to her. You can see it."
    
    CHOICE
      > Hold out your hand
        -> rescue_boat_hand
        
      > "You have to choose."
        -> rescue_boat_choice
    END
  END
END

DIALOGUE rescue_boat_hand
  "You hold out your hand."
  "Not demanding. Offering."
  
  hermes: "Come with me."
  hermes: "Whatever happens next, we face it together."
  
  "She stares at your hand."
  "At the water behind her."
  "At the life she's leaving."
  
  "Then she takes it."
  
  "You pull her up."
  "She collapses on the deck."
  "Half-changed. Gasping."
  
  # Schoeppi is always alive
  -> rescue_ending_together_uncertain

DIALOGUE rescue_boat_choice
  hermes: "I can't pull you out of the water."
  hermes: "You have to want to come."
  
  "She's silent. Torn."
  "The sea calls. You call."
  
  "For an endless moment — nothing."
  
  "Then she reaches for the boat."
  "Pulls herself up."
  "Falls onto the deck."
  
  kat: "I choose you."
  kat: "I don't know what that means anymore."
  kat: "But I choose you."
  
  abel: "We're going. NOW."
  
  -> rescue_ending_together_choice
END

# ============================================================================
# BRANCH B: RELEASE PATH (Hermes)
# ============================================================================

DIALOGUE release_path
  "She turns back to the pool."
  "The congregation resumes their chanting."
  "You're irrelevant to them. She's what matters."
  
  hermes (thinks): "I can't save her."
  hermes (thinks): "She doesn't want to be saved."
  
  CHOICE
    > "Then let me stay with you."
      SET path = "release_stay"
      hermes: "If you're going into that water..."
      hermes: "I'm going with you."
      -> release_together
      
    > "Don't do this."
      SET path = "release_fight"
      hermes: "Kat, please. Fight it."
      -> release_witness_fight
      
    > "...Okay."
      SET path = "release_accept"
      hermes: "I understand."
      "You don't. But you're trying."
      -> release_witness_accept
  END
END

# --- RELEASE: TOGETHER ---

DIALOGUE release_together
  "She goes still."
  
  kat: "You don't know what you're saying."
  
  hermes: "I know exactly what I'm saying."
  
  kat: "You'll drown. You're not like me."
  
  hermes: "Maybe."
  hermes: "Or maybe I am, and I just haven't found out yet."
  
  "She looks at you."
  "THE LOOK. The one from the church."
  "The one that sees everything."
  
  kat: "You're serious."
  
  hermes: "I've been serious since the bus."
  hermes: "Since you didn't laugh at my bad joke."
  hermes: "I knew then. I just didn't have words for it."
  
  kat: "Words for what?"
  
  hermes: "That I'd follow you anywhere."
  hermes: "Even here."
  hermes: "Especially here."
  
  "She moves toward you."
  "Close enough to touch."
  "Her hand — cold, scaled — finds yours."
  
  kat: "They won't accept you."
  
  hermes: "I don't need them to."
  hermes: "I just need you."
  
  "She laughs. Wet. Strange. Beautiful."
  
  kat: "You're insane."
  
  hermes: "You keep saying that."
  
  kat: "Because it keeps being true."
  
  "She leads you to the pool's edge."
  
  kat: "Last chance."
  
  CHOICE
    > Step into the water
      -> release_together_descent
      
    > Hesitate
      -> release_together_hesitate
  END
END

DIALOGUE release_together_descent
  "You step into the water together."
  "It's cold. Then it isn't."
  "The darkness isn't dark."
  
  "She holds your hand as the surface gets further away."
  
  "You should drown."
  
  "You don't."
  
  "Below: lights in the deep."
  "A city that shouldn't exist."
  "And something vast, watching."
  "Waiting."
  
  "Kat squeezes your hand."
  
  kat: "Stay with me."
  
  hermes: "Always."
  
  "You descend."
  "Together."
  
  "Some love stories end in the light."
  "This one doesn't."
  "But it ends together."
  "That's enough."
  
  -> ending_together_deep
END

DIALOGUE release_together_hesitate
  "You stop at the edge."
  "Just for a moment."
  
  hermes: "I..."
  
  kat: "It's okay."
  
  "She doesn't let go of your hand."
  "But she doesn't pull either."
  
  kat: "You don't have to."
  kat: "The fact that you wanted to — that's enough."
  
  hermes: "I mean it. I want to come with you."
  
  kat: "Part of you does."
  kat: "But part of you belongs up there."
  kat: "I won't take that from you."
  
  CHOICE
    > "I'm coming."
      hermes: "No. I mean it."
      -> release_together_descent
      
    > "...You're right."
      -> release_goodbye_mutual
  END
END

# --- RELEASE: WITNESS (FIGHT) ---

DIALOGUE release_witness_fight
  hermes: "Don't go."
  hermes: "Fight it. Fight them."
  
  kat: "I've been fighting my whole life."
  kat: "This is the first time I've felt like I wasn't fighting against myself."
  
  hermes: "Kat, please—"
  
  kat: "I'm not being taken, Hermes."
  kat: "I'm going home."
  
  "She steps back."
  "Toward the pool."
  
  hermes: "I won't let you—"
  
  "You grab for her."
  "Something hits you from behind."
  "One of them. You didn't hear it coming."
  "You go down."
  
  "When you look up, she's at the pool's edge."
  
  kat: "I'm sorry."
  kat: "I didn't want it to be like this."
  kat: "But I'm not strong enough to watch you watch."
  
  hermes: "KAT!"
  
  kat: "Goodbye, Hermes."
  kat: "Thank you for seeing me."
  kat: "All of me."
  kat: "Even the parts I was afraid of."
  
  "She steps back."
  "Falls into the dark water."
  "Gone."
  
  "You lie on the reef."
  "The things holding you down let go."
  "They have what they wanted."
  
  "The tide is coming."
  "You have to leave."
  
  "You leave."
  
  -> ending_witness_failed
END

# --- RELEASE: WITNESS (ACCEPT) ---

DIALOGUE release_witness_accept
  hermes: "I understand."
  
  kat: "Do you?"
  
  hermes: "No."
  hermes: "But I'm trying."
  
  "She smiles."
  "Different now. But still her smile."
  
  kat: "That's all I ever wanted."
  kat: "Someone who tried."
  
  # Schoeppi callback
  kat: "Take care of him. He loves you."
  kat: "He always knew. Before I did."
  kat: "He was the only thing I ever loved without being afraid."
  kat: "Until you."
  
  hermes: "I'll always try."
  
  kat: "I know."
  kat: "That's why I loved you."
  
  hermes: "Loved?"
  
  kat: "Love. Present tense."
  kat: "For as long as I remember what that word means."
  
  "She leans in."
  "Kisses you."
  "Salt. Cold. Something else."
  "The sea."
  
  kat: "Goodbye, Hermes."
  
  "She walks toward the pool."
  "You watch."
  "You don't stop her."
  
  "At the edge, she turns one last time."
  
  kat: "Come to the shore sometimes."
  kat: "At night. When the tide is high."
  kat: "I'll know you're there."
  
  "She steps into the water."
  "Sinks beneath the surface."
  "The water closes over her."
  
  "You stand there until the tide rises."
  "Until you have to leave."
  
  -> ending_witness_release
END

# --- RELEASE: MUTUAL GOODBYE ---

DIALOGUE release_goodbye_mutual
  hermes: "You're right."
  hermes: "There's a part of me that can't let go."
  
  kat: "The good part."
  kat: "Hold onto that."
  
  "She touches your face one more time."
  
  kat: "This is goodbye."
  kat: "Not forever. Nothing is forever."
  kat: "But for now."
  
  hermes: "For now."
  
  kat: "Come to the shore. At night."
  kat: "Think of me."
  kat: "That's all we get."
  kat: "That's more than most people get."
  
  "She walks into the water."
  "Doesn't look back."
  "She can't. You understand now."
  "If she looked back, she might not go."
  
  "The water closes over her head."
  "For a moment, you see her shape below the surface."
  "Then she's gone."
  
  "You walk back to the rowboat."
  "Alone."
  
  -> ending_witness_mutual
END

# ============================================================================
# ENDINGS
# ============================================================================

SCENE ending_together_deep
  location: "The Deep"
  time: eternal
  mood: surrender

  ON_ENTER
    "You descend."
    "The water is warm. The dark is bright."
    "Cities rise around you. Impossible. Ancient."
    ""
    "She swims beside you."
    "Changed. Complete."
    "And somehow — so are you."
    ""
    "There's something down there."
    "Vast. Waiting."
    "It sees you."
    "It's been waiting for you both."
    ""
    "The last thing you feel is her hand in yours."
    "The last thing you see is light."
    "Green. Ancient. Alive."
    ""
    "And then—"
    "Nothing."
    "Everything."
    "The sea."
    
    -> GAME_END_ABYSSAL
  END
END

SCENE ending_witness_release
  location: "Devil Reef - Dawn"
  time: dawn
  mood: bittersweet

  ON_ENTER
    "You row back to Abel."
    "He doesn't ask."
    "He already knows."
    
    abel: "Did you say goodbye?"
    
    hermes: "Yeah."
    
    abel: "That's more than I got."
    abel: "With Eliza."
    abel: "Count yourself lucky."
    
    "The boat heads back to shore."
    "The sun rises."
    "Normal light. Normal world."
    "None of it feels real anymore."
    
    hermes (thinks): "She told me to come to the shore."
    hermes (thinks): "I will."
    hermes (thinks): "Every night I can."
    hermes (thinks): "For as long as I remember."
    
    -> GAME_END_RELEASE
  END
END

SCENE ending_witness_mutual
  location: "Abel's Boat"
  time: dawn
  mood: quiet_grief

  ON_ENTER
    "Abel helps you onto the boat."
    "Your hands are shaking."
    "His are too."
    
    abel: "Gone?"
    
    hermes: "Gone."
    
    abel: "..."
    abel: "I'm sorry, son."
    
    hermes: "Me too."
    
    "He starts the engine."
    "The reef disappears behind you."
    "The shore gets closer."
    
    hermes (thinks): "At night. When the tide is high."
    hermes (thinks): "I'll be there."
    
    -> GAME_END_RELEASE
  END
END

SCENE ending_witness_failed
  location: "Devil Reef - Retreating"
  time: pre_dawn
  mood: defeat

  ON_ENTER
    "You stumble back across the reef."
    "The tide is rising fast."
    "You barely make the rowboat."
    "Barely make Abel's boat."
    
    abel: "What happened? Where is she?"
    
    hermes: "Gone."
    hermes: "I couldn't—"
    hermes: "She chose them."
    
    abel: "They all do. Eventually."
    
    "He doesn't say it cruelly."
    "Just truth. Weathered by decades."
    
    "The boat heads back to shore."
    "You don't look back."
    "You can't."
    
    hermes (thinks): "I tried."
    hermes (thinks): "It wasn't enough."
    hermes (thinks): "It was never going to be enough."
    
    -> GAME_END_FAILED
  END
END

SCENE rescue_ending_lost
  location: "Abel's Boat - Aftermath"
  time: dawn
  mood: grief

  ON_ENTER
    "The engine roars."
    "The reef falls behind."
    
    "You sit in the stern."
    "Staring at the water."
    "She was right there."
    "You had her hand."
    
    abel: "I'm sorry."
    
    "You don't answer."
    
    abel: "It happens that way sometimes."
    abel: "The sea takes what it wants."
    abel: "Always has."
    
    # Schoeppi is always alive
    -> GAME_END_LOST
END

SCENE rescue_ending_apart
  location: "Abel's Boat - Heading Home"
  time: dawn
  mood: hollow_hope

  ON_ENTER
    "The shore appears ahead."
    "Real land. Real world."
    "It doesn't feel like victory."
    
    abel: "You got further than I ever did."
    
    hermes: "It wasn't enough."
    
    abel: "No. But you tried."
    abel: "That matters."
    abel: "Even when it's not enough."
    
    # Schoeppi is always alive
      "But he's here. She wanted that."
    
    "You think about what she said."
    "Come to the beach. She'll know you're there."
    
    hermes (thinks): "I will."
    hermes (thinks): "Every night."
    hermes (thinks): "For the rest of my life if I have to."
    
    "The boat reaches the dock."
    "You step onto land."
    "You don't feel like you belong here anymore."
    "But this is where you are."
    "For now."
    
    -> GAME_END_APART
  END
END

SCENE rescue_ending_together_broken
  location: "Abel's Boat - Deck"
  time: dawn
  mood: uncertain_hope

  ON_ENTER
    "Kat lies on the deck."
    "Still changing. But not gone."
    "Not yet."
    
    "She looks at you with gold eyes."
    
    kat: "What do we do now?"
    
    hermes: "I don't know."
    
    kat: "I can't go back to... to what I was."
    kat: "I'm not human anymore."
    
    hermes: "I don't care."
    
    kat: "You should."
    
    hermes: "I don't."
    
    "She laughs. Wet. Strange."
    "But still her."
    
    kat: "You really are insane."
    
    hermes: "You keep saying that."
    
    # Schoeppi is always alive
      "Neither do you."
    
    abel: "We're almost to shore."
    abel: "Whatever you two are going to do..."
    abel: "You need to figure it out fast."
    
    "You look at Kat."
    "She looks at you."
    
    hermes (thinks): "We'll figure it out."
    hermes (thinks): "Whatever that means."
    hermes (thinks): "Together."
    
    -> GAME_END_TOGETHER_BROKEN
  END
END

SCENE rescue_ending_together_uncertain
  location: "Open Water"
  time: dawn
  mood: fragile_hope

  ON_ENTER
    "She's on the deck."
    "Changed. But here."
    "That has to mean something."
    
    abel: "She can't stay on land."
    abel: "Not forever."
    abel: "She'll need the water."
    
    hermes: "We'll figure it out."
    
    abel: "Maybe. Maybe."
    abel: "But this ain't over."
    abel: "This is never over."
    
    "Kat reaches for your hand."
    "You take it."
    
    kat: "I don't know what I am anymore."
    
    hermes: "You're Kat."
    
    kat: "That name doesn't fit."
    
    hermes: "Then we'll find one that does."
    hermes: "Later."
    hermes: "For now, just... be here."
    
    # Schoeppi is always alive
      "It's everything."
    
    "She nods."
    "The shore gets closer."
    "You don't know what happens next."
    "Neither does she."
    "But you're together."
    
    -> GAME_END_TOGETHER_UNCERTAIN
  END
END

SCENE rescue_ending_together_choice
  location: "Abel's Boat"
  time: dawn
  mood: hope_hard_won

  ON_ENTER
    "The reef is gone behind you."
    "Kat sits against the gunwale."
    "Changed. Choosing."
    
    kat: "I chose you."
    kat: "I don't know what that means."
    kat: "But I chose you."
    
    hermes: "That's all I needed."
    
    abel: "It ain't that simple."
    
    hermes: "I know."
    
    abel: "The sea doesn't let go easy."
    abel: "Neither do they."
    
    hermes: "I know."
    
    # Schoeppi is always alive
      "Like he's saying: we're in this together."
    
    "But you look at her."
    "She looks at you."
    "And for one moment — just one —"
    "It feels like enough."
    
    -> GAME_END_TOGETHER_CHOICE
  END
END

# ============================================================================
# SURFACE PATH: FALSE VICTORY → ACT 4
# ============================================================================

SCENE surface_false_victory
  location: "Months Later"
  time: montage
  mood: slow_erosion

  ON_ENTER
    "You made it."
    "Both of you. Together."
    ""
    "The first month is the hardest."
    "She can't sleep. The dreams are constant."
    "She takes cold baths at 3am. Says it helps."
    "You pretend not to notice."
    ""
    "The second month, she starts eating fish. Only fish."
    "Raw, when she thinks you're not looking."
    # Schoeppi is always alive
    "She let you believe it for as long as she could."
  
  -> surface_she_leaves
END

SCENE surface_she_leaves
  location: "One Morning"
  time: dawn
  mood: absence

  ON_ENTER
    "You wake up alone."
    "The bed is cold. Has been for hours."
    ""
    # Schoeppi is always alive
      "You slept through it."
    ""
    CHOICE
      > Search her things
        "You tear through the apartment."
        "Drawers. Closets. The jewelry box she never opened."
        "You find it under her pillow."
        "Three words."
        kat (letter): "I'm sorry."
        SET kat_left_note = true
        
      > Don't look
        "If she wanted to explain, she would have."
        "The silence is the answer."
        SET kat_left_note = false
    END
    ""
    "You drive to the beach."
    "You know which one."
    "She's not there."
    "She's never there."
    ""
    "But sometimes, at night, when the tide is high—"
    "You think you see a shape in the water."
    "Watching."
    "Waiting."
    ""
    "One year later, you stop pretending she's not calling."
    
    SET surface_path = true
  END
  
  -> ACT4_TRANSITION
END

SCENE ACT4_TRANSITION
  ON_ENTER
    ""
    "A C T   F O U R"
    ""
    "O N E   Y E A R   L A T E R"
    ""
  END
  
  -> one_year_later
END

# ============================================================================
# CURRENT/DEPTH PATHS → ACT 4 TRANSITION
# ============================================================================

SCENE ending_to_act4
  location: "The Long Year"
  time: passage
  mood: haunted

  ON_ENTER
    "You go back to Boston."
    "You tell no one."
    "Who would believe you?"
    ""
    "The government raid in '28 proves it was real."
    "But they cover it up. Call it 'bootleggers.'"
    "Bootleggers with gills."
    ""
    "You dream of her."
    "Every night. The same dream."
    "She's in the water. Calling."
    ""
    # Schoeppi is always alive
      "Someone."
    ""
    "One year."
    "One year of pretending you're not going back."
    "One year of knowing you are."
    
    SET beach_call = true
  END
  
  -> ACT4_TRANSITION
END

# ============================================================================
# REDIRECT ENDINGS TO ACT 4
# ============================================================================

# These scenes now transition to act4 instead of ending the game

SCENE rescue_ending_together_broken
  location: "Abel's Boat - Deck"
  time: dawn
  mood: uncertain_hope

  ON_ENTER
    "Kat lies on the deck."
    "Still changing. But not gone."
    "Not yet."
    
    "She looks at you with gold eyes."
    
    kat: "What do we do now?"
    
    hermes: "I don't know."
    
    kat: "I can't go back to... to what I was."
    kat: "I'm not human anymore."
    
    hermes: "I don't care."
    
    kat: "You should."
    
    hermes: "I don't."
    
    "She laughs. Wet. Strange."
    "But still her."
    
    kat: "You really are insane."
    
    hermes: "You keep saying that."
    
    # Schoeppi is always alive
      "Neither do you."
    
    abel: "We're almost to shore."
    abel: "Whatever you two are going to do..."
    abel: "You need to figure it out fast."
    
    "You look at Kat."
    "She looks at you."
    
    hermes (thinks): "We'll figure it out."
    hermes (thinks): "Whatever that means."
    hermes (thinks): "Together."
    
    -> surface_false_victory
  END
END

SCENE rescue_ending_together_uncertain
  location: "Open Water"
  time: dawn
  mood: fragile_hope

  ON_ENTER
    "She's on the deck."
    "Changed. But here."
    "That has to mean something."
    
    abel: "She can't stay on land."
    abel: "Not forever."
    abel: "She'll need the water."
    
    hermes: "We'll figure it out."
    
    abel: "Maybe. Maybe."
    abel: "But this ain't over."
    abel: "This is never over."
    
    "Kat reaches for your hand."
    "You take it."
    
    kat: "I don't know what I am anymore."
    
    hermes: "You're Kat."
    
    kat: "That name doesn't fit."
    
    hermes: "Then we'll find one that does."
    hermes: "Later."
    hermes: "For now, just... be here."
    
    # Schoeppi is always alive
      "It's everything."
    
    "She nods."
    "The shore gets closer."
    "You don't know what happens next."
    "Neither does she."
    "But you're together."
    
    -> surface_false_victory
  END
END

SCENE rescue_ending_together_choice
  location: "Abel's Boat"
  time: dawn
  mood: hope_hard_won

  ON_ENTER
    "The reef is gone behind you."
    "Kat sits against the gunwale."
    "Changed. Choosing."
    
    kat: "I chose you."
    kat: "I don't know what that means."
    kat: "But I chose you."
    
    hermes: "That's all I needed."
    
    abel: "It ain't that simple."
    
    hermes: "I know."
    
    abel: "The sea doesn't let go easy."
    abel: "Neither do they."
    
    hermes: "I know."
    
    # Schoeppi is always alive
      "Like he's saying: we're in this together."
    
    "But you look at her."
    "She looks at you."
    "And for one moment — just one —"
    "It feels like enough."
    
    -> surface_false_victory
  END
END

# Redirect CURRENT/DEPTH endings to act4 transition

SCENE ending_witness_release
  location: "Devil Reef - Dawn"
  time: dawn
  mood: bittersweet

  ON_ENTER
    "You row back to Abel."
    "He doesn't ask."
    "He already knows."
    
    abel: "Did you say goodbye?"
    
    hermes: "Yeah."
    
    abel: "That's more than I got."
    abel: "With Eliza."
    abel: "Count yourself lucky."
    
    "The boat heads back to shore."
    "The sun rises."
    "Normal light. Normal world."
    "None of it feels real anymore."
    
    hermes (thinks): "She told me to come to the shore."
    hermes (thinks): "I will."
    hermes (thinks): "Every night I can."
    hermes (thinks): "For as long as I remember."
    
    -> ending_to_act4
  END
END

SCENE ending_witness_mutual
  location: "Abel's Boat"
  time: dawn
  mood: quiet_grief

  ON_ENTER
    "Abel helps you onto the boat."
    "Your hands are shaking."
    "His are too."
    
    abel: "Gone?"
    
    hermes: "Gone."
    
    abel: "..."
    abel: "I'm sorry, son."
    
    hermes: "Me too."
    
    "He starts the engine."
    "The reef disappears behind you."
    "The shore gets closer."
    
    hermes (thinks): "At night. When the tide is high."
    hermes (thinks): "I'll be there."
    
    -> ending_to_act4
  END
END

SCENE ending_witness_failed
  location: "Devil Reef - Retreating"
  time: pre_dawn
  mood: defeat

  ON_ENTER
    "You stumble back across the reef."
    "The tide is rising fast."
    "You barely make the rowboat."
    "Barely make Abel's boat."
    
    abel: "What happened? Where is she?"
    
    hermes: "Gone."
    hermes: "I couldn't—"
    hermes: "She chose them."
    
    abel: "They all do. Eventually."
    
    "He doesn't say it cruelly."
    "Just truth. Weathered by decades."
    
    "The boat heads back to shore."
    "You don't look back."
    "You can't."
    
    hermes (thinks): "I tried."
    hermes (thinks): "It wasn't enough."
    hermes (thinks): "It was never going to be enough."
    
    -> ending_to_act4
  END
END

SCENE rescue_ending_lost
  location: "Abel's Boat - Aftermath"
  time: dawn
  mood: grief

  ON_ENTER
    "The engine roars."
    "The reef falls behind."
    
    "You sit in the stern."
    "Staring at the water."
    "She was right there."
    "You had her hand."
    
    abel: "I'm sorry."
    
    "You don't answer."
    
    abel: "It happens that way sometimes."
    abel: "The sea takes what it wants."
    abel: "Always has."
    
    # Schoeppi is always alive
    -> ending_to_act4
END

SCENE rescue_ending_apart
  location: "Abel's Boat - Heading Home"
  time: dawn
  mood: hollow_hope

  ON_ENTER
    "The shore appears ahead."
    "Real land. Real world."
    "It doesn't feel like victory."
    
    abel: "You got further than I ever did."
    
    hermes: "It wasn't enough."
    
    abel: "No. But you tried."
    abel: "That matters."
    abel: "Even when it's not enough."
    
    # Schoeppi is always alive
      "But he's here. She wanted that."
    
    "You think about what she said."
    "Come to the beach. She'll know you're there."
    
    hermes (thinks): "I will."
    hermes (thinks): "Every night."
    hermes (thinks): "For the rest of my life if I have to."
    
    "The boat reaches the dock."
    "You step onto land."
    "You don't feel like you belong here anymore."
    "But this is where you are."
    "For now."
    
    -> ending_to_act4
  END
END

# ============================================================================
# ABYSSAL: TRUE ENDING AT REEF (CREDITS)
# ============================================================================

# ending_together_deep remains a true ending - goes to credits

# ============================================================================
# GAME END SCENES (ONLY FOR ABYSSAL)
# ============================================================================

# These GAME_END scenes are now unused — all non-ABYSSAL paths feed into act4
# Keeping ABYSSAL ending only:

SCENE GAME_END_ABYSSAL
  ON_ENTER
    ""
    "S H A D O W   O V E R   I N N S M O U T H"
    ""
    "THE END"
    ""
    "They found her family."
    "He found his."
    "Some people belong to the sea."
    ""
    "Together."
    ""
    "Thank you for playing."
  END
END

# ============================================================================
# END OF ACT 3B
# ============================================================================

ACT_END
  summary: "Devil Reef. The confrontation. Rescue or release — shaped by what came before."
  next: act4.story
END
