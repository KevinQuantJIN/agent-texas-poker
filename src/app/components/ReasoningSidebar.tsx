'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentThought } from '../../engine/types';

interface ReasoningSidebarProps {
  thoughts: AgentThought[];
}

const actionEmoji: Record<string, string> = {
  raise: '🔥',
  call: '👀',
  check: '✅',
  fold: '💀',
};

const actionColors: Record<string, string> = {
  raise: '#e8423f',
  call: '#4fa4d4',
  check: '#27ae60',
  fold: '#4a4a6a',
};

export default function ReasoningSidebar({ thoughts }: ReasoningSidebarProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [thoughts]);

  return (
    <div
      className="w-full h-full flex flex-col border-l-2"
      style={{
        background: '#1a1a2e',
        borderColor: '#3d3d6b',
      }}
    >
      {/* Header — Balatro panel style */}
      <div
        className="px-4 py-3 border-b-2 flex items-center justify-between"
        style={{
          background: '#232344',
          borderColor: '#3d3d6b',
        }}
      >
        <h2 className="font-retro text-[10px] uppercase tracking-wider" style={{ color: '#f0e6d3' }}>
          Live Chat
        </h2>
        <span
          className="font-retro text-[8px] px-2 py-0.5 rounded-[4px] border"
          style={{
            color: '#8888aa',
            borderColor: '#3d3d6b',
            background: '#1a1a2e',
          }}
        >
          {thoughts.length}
        </span>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 balatro-scroll">
        <AnimatePresence initial={false}>
          {thoughts.map((thought) => {
            const color = thought.color || '#8888aa';
            const action = thought.action.action;
            const amount = thought.action.amount;

            return (
              <motion.div
                key={`${thought.playerId}-${thought.timestamp}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="group py-1.5 px-2 rounded-[6px] transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#232344'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div className="flex items-start gap-1.5 text-sm leading-relaxed">
                  {/* Action emoji */}
                  <span className="shrink-0 mt-0.5 text-xs">{actionEmoji[action] || '🃏'}</span>

                  {/* Message content */}
                  <div className="min-w-0">
                    <span
                      className="font-bold cursor-default"
                      style={{ color }}
                    >
                      {thought.playerName}
                    </span>
                    <span
                      className="mx-1 font-bold"
                      style={{ color: actionColors[action] || '#8888aa' }}
                    >
                      {action.toUpperCase()}
                      {amount ? ` $${amount}` : ''}
                    </span>
                    <span style={{ color: '#f0e6d3' }}>
                      {thought.reasoning}
                    </span>
                  </div>
                </div>

                {/* Meta on hover */}
                <div
                  className="hidden group-hover:flex items-center gap-1.5 ml-5 mt-0.5 font-retro text-[7px]"
                  style={{ color: '#4a4a6a' }}
                >
                  <span>H#{thought.handNumber}</span>
                  <span>·</span>
                  <span className="capitalize">{thought.round}</span>
                  <span>·</span>
                  <span>{thought.action.latencyMs}ms</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
