"use client";

export function SoundToggle({enabled,onToggle}:{enabled:boolean;onToggle:()=>void}) {
 const label=enabled?'Mute game sounds':'Enable game sounds';
 return <button type="button" className="sound-toggle" aria-label={label} onClick={onToggle} aria-pressed={!enabled}>
  <svg className="pixel-speaker" viewBox="0 0 16 16" width="32" height="32" aria-hidden="true" shapeRendering="crispEdges">
   <path className="speaker-shadow" d="M1 6h3V4h2V2h3v12H6v-2H4v-2H1z"/>
   <path className="speaker-body" d="M1 5h3V3h2V1h2v12H6v-2H4V9H1z"/>
   {enabled?<><path className="speaker-wave" d="M10 4h1v1h1v6h-1v1h-1v-2h1V6h-1z"/><path className="speaker-wave" d="M13 2h1v2h1v8h-1v2h-1v-2h1V4h-1z"/></>:<><path className="speaker-mute-shadow" d="M10 5h1v1h1v1h1V6h1V5h1v2h-1v1h-1v1h1v1h1v2h-1v-1h-1v-1h-1v1h-1v1h-1v-2h1V9h1V8h-1V7h-1z"/><path className="speaker-mute" d="M10 4h1v1h1v1h1V5h1V4h1v2h-1v1h-1v1h1v1h1v2h-1v-1h-1V9h-1v1h-1v1h-1V9h1V8h1V7h-1V6h-1z"/></>}
  </svg>
 </button>;
}
