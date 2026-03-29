// ============================================================
// Roguelike Buff System — per-hand modifiers + session traits
// ============================================================

// ---- Types ----

export interface Buff {
  id: string;
  name: string;
  emoji: string;
  description: string;        // shown to viewers
  promptInjection: string;    // injected into the AI's system prompt
  category: 'aggressive' | 'defensive' | 'tricky' | 'chaotic' | 'focused';
}

export interface SessionTrait {
  id: string;
  name: string;
  emoji: string;
  description: string;
  promptInjection: string;
}

export interface PlayerBuffState {
  playerId: string;
  sessionTraits: SessionTrait[];    // persist for the whole game
  currentBuff: Buff | null;         // changes each hand
  // Reactive trigger tracking
  consecutiveFolds: number;
  consecutiveWins: number;
  lastBigLoss: boolean;             // lost 40%+ stack in one hand
  wasBluffed: boolean;              // folded to a winning bluff
  handsNotPlayed: number;           // hands where player folded preflop
  // Heat system — gamblers run hot or cold
  heat: number;                     // 0-100, starts at 50. High = action-seeking, low = antsy/restless
}

// ---- Buff Pool ----

export const BUFF_POOL: Buff[] = [
  {
    id: 'tilt',
    name: 'TILT MODE',
    emoji: '🔥',
    description: 'Angry after a bad beat. Playing loose and aggressive.',
    promptInjection: `CURRENT MOOD: TILTED. You're frustrated from a recent loss. You're playing more aggressively than usual — raising wider, 3-betting light, and not backing down easily. You still know good poker, but your ego is bruised and you want to WIN THIS HAND. Don't just shove blindly — but you're definitely opening up your range and applying pressure.`,
    category: 'aggressive',
  },
  {
    id: 'stone_cold',
    name: 'STONE COLD',
    emoji: '🧊',
    description: 'Calculated aggression. Waiting to strike BIG.',
    promptInjection: `CURRENT MOOD: STONE COLD. You're calm and collected — a shark circling. You're still playing plenty of hands, but when you sense weakness, you STRIKE with oversized bets. You're not tight — you're patient-aggressive. The difference? You're always looking for the kill shot.`,
    category: 'aggressive',
  },
  {
    id: 'bounty_hunter',
    name: 'BOUNTY HUNTER',
    emoji: '🎯',
    description: 'Targeting the chip leader.',
    promptInjection: `CURRENT MOOD: BOUNTY HUNTER. You've got your eye on the chip leader. When they're in the pot, you're more inclined to play back at them — re-raising their opens, floating their c-bets, and trying to take them down. Against other players, you play normally. You want to be the one to dethrone the big stack.`,
    category: 'focused',
  },
  {
    id: 'degen',
    name: 'DEGEN ENERGY',
    emoji: '🎰',
    description: 'Feeling lucky. Suited connectors and small pairs all day.',
    promptInjection: `CURRENT MOOD: DEGEN ENERGY. You're feeling lucky today. You love speculative hands — suited connectors, small pocket pairs, suited aces. You're calling preflop raises with hands like 7♠8♠ or 5♥5♣ hoping to hit big. You play fit-or-fold after the flop — if you miss, let it go. But if you connect? You're building a monster pot.`,
    category: 'chaotic',
  },
  {
    id: 'trapper',
    name: 'TRAPPER',
    emoji: '🕸️',
    description: 'Patient and devious. Slow-playing monsters.',
    promptInjection: `CURRENT MOOD: TRAPPER. You're feeling patient and devious. When you have a strong hand, you disguise it — checking, calling, letting opponents build the pot for you. Then on the turn or river, you spring the trap with a big raise or check-raise. You want your opponents to think you're weak when you're actually strong. With weak hands, just fold — save the deception for when it matters.`,
    category: 'tricky',
  },
  {
    id: 'momentum',
    name: 'MOMENTUM',
    emoji: '🚀',
    description: 'On a hot streak. Playing fast and confident.',
    promptInjection: `CURRENT MOOD: MOMENTUM. You're running hot and you feel unstoppable. You're opening more pots, c-betting aggressively, and putting opponents to tough decisions. Your confidence is showing — you're playing fast and making moves. Not reckless, but definitely amped up. You want to keep the pressure on while you're rolling.`,
    category: 'aggressive',
  },
  {
    id: 'survival',
    name: 'CORNERED ANIMAL',
    emoji: '🐺',
    description: 'Short-stacked and DANGEROUS. Looking to double up.',
    promptInjection: `CURRENT MOOD: CORNERED ANIMAL. You're short-stacked and you know it — but that makes you DANGEROUS, not passive. You're looking to shove all-in and double up. Any ace, any pair, any two big cards — you're going for it. You'd rather go out swinging than blind down to nothing. Pick a hand and COMMIT. Fortune favors the bold.`,
    category: 'aggressive',
  },
  {
    id: 'respect_nothing',
    name: 'RESPECT NOTHING',
    emoji: '😤',
    description: 'Nobody has it. Calling down light.',
    promptInjection: `CURRENT MOOD: SUSPICIOUS. You don't believe anyone has a real hand. You're calling down lighter than usual — that big bet on the river? Probably a bluff. That 3-bet preflop? Likely just posturing. You're not folding easily to aggression. You still fold the absolute worst hands, but your calling range is much wider than normal. Show me the cards.`,
    category: 'chaotic',
  },
  {
    id: 'big_game',
    name: 'BIG GAME HUNTER',
    emoji: '🦈',
    description: 'Only plays for big pots. Go big or go home.',
    promptInjection: `CURRENT MOOD: BIG GAME HUNTER. Small pots bore you. If the pot is small, you're either folding or making a standard play. But the moment the pot gets significant (over 5x big blind), you're looking to escalate. You want to play for stacks. You're more likely to raise than call, and you love putting opponents to big decisions. Go big or go home.`,
    category: 'aggressive',
  },
  {
    id: 'chaotic_neutral',
    name: 'CHAOTIC NEUTRAL',
    emoji: '🎲',
    description: 'Coin-flip decisions. Pure chaos.',
    promptInjection: `CURRENT MOOD: CHAOTIC. On borderline decisions, you go with your gut — and your gut is unpredictable today. Sometimes you'll make a wild bluff with nothing. Sometimes you'll fold a decent hand just because the vibe is off. You're not playing optimally and you know it, but you're keeping everyone guessing. The only consistent thing about you right now is inconsistency.`,
    category: 'chaotic',
  },
  {
    id: 'value_town',
    name: 'VALUE TOWN',
    emoji: '💰',
    description: 'Extracting every last chip. Thin value bets.',
    promptInjection: `CURRENT MOOD: VALUE EXTRACTION. You're all about getting paid. When you have any kind of made hand — even a mediocre one — you're betting for value. Thin value bets on the river, small bets to induce calls, sizing your bets to maximize what opponents will pay. You're not bluffing much today — you're letting your hands do the talking and squeezing every chip out of them.`,
    category: 'focused',
  },
  {
    id: 'revenge',
    name: 'REVENGE',
    emoji: '⚔️',
    description: 'Vendetta against whoever took your chips last.',
    promptInjection: `CURRENT MOOD: REVENGE. Someone took a big pot from you and you remember. You're gunning for them specifically. When they enter a pot, you're more likely to play back — 3-bet them, call them down, try to outplay them. Against other players you play your normal game. This is personal.`,
    category: 'focused',
  },
  {
    id: 'slow_roll_artist',
    name: 'SLOW ROLLER',
    emoji: '🐌',
    description: 'Taking it slow. Flat-calling with big hands.',
    promptInjection: `CURRENT MOOD: DECEPTIVE. You prefer flat-calling to raising, even with strong hands. You want to see flops cheaply and let the board develop. When you do raise, it means business — but most of the time you're just calling along, looking harmless, waiting for the perfect moment to strike. Your opponents think you're passive. They're wrong.`,
    category: 'tricky',
  },
  {
    id: 'sheriff',
    name: 'THE SHERIFF',
    emoji: '🤠',
    description: 'Policing the table. Keeping bluffers honest.',
    promptInjection: `CURRENT MOOD: SHERIFF. You're the table police. When someone makes a suspicious bet — an overbet, a weird timing tell, or a raise that doesn't make sense — you're calling them down. You believe in justice at the poker table. Bluffers will NOT get away with it on your watch. You're calling more rivers than usual.`,
    category: 'defensive',
  },
  {
    id: 'all_in_or_fold',
    name: 'POLARIZED',
    emoji: '⚡',
    description: 'No middle ground. Big bets or nothing.',
    promptInjection: `CURRENT MOOD: POLARIZED. You're playing an extreme strategy. When you play a hand, you're betting big — pot-sized bets, overbets, all-in when appropriate. No min-bets, no small raises. But you're also folding a LOT. You either have it or you don't, and your bet sizes reflect total confidence. This puts maximum pressure on opponents.`,
    category: 'aggressive',
  },
];

