'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const speeds = [0.5, 1, 2, 5] as const;

interface SpeedControlsProps {
  handNumber: number;
  round: string;
  onSpeedChange?: (speed: number) => void;
}

export default function SpeedControls({ handNumber, round, onSpeedChange }: SpeedControlsProps) {
  const [speed, setSpeed] = useState<number>(1);

  return (
    <div
      className="flex items-center gap-4 px-4 py-2 border-t-2"
      style={{
        background: '#232344',
        borderColor: '#3d3d6b',
      }}
    >
      {/* Hand info */}
      <div className="flex items-center gap-3">
        <span className="font-retro text-[9px]" style={{ color: '#f0e6d3' }}>
          HAND #{handNumber}
        </span>
        <span
          className="font-retro text-[8px] uppercase px-2 py-0.5 rounded-[4px] border-2"
          style={{
            color: '#4fa4d4',
            borderColor: '#3d3d6b',
            background: '#1a1a2e',
          }}
        >
          {round}
        </span>
      </div>

      <div className="flex-1" />

      {/* Speed buttons */}
      <div className="flex items-center gap-1.5">
        <span className="font-retro text-[8px] mr-2" style={{ color: '#8888aa' }}>
          SPEED
        </span>
        {speeds.map((s) => (
          <motion.button
            key={s}
            onClick={() => { setSpeed(s); onSpeedChange?.(s); }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="font-retro text-[9px] px-2.5 py-1 rounded-[6px] border-2 transition-colors"
            style={{
              background: speed === s ? '#27ae60' : '#1a1a2e',
              borderColor: speed === s ? '#1e8449' : '#3d3d6b',
              color: speed === s ? '#f0e6d3' : '#8888aa',
              boxShadow: speed === s ? '0 0 8px rgba(39, 174, 96, 0.3)' : 'none',
            }}
          >
            {s}x
          </motion.button>
        ))}
      </div>
    </div>
  );
}
