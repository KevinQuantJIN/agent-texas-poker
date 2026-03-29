import type { PlayerReaction } from '../hooks/useGameSocket';

// Balatro-style action badge colors with borders
export const actionBadgeStyles: Record<string, { bg: string; border: string }> = {
  raise: { bg: '#e8423f', border: '#b8332f' },
  call: { bg: '#4fa4d4', border: '#3a7fa8' },
  check: { bg: '#27ae60', border: '#1e8449' },
  fold: { bg: '#4a4a6a', border: '#3d3d5a' },
};

// Speech bubble tone → style mapping
export const toneStyles: Record<PlayerReaction['tone'], { bg: string; border: string; text: string }> = {
  gloat: { bg: '#2a4a2a', border: '#4ade80', text: '#4ade80' },
  tilted: { bg: '#4a2a2a', border: '#e8423f', text: '#ff6b6b' },
  respect: { bg: '#2a3a4a', border: '#4fa4d4', text: '#7dd3fc' },
  salty: { bg: '#4a3a2a', border: '#f4d03f', text: '#fbbf24' },
  chill: { bg: '#2a2a3a', border: '#8b8baa', text: '#c4c4e0' },
  devastated: { bg: '#3a2a3a', border: '#9C27B0', text: '#ce93d8' },
};

// Hand strength → color mapping for visual hierarchy
export const handStrengthColor = (made: string): { bg: string; border: string; text: string } => {
  const lower = made.toLowerCase();
  if (lower.includes('royal') || lower.includes('straight flush'))
    return { bg: '#4a1a4a', border: '#d946ef', text: '#f0abfc' };
  if (lower.includes('four of a kind') || lower.includes('full house'))
    return { bg: '#4a2a1a', border: '#f97316', text: '#fdba74' };
  if (lower.includes('flush') || lower.includes('straight'))
    return { bg: '#1a3a4a', border: '#06b6d4', text: '#67e8f9' };
  if (lower.includes('three of a kind') || lower.includes('two pair'))
    return { bg: '#2a3a1a', border: '#84cc16', text: '#bef264' };
  if (lower.includes('pair') || lower.includes('pocket'))
    return { bg: '#2a2a3a', border: '#8b8baa', text: '#c4c4e0' };
  return { bg: '#1a1a2e', border: '#3d3d6b', text: '#6a6a8a' };
};

export const actionEmoji: Record<string, string> = {
  raise: '🔥',
  call: '👀',
  check: '✅',
  fold: '💀',
};