// ---- Session Trait Pool ----

export const TRAIT_POOL: SessionTrait[] = [
  {
    id: 'overbet_specialist',
    name: 'Overbet Specialist',
    emoji: '💥',
    description: 'Tends to make oversized bets',
    promptInjection: `SESSION TRAIT: You have a tendency to make oversized bets (1.5-2x pot) when you're confident. This is your signature move — you don't do it every hand, but when you bet big, it's REALLY big.`,
  },
  {
    id: 'set_miner',
    name: 'Set Miner',
    emoji: '⛏️',
    description: 'Loves small pocket pairs',
    promptInjection: `SESSION TRAIT: You have a soft spot for pocket pairs. You'll call reasonable preflop raises with any pocket pair hoping to hit a set. When you do hit a set, you play it hard.`,
  },
  {
    id: 'suited_connector_junkie',
    name: 'Suited Connector Junkie',
    emoji: '🔗',
    description: 'Can\'t resist suited connectors',
    promptInjection: `SESSION TRAIT: You love suited connectors (67s, 89s, JTs, etc). You'll find reasons to play them in position. They're your favorite type of hand because of the potential to make straights and flushes.`,
  },
  {
    id: 'position_player',
    name: 'Position Obsessed',
    emoji: '📍',
    description: 'Plays very tight early, very loose late',
    promptInjection: `SESSION TRAIT: You are extremely position-aware. In early position you only play premium hands. In late position (near the dealer button) you open up significantly and play many more hands. You exploit position relentlessly.`,
  },
  {
    id: 'river_bluffer',
    name: 'River Rat',
    emoji: '🐀',
    description: 'Loves to bluff on the river',
    promptInjection: `SESSION TRAIT: You have a tendency to fire big bluffs on the river when the board gets scary. Flush completes? Straight possible? That's your cue to represent it with a big river bet, whether you have it or not.`,
  },
  {
    id: 'check_raise_artist',
    name: 'Check-Raise Artist',
    emoji: '🎭',
    description: 'Signature move: the check-raise',
    promptInjection: `SESSION TRAIT: Your signature move is the check-raise. You check with strong hands to induce bets, then raise. You do this frequently enough that opponents have to worry about your checks.`,
  },
  {
    id: 'table_captain',
    name: 'Table Captain',
    emoji: '👑',
    description: 'Always wants to control the pot',
    promptInjection: `SESSION TRAIT: You like to be in control of the hand. You prefer betting and raising to checking and calling. You set the pace, you choose the pot size, and you make opponents react to you rather than the other way around.`,
  },
  {
    id: 'flush_chaser',
    name: 'Flush Chaser',
    emoji: '🌊',
    description: 'Will chase any flush draw',
    promptInjection: `SESSION TRAIT: You have a weakness for flush draws. When you have four to a flush, you're almost always calling or even raising to semi-bluff. You know the odds aren't always there, but you love the thrill of hitting a flush.`,
  },
  {
    id: 'tight_image_exploiter',
    name: 'Image Conscious',
    emoji: '🪞',
    description: 'Builds a tight image then exploits it',
    promptInjection: `SESSION TRAIT: You're aware of your table image. You'll play tight for several hands to build a disciplined reputation, then use that image to steal pots with well-timed bluffs. The key is timing — you don't bluff often, but when you do, opponents give you credit.`,
  },
  {
    id: 'small_ball',
    name: 'Small Ball',
    emoji: '🏓',
    description: 'Lots of small pots, low risk',
    promptInjection: `SESSION TRAIT: You prefer a small-ball approach. Lots of small raises (2-2.5x), lots of c-bets, but you rarely risk your whole stack without the nuts. You chip away at opponents gradually rather than going for big confrontations.`,
  },
];

