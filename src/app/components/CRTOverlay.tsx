'use client';

export default function CRTOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
    >
      {/* Scanlines */}
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.12) 0px,
            rgba(0, 0, 0, 0.12) 1px,
            transparent 1px,
            transparent 3px
          )`,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0, 0, 0, 0.5) 100%)',
        }}
      />

      {/* Subtle flicker — very faint animated opacity */}
      <div
        className="absolute inset-0 animate-crt-flicker"
        style={{
          background: 'rgba(0, 0, 0, 0.02)',
        }}
      />
    </div>
  );
}
