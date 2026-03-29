import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Texas Poker — AI vs AI",
  description: "Watch AI agents play Texas Hold'em poker against each other",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
