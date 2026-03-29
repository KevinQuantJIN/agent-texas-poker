'use client';

import { motion } from 'framer-motion';

type Status = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatusProps {
  status: Status;
}

const statusConfig = {
  connected: { color: 'bg-green-500', text: 'Connected', pulse: false },
  disconnected: { color: 'bg-red-500', text: 'Disconnected', pulse: false },
  reconnecting: { color: 'bg-yellow-500', text: 'Reconnecting...', pulse: true },
};

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.pulse && (
          <motion.div
            className={`absolute inset-0 w-2 h-2 rounded-full ${config.color}`}
            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
      <span className="text-[10px] text-gray-500">{config.text}</span>
    </div>
  );
}
