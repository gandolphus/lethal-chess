---
tags: [feature, idea, design, gameplay]
aliases: [Boss fight, The gauntlet, Rated rounds, Opening rating]
---

# The Open

**Status: idea, raised by the owner 2026-09-16, sharpened the same day. Not built.**

> "You can initiate a *BOSS FIGHT* or something like that. It's basically like a roguelike such as Slay
> the Spire where you fight against increasingly stronger opponents while always starting from the
> *Openings* position. The goal is getting to a winning position, or at least surviving while keeping the
> strength meter in balance, until the opening phase is over… it shouldn't be called 'Boss fight' but
> something more thematic. And we need some killer feature in this mode which really dots the i's…
> winning these fights should increase your rating of the opening in our app."

This is the answer to [[Human moves]] — the owner's earlier ask to drill against "a range of moves which
you can encounter when facing off against *human* players". A ladder of opponents **is** a distribution of
opponent strength, and giving each opponent a repertoire turns the distribution into content.

## The name

**The Open.** A Swiss open is the thing this already is: you play a fixed number of rounds, winners are
paired against winners, so beating people moves you up the field, and one bad round drops you into easier
company. It explains the ramp, the rating and the run length without inventing a metaphor, and "Round 3 of
5" needs no tutorial. Alternatives considered: *Candidates* (right shape — a ladder ending in a title
match — but implies one true champion), *The Gauntlet* (clear, generic, no chess in it), *Simul* (wrong:
a simul is one player against many at once).

## What the owner has right, and what is wrong

**Right.** A win condition is the thing [[Exploration Mode]] and line review both lack — discovery and
recall have no stakes. Always restarting from the defining position is exactly correct for opening
training: massed repetition of one branch point under varied continuations is the shape the evidence in
[[Learning science for opening training]] supports. And a rating gives the number that moves.

**Wrong: "getting to a winning position."** Openings do not win games. A correctly played Ruy Lopez gives
White about +0.3. Set the target at *winning* and the app teaches people to play for tricks and to punt on
sound moves that keep a small edge. The honest target is **leaving the opening with your evaluation
intact**, which is also what a real player is trying to do.

