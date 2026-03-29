import type { AgentThought, GameState } from '../engine/types';

const REASONING_BUFFER_SIZE = 20;

/**
 * StateManager handles pacing, speed control, and reasoning buffer
 * for the spectator experience.
 */
export class StateManager {
  private speed: number = 1;
  private reasoningBuffer: AgentThought[] = [];
  private currentGameState: GameState | null = null;

  /** Timing constants at 1x speed (in ms) */
  static readonly BASE_TIMINGS = {
    dealAnimation: 1000,
    actionDisplay: 2000,
    communityCardReveal: 1500,
    showdown: 3000,
  };

  setSpeed(speed: number): void {
    if ([0.5, 1, 2, 5].includes(speed)) {
      this.speed = speed;
    }
  }

  getSpeed(): number {
    return this.speed;
  }

  /** Get timing in ms adjusted for current speed. */
  getTiming(key: keyof typeof StateManager.BASE_TIMINGS): number {
    return StateManager.BASE_TIMINGS[key] / this.speed;
  }

  /**
   * Wait for the minimum display time, accounting for how long the LLM took.
   * If LLM responded faster than min time, hold "thinking" animation.
   * If LLM took longer, no additional wait.
   */
  async waitForPacing(llmLatencyMs: number, timingKey: keyof typeof StateManager.BASE_TIMINGS = 'actionDisplay'): Promise<void> {
    const minDisplay = this.getTiming(timingKey);
    const remainingWait = minDisplay - llmLatencyMs;
    if (remainingWait > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingWait));
    }
  }

  addThought(thought: AgentThought): void {
    this.reasoningBuffer.push(thought);
    if (this.reasoningBuffer.length > REASONING_BUFFER_SIZE) {
      this.reasoningBuffer.shift();
    }
  }

  getReasoningBuffer(): AgentThought[] {
    return [...this.reasoningBuffer];
  }

  setGameState(state: GameState): void {
    this.currentGameState = state;
  }

  getGameState(): GameState | null {
    return this.currentGameState;
  }

  reset(): void {
    this.reasoningBuffer = [];
    this.currentGameState = null;
  }
}
