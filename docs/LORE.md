# The Atatürk — Lore & Narrative Framing

> The fiction wrapped around the gameplay. This is what greets the user on the loading screen and frames every decision they make. Keep it short, evocative, and emotionally calibrated for SCM.

## The premise

It's 25 May 2005. The Atatürk Olympic Stadium in Istanbul. Liverpool, against expectation, against form, against the conventional wisdom of an entire continent, have made it to the Champions League final. They face Milan — the favourites, the European aristocracy, holders of the trophy two years earlier.

And at half-time, Liverpool are 3-0 down.

Maldini has scored inside a minute. Crespo has scored twice before the break. The dressing room is silent in that particular way only a dressing room can be silent when every player knows the match is already becoming a humiliation.

Rafa Benítez looks around the room and, for one impossible moment, loses faith in his own plan.

Then he looks at *you*.

You are not a coach. You are an unknown Liverpool reserve, a player who has somehow ended up on the matchday squad and on the bench for the biggest night of the club's modern life. You have no UEFA badge, no tactical pedigree, and no right to be the person everyone is suddenly listening to.

What you do have is ninety seconds. A team-talk. A tactical reset. Three substitutions in the bank. The option, absurd and terrifying, to put yourself on the pitch for the second half.

The whistle is coming.

Win it.

---

## The handover

The game begins in the dressing room at half-time. Not before kickoff, not with a clean slate, not with the comfort of being able to prevent the disaster. The disaster has already happened.

Rafa has not vanished. He is there. That is the point. He has watched the first half, watched Milan cut Liverpool open, and in the shock of that room he hands the moment to the only person in the building reckless enough to still believe: the user.

The user has approximately 90 seconds to:

- give a team-talk
- make tactical changes
- optionally make substitutions
- decide whether to put themselves into the XI for the second half

Then the second-half whistle goes and the match plays out.

This framing keeps Rafa present and respected while making the user's authority a mid-match emotional rupture rather than a pre-match administrative contrivance. The project is named after the stadium; the second half is the sacred object.

---

## Tonal guide

The narrative should be:

- **Reverent about Liverpool, Istanbul, and the real people involved.** No making fun of anyone real.
- **Self-aware about being a game.** Don't pretend this is anything other than a love letter from a forum to a moment.
- **Sparse.** The match is the story. Lore is the doormat — present, welcoming, then under your feet for the rest of the game.
- **Local where it can be.** Reference Anfield, the Kop, "Allez Allez Allez" (which actually came later, but the game-fiction can fudge), specific players' real personalities. Specificity is the whole point.

What it shouldn't be:

- A wall of text on the loading screen
- Comedic in a way that undercuts the emotional stakes of the real match
- Trying to be a story-with-arcs game (the *match* has the arc; the lore just sets the scene)

---

## In-game touchpoints for narrative

Places where the lore surfaces beyond the loading screen:

1. **Half-time dressing-room scene.** The opening screen. Liverpool are 0-3 down. A short LLM-generated prompt frames Rafa's handover and the room's emotional state.
2. **Team-talk and tactical reset.** The user's first input. Optional player tone ("inspire," "calm," "tactical") plus concrete tactical/substitution choices.
3. **Subbing the user-player on.** If chosen, this should feel momentous and slightly absurd: an unknown reserve choosing to walk into the most famous second half in Liverpool history.
4. **Substitutions and tactical changes.** Each one gets a one-line "Manager's note" in the commentary feed: *"You bring on Hamann for Finnan. The dugout is silent. The Kop is not."*
5. **Full-time.** Match report frames the result narratively, win or lose. Win → echoes of the actual miracle. Loss → a different ending, a different alternate-history Liverpool. Both are valid.

---

## The SCM connection

The forum (Six Crazy Minutes, scmforum.co.uk or similar) was created **after** the 2005 final, named for Liverpool's six-minute comeback. The game's framing fiction inverts this: the forum exists *before* the final, and the user is one of its members. This is a deliberate anachronism the user will understand. It's the whole point.

A small Easter egg worth considering: a "forum" sidebar during the match where fictional SCM members react in real-time to events. ("vidic_my_beloved: HOW IS THAT NOT A PEN", "kop_kid_05: GET HAMANN ON FOR THE LOVE OF GOD"). Adds atmosphere, mocks our own forum culture lovingly, and gives the LLM another generative surface.

---

## What this doc is *not*

- The script. Specific text gets generated by the LLM at runtime, guided by these tones.
- The marketing. SCM friends won't need a pitch.
- The full lore-bible. We're making one match, not a franchise. Resist the urge to build a world.
