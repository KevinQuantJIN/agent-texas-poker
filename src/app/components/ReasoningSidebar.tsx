'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { AgentThought } from '../../engine/types';
import { AGENT_COLORS } from '../mock-data';

interface ReasoningSidebarProps {
  thoughts: AgentThought[];
}

const actionBadgeColors: Record<string, string> = {
  raise: 'bg-red-500',
  call: 'bg-blue-500',
  check: 'bg-green-500',
  fold: 'bg-gray-500',
};

export default function ReasoningSidebar({ thoughts }: ReasoningSidebarProps) {
  return (
    <div className="w-80 h-full bg-[#0d1220] border-l border-gray-800 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Agent Reasoning
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence initial={false}>
          {thoughts.map((thought, i) => {
            const color = AGENT_COLORS[thought.playerId] || '#666';
            return (
              <motion.div
                key={`${thought.playerId}-${thought.timestamp}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-lg bg-[#141a2a] overflow-hidden"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {thought.playerName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      {thought.playerName}
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase ${
                      actionBadgeColors[thought.action.action]
                    }`}
                  >
                    {thought.action.action}
                    {thought.action.amount ? ` $${thought.action.amount}` : ''}
                  </span>
                </div>

                {/* Reasoning text */}
                <div className="px-3 pb-2">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {thought.reasoning}
                  </p>
                </div>

                {/* Meta */}
                <div className="px-3 pb-2 flex items-center gap-2 text-[10px] text-gray-600">
                  <span>Hand #{thought.handNumber}</span>
                  <span>&middot;</span>
                  <span className="capitalize">{thought.round}</span>
                  <span>&middot;</span>
                  <span>{thought.action.latencyMs}ms</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
