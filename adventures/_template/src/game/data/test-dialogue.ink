// Test dialogue for Anima engine demo
VAR ashley_color = "#F472B6"
VAR narrator_color = "#9CA3AF"

=== door ===
NARRATOR: A rusty metal door. It looks like it leads somewhere.
* [Look closer]
    ASHLEY: Hmm, there's graffiti all over it.
    -> door_examined
* [Try to open]
    ASHLEY: It's locked. Need to find another way.
    -> END

=== door_examined ===
NARRATOR: The graffiti reads "EXIT" in faded red letters.
-> END

=== graffiti ===
ASHLEY: This street art is pretty cool.
ASHLEY: Someone put a lot of work into this.
-> END

=== dumpster ===
ASHLEY: I'd rather not look in there...
ASHLEY: Who knows what's inside.
-> END
