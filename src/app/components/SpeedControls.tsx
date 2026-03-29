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
    <div className="flex items-center gap-4 px-4 py-2 bg-[#0d1220] border-t border-gray-800">
      {/* Hand info */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="font-medium text-gray-300">Hand #{handNumber}</span>
        <span className="capitalize px-2 py-0.5 rounded bg-gray-800 text-gray-300">{round}</span>
      </div>

      <div className="flex-1" />

      {/* Speed buttons */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-2">Speed</span>
        {speeds.map((s) => (
          <motion.button
            key={s}
            onClick={() => { setSpeed(s); onSpeedChange?.(s); }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              speed === s
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s}x
          </motion.button>
        ))}
      </div>
    </div>
  );
}