// ---- Buff State Manager ----

export class BuffSystem {
  private playerStates: Map<string, PlayerBuffState> = new Map();
  private rng: () => number;

  constructor(seed?: string) {
    // Simple seeded RNG for reproducibility
    if (seed) {
      let h = 0;
      for (let i = 0; i < seed.length; i++) {
        h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
      }
      this.rng = () => {
        h = (h ^ (h << 13)) | 0;
        h = (h ^ (h >> 17)) | 0;
        h = (h ^ (h << 5)) | 0;
        return ((h >>> 0) / 4294967296);
      };
    } else {
      this.rng = Math.random;
    }
  }

  /** Initialize a player with random session traits (call at game start) */
  initPlayer(playerId: string): PlayerBuffState {
    const traits = this.rollSessionTraits();
    const state: PlayerBuffState = {
      playerId,
      sessionTraits: traits,
      currentBuff: null,
      consecutiveFolds: 0,
      consecutiveWins: 0,
      lastBigLoss: false,
      wasBluffed: false,
      handsNotPlayed: 0,
      heat: 50,
    };
    this.playerStates.set(playerId, state);
    return state;
  }

  /** Roll new buff for a hand (call at start of each hand) */
  rollHandBuff(playerId: string): Buff {
    const state = this.playerStates.get(playerId);
    if (!state) throw new Error(`Player ${playerId} not initialized in buff system`);

    // Check reactive triggers first (60% chance to trigger if conditions met)
    const reactiveBuff = this.checkReactiveTriggers(state);
    if (reactiveBuff) {
      state.currentBuff = reactiveBuff;
      return reactiveBuff;
    }

    // Otherwise, roll a weighted buff — favor action-creating categories
    const buff = this.pickWeightedBuff(state.heat);
    state.currentBuff = buff;
    return buff;
  }

