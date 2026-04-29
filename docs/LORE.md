# The Atatürk — Lore & Narrative Framing

> The fiction wrapped around the gameplay. This is what greets the user on the loading screen and frames every decision they make. Keep it short, evocative, and emotionally calibrated for SCM.

## The premise

It's 25 May 2005. The Atatürk Olympic Stadium in Istanbul. Liverpool, against expectation, against form, against the conventional wisdom of an entire continent, have made it to the Champions League final. They face Milan — the favourites, the European aristocracy, holders of the trophy two years earlier.

But Rafa Benítez isn't in the dugout.

Something has happened. (See "The Hook" below for options.) The club is in chaos. The board, the press, the players — all looking for someone to take charge.

And then they look at *you*.

You don't have Rafa's tactical pedigree. You don't have a UEFA badge. What you have is twenty years on a Liverpool forum called Six Crazy Minutes, an encyclopedic knowledge of this squad, and a weekend's worth of conviction that you can read this match better than anyone else available on short notice.

The teamsheet is yours. The dugout is yours. Istanbul is yours.

Win it.

---

## The Hook (pick one — or write a better one)

These are draft framings. Goal: explain Rafa's absence in a way that's tonally right (a touch absurdist, a touch reverent, never disrespectful to the actual man) and gets the user into the dugout fast.

### Option A — "The flight"
Rafa's plane has been grounded by an electrical storm over the Bosphorus. He's stuck in Vienna with the technical staff, a cracked phone, and an Austrian air traffic controller who doesn't speak Spanish. He'll get there for the second half if the gods are kind. Until then, the dugout is empty and Steven Gerrard is looking at the bench with the expression of a man who needs an adult.

### Option B — "The illness"
Food poisoning. Just before kickoff. Rafa is in the dressing room toilet and not coming out. The players know. The medical staff know. UEFA doesn't, and Liverpool would prefer they continue not to. *Someone* has to walk down that touchline in two minutes wearing the manager's coat. Hello, you.

### Option C — "The forum"
A simpler frame. You're a regular on a forum called Six Crazy Minutes (which, of course, doesn't exist yet — this match will name it). For reasons that don't need to be explained because dreams don't work that way, you've been pulled out of your living room and dropped into the dugout. Everyone is treating it as completely normal. The whistle is about to go.

### Option D — "The understudy"
Rafa's appendix has burst on the team coach. He's in an Istanbul hospital. Pako Ayestarán is with him. Sammy Lee is in his ear via radio but has lost his voice screaming at the team's hotel TV during the warm-up. The fourth name on the contingency sheet — for reasons of administrative chaos at LFC that the user is welcome to imagine — is yours.

**My recommendation:** Option C. It's honest about what the game *is* (a wish-fulfilment fantasy for a specific group of fans) and doesn't disrespect the real Rafa. It also lets you lean into the SCM forum reference, which is the actual emotional core. The other options can become unlockable alt-history scenarios in a future update.

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

1. **The dressing-room scene before kickoff.** A short LLM-generated address to the squad, in your manager-voice. Optional player input ("inspire," "calm," "tactical"). This is also where any tactical rationale you want to set is established.
2. **Half-time.** A genuine moment of high lore-density. Liverpool are 3-0 down at half time in the actual match — the lore must accommodate any score the user is at. The LLM dressing-room scene at half-time is the second narrative beat.
3. **Substitutions and tactical changes.** Each one gets a one-line "Manager's note" in the commentary feed: *"You bring on Hamann for Finnan. The dugout is silent. The Kop is not."*
4. **Full-time.** Match report frames the result narratively, win or lose. Win → echoes of the actual miracle. Loss → a different ending, a different alternate-history Liverpool. Both are valid.

---

## The SCM connection

The forum (Six Crazy Minutes, scmforum.co.uk or similar) was created **after** the 2005 final, named for Liverpool's six-minute comeback. The game's framing fiction inverts this: the forum exists *before* the final, and the user is one of its members. This is a deliberate anachronism the user will understand. It's the whole point.

A small Easter egg worth considering: a "forum" sidebar during the match where fictional SCM members react in real-time to events. ("vidic_my_beloved: HOW IS THAT NOT A PEN", "kop_kid_05: GET HAMANN ON FOR THE LOVE OF GOD"). Adds atmosphere, mocks our own forum culture lovingly, and gives the LLM another generative surface.

---

## What this doc is *not*

- The script. Specific text gets generated by the LLM at runtime, guided by these tones.
- The marketing. SCM friends won't need a pitch.
- The full lore-bible. We're making one match, not a franchise. Resist the urge to build a world.