**Wrong, or at least dangerous: the strength meter as a health bar.** Evaluation is a *state*, not
accumulated damage. Lose 0.4 and win 0.4 back and you did not heal — your opponent blundered. Use
**cumulative win chance given away** instead: that genuinely accumulates, never un-spends itself, and the
app already computes it for every move ([[Judge]]'s win-chance model). See **Composure**, below.

**The load-bearing thing the pitch is missing.** Slay the Spire's engine is not "enemies get harder". It is
*the deck you build across the run* — the choices between fights that make fight four different from fight
one. Strip that out and a roguelike is a difficulty slider with ceremony. **Whatever carries between
rounds is the whole design**, and it is where the killer feature has to live.

## Composure: the bar that carries

A round starts from the opening's defining position and ends when the opening does — the book is exhausted
for both sides, or ply 24, whichever comes first.

- You start a run with **100 composure**.
- Every move you play spends the **win chance it gives away** (the same number the verdicts use). A best
  move costs nothing. An inaccuracy costs a little. A blunder costs a lot.
- Failing to punish an opponent's mistake spends the chance you passed up. The session already tracks
  this as `opportunity`.
- Reach the end of the opening with composure left → the round is won.
- Composure **carries between rounds**, with a partial restore after each win and a full restore only
  after a *clean* round. Run out and the run ends.

That is a health bar that is also honest chess, and it makes round one's sloppiness cost you in round
four, which is the roguelike part.

## The killer feature: opponents are people, and you scout them

The most engaging thing in Slay the Spire is not the damage numbers, it is that **you can see what the
enemy intends and you get to plan around it**. The chess version of that is preparation, which is a real
skill nobody trains.

So: **an opponent is a name, a rating and a repertoire.** Not an Elo slider on Stockfish — a *profile*.

> **Marta Vogel · 1650**
> Plays 3…a6 four times in five. Has never declined the pawn on e4. Loses the thread against 4.Ba4 Nf6 5.O-O.

Before each round you get that scouting report, and you spend **one preparation** from a small hand:

| Preparation | What it does |
| --- | --- |
| **Study** | See one book line from this position before the round starts |
| **Ban** | Name a variation your opponent will not play this round |
| **Second** | One take-back, used any time during the round |
| **Provoke** | The opponent plays their *riskiest* line rather than their most likely one |

The tension is the good kind: prepare for what is *likely*, or insure against what is *dangerous*. You
cannot do both, and the scouting report is what makes the choice legible rather than a guess.

This also resolves the human-moves problem by making it the content. An opponent's move distribution is
their character, so "the computer plays like a human" stops being a fudge and becomes the thing you are
reading.

**Second carry between rounds, optional and stronger:** the run is played out of *your own discovered
repertoire* — you may only follow lines you have found in [[Exploration Mode]]. That wires discovery
directly into the stakes and gives a reason to go back and explore between runs. Probably too punishing for
a first version; hold it.

## Rating

Per **(learner, opening)**, Glicko-2, as [[Progress Tracking]] would want it:

- Each **round** is a rated result against an opponent of known rating, not each run. A five-round run is
  five results, which is enough to move a rating meaningfully in one sitting.
- Rating deviation carries the "new opening, no idea yet" case and stops one lucky run inflating anything.
- Pair the next opponent by rating, like a Swiss. That *is* the difficulty ramp — no hand-tuned ladder.
- **Exploration is never rated.** A rating that can drop while you are exploring would make people stop
  exploring, which is the opposite of what [[Exploration Mode]] is for.

Shown as **readiness in this opening**, not as a score, because that is what it is for: it tells you which
of your openings is the weak one. That is the diagnosis a repertoire needs and nobody has.

**Retries have to be ruled on.** A rating you can re-roll is noise. Simplest honest rule: a run may be
restarted freely, but a restarted run is **unrated**; one rated run per opening per day.

## What it needs that we do not have

The scouting report is only as good as the move frequencies behind it, and the bundles carry none — only
engine evaluations and the book's own lines.

- **The Lichess opening explorer** gives, for any position, how often each move was played, split by rating
  band and time control. That is exactly the data a profile is made of.
- The pipeline already streams a Lichess dump offline (`pipeline/eval-cache/`), so the shape of the work is
  familiar: fetch frequencies for every book position at build time, bake them into the bundle next to the
  evals. A large opening is a few thousand positions — one build-time pass, cached.
- **Until then**, an opponent can be faked from what we have: sample the legal moves by engine evaluation
  with a temperature set by rating, weight the book's own `dubious` lines up, and plant blunders at a rate
  matched to the band. It will play *plausibly* but it will not play *characteristically*, and the
  difference is precisely the scouting report. Do not ship the profiles on faked data — the report would be
  a lie about a real distribution.

## Refinement, 2026-09-16 — the fork, and the way out of it

The owner, pausing before any of this is built: "It could basically be a standalone game… which poses its
own risks. One risk is it makes the rest of the app redundant… Another risk is we spend a ton of energy on
it but it still doesn't turn out that fun… the actual chess wouldn't be the main feature but just one
element in a game which might be more centred around strategising."

### The risk that is actually dangerous

Neither of the two named. "It succeeds and eats the app" is a good outcome wearing a worried face, and "it
isn't fun" is recoverable because you find out early. The dangerous state is the **middle**: a large mode
inside a training app that is neither a great mode nor a great game, absorbing the attention that would
have made the trainer sharp. That is the one to design against, and the whole of the rest of this section
is about not landing there.

### The hole in the design as written

A Slay the Spire fight is interesting because **every turn presents several defensible options**. An
opening does not. If you know the theory the move is forced; if you don't, you are guessing. Composure,
scouting and a rating all sit *around* a per-move loop that has no decision in it. Fix that or the rest is
scaffolding around a quiz.

Two fixes, and they work together:

**1. The deck is your repertoire.** Before a run you **draft**: of the variations you have discovered in
this opening, you take a limited number — say four — as the ones you are allowed to steer into. The run
then tests whether that repertoire covers what you meet. Being taken out of your prep is not a loss, it is
the *information*: it names the hole. This is the "strategising" layer the owner was reaching for, it is
made entirely of real chess decisions, and it is what a repertoire is actually for.

**2. A round has an objective, not just a survival bar.** Give each round a steer — *reach a position with
opposite-side castling*, *keep the queens on*, *trade into a structure you know* — so that several sound
moves become distinguishable and one is preferred. This converts "one right answer" into "a family of
right answers and a reason". It also teaches the truest thing about openings: they are a choice of
middlegame.

### The reframe that dissolves the cannibalisation risk

Do not build The Open as a mode inside the trainer, and do not split it off as a separate game.
**Make the trainer the game's progression system.**

| Mode | What it is in the game |
| --- | --- |
| [[Exploration Mode]] | Acquiring cards — a discovered line is a line you may draft |
| Practice (line review) | Keeping them playable |
| The Open | Spending them, rated |

Then nothing is an asterisk: Explore and Practice are not a tutorial the game outgrows, they are where the
deck comes from and how it stays sharp.

**And it yields the mechanic worth building the whole thing for: rust.** FSRS already knows, per line, how
likely you are to recall it right now. Make that a gameplay stat. A line you have not replayed in six weeks
is **rusty**: draftable, but it costs more composure to follow, or its first move is not shown to you at
all. Forgetting theory costs you in a game, which is exactly what it does over the board.

No other game can do this, because no other game has spaced repetition over real knowledge underneath it.
It is a better centrepiece than the scouting report — scouting gives one round its tension, rust gives the
whole app its reason to be one app.

### What to do first: validate the atom

Roguelike design validates the single encounter before the structure. Slay the Spire's map is worthless if
the fights are boring, and no meta layer rescues a dull round.

So: build **one round**, in a branch, as a probe — not a mode, not a run, no map, no rating.

- One opening, one hand-written opponent persona with a real repertoire.
- The scouting report on that persona.
- One preparation to spend.
- Composure draining over eight learner moves.
- A verdict at the end.

One or two days. Then answer one question honestly: **do you want to press "again"?** If yes, the draft,
the route, the rating and the rest are worth building and you will know what they are for. If no, no amount
of meta will save it, and the trainer is better for having the two days back.

### If it does become a standalone game

Worth knowing the precedent before committing. Games that wrap **unmodified** chess in a meta-layer have a
poor record; the ones that landed — Shotgun King, Pawnbarian — work because they **changed the rules of the
chess**. A standalone version of this is therefore probably not "lethal-chess with a Steam page"; it is a
different thing where the board or the pieces change.

What is genuinely unexplored is **opening preparation as a core loop** — scout, draft, prepare, resolve.
Nobody has built that, and the reason nobody has is that it needs a corpus of named lines, per-position
evaluations and a per-learner memory model underneath it. We already have all three. That is the bet worth
making, and it is only available to us *because* the trainer exists.

## Open questions

- Run length. Five rounds at roughly a minute each puts a run inside a coffee break, which is the right
  size. Seven if rounds turn out shorter.
- Does a lost round end the run, or only losing all composure? Composure alone is the softer, better rule —
  you can lose a round and keep going, which is what a Swiss does.
- Do lines met during a run count as discovered? Leaning yes for *entered*, no for *discovered*: you met
  it, you did not find it.
- Where does it live? On the [[Opening dashboard]], as the third approach next to Explore and Practice.
