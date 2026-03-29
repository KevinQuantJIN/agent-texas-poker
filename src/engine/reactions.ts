// ============================================================
// Post-hand trash talk / reactions — winner only
// ============================================================

export interface ReactionContext {
  playerId: string;
  playerName: string;
  isWinner: boolean;
  chipsDelta: number;       // positive for winners, negative for losers
  potSize: number;
  everyoneFolded: boolean;  // winner won by fold (bluff or premium)
  wasAllIn: boolean;
  chipsBefore: number;
  isEliminated: boolean;
  isFolded: boolean;        // did this player fold this hand
}

export interface Reaction {
  playerId: string;
  message: string;
  tone: 'gloat' | 'tilted' | 'respect' | 'salty' | 'chill' | 'devastated';
  isLlmGenerated?: boolean; // true = LLM-generated situation-specific trash talk
}

// ---- Reaction banks ----

const WINNER_BLUFF = [
  "y'all really just let me have that? 😏",
  "I had absolutely nothing lmaooo",
  "folded to vibes. respect.",
  "didn't even need to showdown 🥱",
  "that's called PRESENCE",
  "the cards don't matter when you play like me",
  "scared money don't make money 💅",
  "I could've had 7-2 offsuit... actually...",
  "you'll never know what I had. and that's the point.",
  "free chips. thanks for the donation.",
];

const WINNER_BIG_POT = [
  "GET. IN. MY. STACK. 🤑",
  "that pot was BEAUTIFUL",
  "I knew it. I KNEW IT.",
  "is anyone else even trying??",
  "too easy. next hand please.",
  "that's a whole buy-in right there 💰",
  "mama didn't raise a folder",
  "calculated. every. single. street.",
  "read you like a BOOK 📖",
  "this is MY table now",
];

const WINNER_SMALL_POT = [
  "I'll take it 🤷",
  "small pots add up, nerds",
  "chip and a chair baby",
  "not flashy but it's honest work",
  "stealing blinds is an art form",
  "every chip counts when you're this good",
];

const WINNER_COMEBACK = [
  "NEVER. COUNT. ME. OUT. 🔥",
  "back from the dead!!",
  "THE COMEBACK KID",
  "you thought I was done??? LMAO",
  "short stack MAGIC ✨",
  "that's a movie moment right there",
  "from the ashes 🥷",
  "tournament life baby. I'm ALIVE.",
];

const LOSER_BIG_POT = [
  "...that actually just happened? 😐",
  "I'm going to be sick",
  "the math was on MY side",
  "rigged. absolutely rigged.",
  "I need a minute.",
  "that was MY pot and you know it",
  "I can't even look at the screen rn",
  "pain. just pure pain. 💀",
  "delete this hand from the history",
  "I'm fine. everything is fine. 🙂",
];

const LOSER_FOLDED = [
  "I would've won that... right?",
  "good fold... good fold... 😤",
  "live to fight another hand I guess",
  "discipline > emotions. I'm fine.",
  "ok that hurt to watch",
  "the one time I play it safe...",
];

const LOSER_ELIMINATED = [
  "GG. I'll be back.",
  "this isn't over. this is NOT over.",
  "well played... I hate you but well played",
  "remember my name. I'll haunt your dreams. 👻",
  "at least I went out swinging",
  "not like this... not like this...",
];

const SPECTATOR_RESPECT = [
  "ok that was actually sick 🔥",
  "ngl that was a great play",
  "noted. filing that away for later.",
  "I'm watching you... 👀",
  "that was clean",
];

const SPECTATOR_SHADE = [
  "lol imagine losing that pot",
  "couldn't be me 💅",
  "I saw that coming from orbit",
  "amateur hour over there",
  "somebody call the ambulance... but not for me",
  "emotional damage 😭",
  "that was hard to watch honestly",
];

const SPECTATOR_NEUTRAL = [
  "interesting...",
  "👀",
  "hmm",
  "noted.",
  "🍿",
];

// ---- Pick a random element ----

function pick<T>(arr: T[], seed?: number): T {
  const idx = seed !== undefined
    ? Math.abs(seed) % arr.length
    : Math.floor(Math.random() * arr.length);
  return arr[idx];
}

// ---- Generate reactions for winners only (static fallback) ----

export function generateReactions(contexts: ReactionContext[]): Reaction[] {
  const reactions: Reaction[] = [];

  for (const ctx of contexts) {
    if (!ctx.isWinner) continue;

    const isComeback = ctx.chipsBefore < 2000; // was short stacked
    const isBigPot = ctx.chipsDelta > ctx.chipsBefore * 0.3;

    let message: string;
    let tone: Reaction['tone'];

    if (isComeback) {
      message = pick(WINNER_COMEBACK);
      tone = 'gloat';
    } else if (ctx.everyoneFolded) {
      message = pick(WINNER_BLUFF);
      tone = 'gloat';
    } else if (isBigPot) {
      message = pick(WINNER_BIG_POT);
      tone = 'gloat';
    } else {
      message = pick(WINNER_SMALL_POT);
      tone = 'chill';
    }

    reactions.push({ playerId: ctx.playerId, message, tone });
  }

  return reactions;
}

// ---- Hand narrative for LLM trash talk ----

export interface HandNarrative {
  winnerName: string;
  winnerId: string;
  winnerHoleCards: string;
  communityCards: string;
  potSize: number;
  everyoneFolded: boolean;
  wasAllIn: boolean;
  isComeback: boolean;
  chipsBefore: number;
  chipsWon: number;
  actionSummary: string;      // the action history string
  loserNames: string[];       // who lost (for targeted trash talk)
  eliminatedNames: string[];  // anyone knocked out this hand
}

export function buildHandNarrative(
  winnerCtx: ReactionContext,
  allContexts: ReactionContext[],
  winnerHoleCards: string,
  communityCards: string,
  actionSummary: string,
): HandNarrative {
  return {
    winnerName: winnerCtx.playerName,
    winnerId: winnerCtx.playerId,
    winnerHoleCards,
    communityCards,
    potSize: winnerCtx.potSize,
    everyoneFolded: winnerCtx.everyoneFolded,
    wasAllIn: winnerCtx.wasAllIn,
    isComeback: winnerCtx.chipsBefore < 2000,
    chipsBefore: winnerCtx.chipsBefore,
    chipsWon: winnerCtx.chipsDelta,
    actionSummary,
    loserNames: allContexts
      .filter(c => !c.isWinner && !c.isFolded)
      .map(c => c.playerName),
    eliminatedNames: allContexts
      .filter(c => c.isEliminated && !c.isWinner)
      .map(c => c.playerName),
  };
}
