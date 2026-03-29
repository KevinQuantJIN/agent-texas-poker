'use client';

import { motion } from 'framer-motion';

type Status = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatusProps {
  status: Status;
}

const statusConfig = {
  connected: { color: '#27ae60', text: 'ONLINE', pulse: false },
  disconnected: { color: '#e8423f', text: 'OFFLINE', pulse: false },
  reconnecting: { color: '#f4d03f', text: 'RECONNECTING', pulse: true },
};

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        {config.pulse && (
          <motion.div
            className="absolute inset-0 w-2 h-2 rounded-full"
            style={{ backgroundColor: config.color }}
            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
      <span className="font-retro text-[7px]" style={{ color: '#8888aa' }}>
        {config.text}
      </span>
    </div>
  );
}
