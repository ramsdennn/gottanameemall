import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PokéGuesser — How many can you remember?",
  description: "Name all 386 Pokémon across Kanto, Johto and Hoenn. Four difficulties, one Pokédex, and a chance of a shiny surprise.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
