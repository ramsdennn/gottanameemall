import './comparison.css';

export default function FontComparison() {
  return <main className="font-comparison">
    <header className="comparison-heading">
      <div><h1>Choose your pixel font</h1><p>Same welcome screen, sizes, spacing, and Pokémon. Only the font changes.</p></div>
      <a href="/">Back to game</a>
    </header>
    <div className="comparison-columns">
      <section><header><h2>PokeGuesserPixel-Regular</h2><span>Previous font</span><a href="/font-preview-current" target="_blank" rel="noreferrer">View full size ↗</a></header><iframe title="Welcome screen with PokeGuesserPixel-Regular" src="/font-preview-current" /></section>
      <section><header><h2>pokepixel-gba</h2><span>Selected font</span><a href="/font-preview-gba" target="_blank" rel="noreferrer">View full size ↗</a></header><iframe title="Welcome screen with pokepixel-gba" src="/font-preview-gba" /></section>
    </div>
  </main>;
}