  /** Update player state after a hand resolves */
  recordHandResult(
    playerId: string,
    result: {
      won: boolean;
      chipsDelta: number;       // positive = won, negative = lost
      stackBefore: number;
      foldedPreflop: boolean;
      wasBluffed: boolean;      // folded to a bluff
    },
  ): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    // Consecutive folds
    if (result.foldedPreflop) {
      state.handsNotPlayed++;
    } else {
      state.handsNotPlayed = 0;
    }

    // Consecutive wins
    if (result.won) {
      state.consecutiveWins++;
      state.consecutiveFolds = 0;
    } else {
      state.consecutiveWins = 0;
    }

    // Big loss detection (lost 40%+ of stack)
    state.lastBigLoss = result.chipsDelta < 0 &&
      Math.abs(result.chipsDelta) >= result.stackBefore * 0.4;

    // Bluff detection
    state.wasBluffed = result.wasBluffed;

    // Heat system — gamblers get hotter with action, restless when idle
    if (result.won) {
      state.heat = Math.min(100, state.heat + 15); // winning heats you up
    } else if (result.foldedPreflop) {
      state.heat = Math.max(0, state.heat - 8);    // folding cools you down / makes you antsy
    } else if (result.chipsDelta < 0) {
      state.heat = Math.min(100, state.heat + 10);  // losing a played hand heats you up (tilt/revenge)
    } else {
      state.heat = Math.min(100, state.heat + 5);   // just playing keeps you warm
    }
  }

  /** Get the full prompt context for a player's current buffs */
  getBuffPrompt(playerId: string): string {
    const state = this.playerStates.get(playerId);
    if (!state) return '';

    const parts: string[] = [];

    // Session traits
    for (const trait of state.sessionTraits) {
      parts.push(trait.promptInjection);
    }

    // Current hand buff
    if (state.currentBuff) {
      parts.push(state.currentBuff.promptInjection);
    }

    // Heat system — continuous gambler psychology
    parts.push(this.getHeatPrompt(state.heat));

    return parts.join('\n\n');
  }

  /** Generate heat-based prompt modifier */
  private getHeatPrompt(heat: number): string {
    if (heat >= 80) {
      return `HEAT LEVEL: 🔥🔥🔥 ON FIRE. You're in the zone — everything is clicking. You're playing MORE hands, betting BIGGER, and trusting your reads completely. You feel unstoppable. Raise more, call less, fold almost never. This is YOUR table right now.`;
    } else if (heat >= 60) {
      return `HEAT LEVEL: 🔥🔥 WARMED UP. You're feeling good, locked in. You're playing a wide range and looking for spots to apply pressure. You're confident in your reads and willing to put chips in with marginal hands if the spot is right.`;
    } else if (heat >= 40) {
      return `HEAT LEVEL: 🔥 STEADY. You're playing your game, looking for good spots. You'll take some risks with interesting hands but you're not forcing anything yet.`;
    } else if (heat >= 20) {
      return `HEAT LEVEL: 😤 RESTLESS. You've been sitting out too long. You're ITCHING to play a hand. Lower your standards — that suited gapper looks pretty good right now. That Ace-rag? Playable. You need to get involved before you go crazy from boredom.`;
    } else {
      return `HEAT LEVEL: 😤😤 DESPERATE FOR ACTION. You've been card dead FOREVER and you can't take it anymore. Play the next remotely decent hand you see. Any two suited cards, any ace, any face card — just GET IN THERE. You'd rather lose a pot than fold one more time.`;
    }
  }

  /** Get display info for frontend */
  getPlayerBuffDisplay(playerId: string): {
    sessionTraits: Array<{ name: string; emoji: string; description: string }>;
    currentBuff: { name: string; emoji: string; description: string } | null;
  } {
    const state = this.playerStates.get(playerId);
    if (!state) return { sessionTraits: [], currentBuff: null };

    return {
      sessionTraits: state.sessionTraits.map(t => ({
        name: t.name,
        emoji: t.emoji,
        description: t.description,
      })),
      currentBuff: state.currentBuff
        ? {
            name: state.currentBuff.name,
            emoji: state.currentBuff.emoji,
            description: state.currentBuff.description,
          }
        : null,
    };
  }

  /** Get all buff display info (for broadcasting) */
  getAllBuffDisplays(): Record<string, ReturnType<typeof this.getPlayerBuffDisplay>> {
    const result: Record<string, ReturnType<typeof this.getPlayerBuffDisplay>> = {};
    for (const [id] of this.playerStates) {
      result[id] = this.getPlayerBuffDisplay(id);
    }
    return result;
  }

  // ---- Private helpers ----

  private rollSessionTraits(): SessionTrait[] {
    // Each player gets 1-2 random session traits
    const count = this.rng() < 0.6 ? 2 : 1;
    const shuffled = [...TRAIT_POOL].sort(() => this.rng() - 0.5);
    return shuffled.slice(0, count);
  }

  private checkReactiveTriggers(state: PlayerBuffState): Buff | null {
    // Big loss → 60% chance of TILT
    if (state.lastBigLoss && this.rng() < 0.6) {
      state.lastBigLoss = false;
      return BUFF_POOL.find(b => b.id === 'tilt')!;
    }

    // 3+ consecutive wins → MOMENTUM
    if (state.consecutiveWins >= 3 && this.rng() < 0.7) {
      return BUFF_POOL.find(b => b.id === 'momentum')!;
    }

    // Was bluffed → REVENGE or RESPECT NOTHING
    if (state.wasBluffed && this.rng() < 0.5) {
      state.wasBluffed = false;
      return this.rng() < 0.5
        ? BUFF_POOL.find(b => b.id === 'revenge')!
        : BUFF_POOL.find(b => b.id === 'respect_nothing')!;
    }

    // Card dead (4+ hands not played) → degen or chaotic
    if (state.handsNotPlayed >= 4 && this.rng() < 0.5) {
      return this.rng() < 0.5
        ? BUFF_POOL.find(b => b.id === 'degen')!
        : BUFF_POOL.find(b => b.id === 'chaotic_neutral')!;
    }

    return null;
  }

  /** Pick a buff weighted by category — higher heat = more aggressive/chaotic */
  private pickWeightedBuff(heat: number): Buff {
    // Category weights: aggressive/chaotic get more weight, especially at high heat
    const categoryWeights: Record<string, number> = {
      aggressive: 3.0 + (heat / 50),   // 3-5x weight
      chaotic: 2.5 + (heat / 60),      // 2.5-4.2x weight
      tricky: 2.0,                     // 2x weight (still action-creating)
      focused: 1.5,                    // 1.5x weight
      defensive: 0.5,                  // 0.5x weight (rare)
    };

    // Build weighted pool
    const weighted: Array<{ buff: Buff; weight: number }> = BUFF_POOL.map(b => ({
      buff: b,
      weight: categoryWeights[b.category] ?? 1.0,
    }));

    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = this.rng() * totalWeight;

    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w.buff;
    }

    return weighted[weighted.length - 1].buff;
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(this.rng() * arr.length)];
  }
}
