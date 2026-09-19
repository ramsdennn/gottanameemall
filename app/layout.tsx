import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gotta Name 'em All!",
  description: "Name all 386 Pokémon across Kanto, Johto and Hoenn. Four difficulties, one Pokédex, and a chance of a shiny surprise.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: { url: "/favicon.png", type: "image/png" },
    shortcut: "/favicon.png",
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
