"use client";

import './leaderboard.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { GameBoard } from '@/components/game-board';
import { SoundToggle } from '@/components/sound-toggle';
import { Leaderboard } from '@/components/leaderboard';
import { leaderboardCategory, type SubmissionResult } from '@/lib/leaderboard';
import { createRun, submitGuess, giveUp, type Pokemon, type Run, type Difficulty } from '@/lib/game';
import { createClientId } from '@/lib/client-id';
import { classifyVoiceGuess, type VoiceGuessOutcome } from '@/lib/voice';

const generations = [
 {id:1,name:'Kanto',count:151,range:'001 — 151'},
 {id:2,name:'Johto',count:100,range:'152 — 251'},
 {id:3,name:'Hoenn',count:135,range:'252 — 386'},
];
const difficulties = [
 {id:'easy',name:'Easy',detail:'Silhouettes + Pokédex hints'},
 {id:'medium',name:'Medium',detail:'Silhouettes only'},
 {id:'hard',name:'Hard',detail:'No help'},
 {id:'very-hard',name:'Very hard',detail:'No help and in Pokédex order'},
];
const artThemes = ['starters','legendaries','legendaries2'] as const;
type ArtTheme = typeof artThemes[number];
const menuArt:Record<ArtTheme,string[][]> = {
 starters:[['001','004','007'],['152','155','158'],['252','255','258']],
 legendaries:[['144','145','146'],['243','244','245'],['382','383','384']],
 legendaries2:[['150','151'],['249','250','251'],['380','381','385']],
};

export default function Home({ preview = false }: { preview?: boolean }) {
 const [selected,setSelected] = useState([1]);
 const [difficulty,setDifficulty] = useState('easy');
 const [artTheme,setArtTheme] = useState<ArtTheme>('starters');
 const [catalogue,setCatalogue] = useState<Pokemon[]>([]);
 const [error,setError] = useState('');
 const [run,setRun] = useState<Run|null>(null);
 const runRef=useRef<Run|null>(null);
 const [runId,setRunId]=useState(0);
 const [leaderboardOpen,setLeaderboardOpen]=useState(false);
 const [submissionId,setSubmissionId]=useState('');
 const [submissionOutcome,setSubmissionOutcome]=useState<SubmissionResult|null>(null);
 const [soundEnabled,setSoundEnabled]=useState(true);
 const [nextGameVoice,setNextGameVoice]=useState(false);
 const [initialVoiceEnabled,setInitialVoiceEnabled]=useState(false);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const shinyAudioRef=useRef<HTMLAudioElement|null>(null);
 const hallOfFameAudioRef=useRef<HTMLAudioElement|null>(null);
 const completedRunAudioRef=useRef<number|null>(null);
 const rollArtTheme=useCallback(()=>setArtTheme(artThemes[preview?0:Math.floor(Math.random()*artThemes.length)]),[preview]);

 useEffect(()=>{
  audioRef.current=new Audio('/audio/menu-select.mp3');
  audioRef.current.preload='auto';
  shinyAudioRef.current=new Audio('/audio/shiny-sparkle-gen3.mp3');
  shinyAudioRef.current.preload='auto';
  hallOfFameAudioRef.current=new Audio('/audio/hall-of-fame.mp3');
  hallOfFameAudioRef.current.preload='auto';
  hallOfFameAudioRef.current.loop=false;
  setSoundEnabled(localStorage.getItem('pokeguesser-menu-sound')!=='muted');
  return()=>{
   if(audioRef.current){audioRef.current.pause();audioRef.current=null;}
   if(shinyAudioRef.current){shinyAudioRef.current.pause();shinyAudioRef.current=null;}
   if(hallOfFameAudioRef.current){hallOfFameAudioRef.current.pause();hallOfFameAudioRef.current=null;}
  };
 },[]);
 useEffect(()=>{rollArtTheme();},[rollArtTheme]);
 const playMenuSound=useCallback((force=false)=>{
  if(!force&&!soundEnabled)return;
  const audio=audioRef.current;
  if(!audio)return;
  audio.pause();audio.currentTime=0;
  void audio.play().catch(()=>{});
 },[soundEnabled]);
 const playShinySound=useCallback(()=>{
  if(!soundEnabled)return;
  const audio=shinyAudioRef.current;
  if(!audio)return;
  audio.pause();audio.currentTime=0;
  void audio.play().catch(()=>{});
 },[soundEnabled]);
 const toggleSound=()=>{
  const next=!soundEnabled;
  if(soundEnabled)playMenuSound();
  if(!next&&hallOfFameAudioRef.current){hallOfFameAudioRef.current.pause();hallOfFameAudioRef.current.currentTime=0;}
  setSoundEnabled(next);
  localStorage.setItem('pokeguesser-menu-sound',next?'enabled':'muted');
  if(next)playMenuSound(true);
 };
 const updateRun=useCallback((next:Run|null)=>{runRef.current=next;setRun(next);},[]);
 const startRun=(voiceEnabled=false)=>{if(!catalogue.length||!selected.length)return;playMenuSound();setLeaderboardOpen(false);setSubmissionId(createClientId());setSubmissionOutcome(null);setInitialVoiceEnabled(voiceEnabled);setNextGameVoice(false);updateRun(createRun(catalogue,selected,difficulty as Difficulty));setRunId(id=>id+1);window.scrollTo(0,0);};
 const onGuess=useCallback((value:string)=>{const current=runRef.current;if(!current)return false;const next=submitGuess(current,value,performance.now());if(next===current)return false;const foundShiny=Object.entries(next.revealed).some(([id,reveal])=>!current.revealed[Number(id)]&&reveal.shiny);if(foundShiny)playShinySound();updateRun(next);return true;},[playShinySound,updateRun]);
 const onVoiceGuess=useCallback((value:string,heard:string):VoiceGuessOutcome=>{const current=runRef.current;if(!current)return {kind:'no-match'};const outcome=classifyVoiceGuess(current,value,heard);if(outcome.kind==='accepted')onGuess(outcome.name);return outcome;},[onGuess]);

 useEffect(()=>{
  if(run?.status!=='complete'||completedRunAudioRef.current===runId)return;
  completedRunAudioRef.current=runId;
  if(!soundEnabled)return;
  const audio=hallOfFameAudioRef.current;
  if(!audio)return;
  audio.pause();audio.currentTime=0;
  void audio.play().catch(()=>{});
 },[run?.status,runId,soundEnabled]);

 useEffect(()=>{let active=true;fetch('/pokemon/catalogue.json').then(r=>{if(!r.ok)throw Error('Unable to load Pokémon data.');return r.json() as Promise<Pokemon[]>;}).then((data:Pokemon[])=>{if(active)setCatalogue(data);}).catch(()=>{if(active)setError('Pokémon data could not load. Refresh to try again.');});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(preview)return;
  type Registry={registerTool:(tool:object,options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document & {modelContext?:Registry}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  try{Promise.resolve(context.registerTool({name:'submit_pokemon_guess',description:'Submit a name in the active PokéGuesser run. Does not start a new game.',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{if(!input||typeof input!=='object'||!('name' in input)||typeof input.name!=='string')throw Error('A Pokémon name is required.');if(runRef.current?.status!=='playing')throw Error('Open a game first.');let accepted=false;flushSync(()=>{accepted=onGuess(input.name as string);});return {accepted,revealed:Object.keys(runRef.current!.revealed).length,status:runRef.current!.status};}}, {signal:lifecycle.signal})).catch(()=>{});}catch{}
  return()=>lifecycle.abort();
 },[onGuess,preview]);

 const count = generations.filter(g=>selected.includes(g.id)).reduce((sum,g)=>sum+g.count,0);
 const openLeaderboard=()=>{playMenuSound();setLeaderboardOpen(true);window.scrollTo(0,0);};
 const mainMenu=()=>{playMenuSound();setLeaderboardOpen(false);setSubmissionOutcome(null);rollArtTheme();updateRun(null);window.scrollTo(0,0);};
 const leaderboard=leaderboardOpen?<Leaderboard initialCategory={leaderboardCategory(run?.generationIds??selected)??'kanto'} initialDifficulty={run?.difficulty??difficulty as Difficulty} run={run} submissionId={submissionId} outcome={submissionOutcome} onSubmitted={setSubmissionOutcome} onMainMenu={mainMenu} onBack={run?()=>{playMenuSound();setLeaderboardOpen(false);window.scrollTo(0,0);}:undefined} onUiSound={playMenuSound}/>:null;
 if(run)return <main className="shell page-shell"><div className="utility-row"><SoundToggle enabled={soundEnabled} onToggle={toggleSound}/></div>{leaderboard}<div hidden={leaderboardOpen}><GameBoard key={runId} run={run} initialVoiceEnabled={initialVoiceEnabled} onGuess={onGuess} onVoiceGuess={onVoiceGuess} onGiveUp={()=>{playMenuSound();updateRun(giveUp(runRef.current!,performance.now()));}} onReplay={()=>startRun(false)} onSettings={mainMenu} onUiSound={playMenuSound} onLeaderboard={leaderboardCategory(run.generationIds)?openLeaderboard:undefined} submitted={!!submissionOutcome}/></div></main>;
 if(leaderboardOpen)return <main className="shell page-shell"><div className="utility-row"><SoundToggle enabled={soundEnabled} onToggle={toggleSound}/></div>{leaderboard}</main>;

 return <main className="shell page-shell"><div className="utility-row"><SoundToggle enabled={soundEnabled} onToggle={toggleSound}/></div><section className="welcome"><div className="site-title-row welcome-title"><h1>Gotta name 'em all!</h1></div><section className="setup-panel">{error&&<p role="alert">{error}</p>}<div className="section-label"><h2>Pick the regions you want to play and the difficulty level.</h2></div><div className="generation-options">{generations.map((g,i)=><label key={g.id} className={'generation-card '+(selected.includes(g.id)?'selected':'')}><input className="choice-input" type="checkbox" aria-label={'Generation '+g.id} checked={selected.includes(g.id)} onChange={e=>{playMenuSound();setSelected(prev=>e.target.checked?[...prev,g.id]:prev.filter(id=>id!==g.id));}}/><span className="region-ball" aria-hidden="true"><img src={selected.includes(g.id)?'/ui/pokeball-open.png':'/ui/pokeball-closed.png'} alt=""/></span><div className="generation-art">{menuArt[artTheme][i].map(id=><img key={id} src={`/menu/${artTheme}/gen${g.id}/${id}.png`} alt="" width="64" height="64"/>)}</div><h3>{g.name}</h3><p>#{g.range}</p></label>)}</div><div className="difficulty-options" role="radiogroup" aria-label="Difficulty">{difficulties.map(d=><label className={'difficulty-card '+(difficulty===d.id?'selected':'')} key={d.id}><input className="choice-input" type="radio" name="difficulty" value={d.id} checked={difficulty===d.id} onChange={()=>{if(d.id!==difficulty)playMenuSound();setDifficulty(d.id);}}/><span className="difficulty-ball" aria-hidden="true"><img src={difficulty===d.id?'/ui/pokeball-open.png':'/ui/pokeball-closed.png'} alt=""/></span><div><strong>{d.name}</strong><small>{d.detail}</small></div></label>)}</div><label className={'voice-menu-toggle '+(nextGameVoice?'selected':'')}><input className="choice-input" type="checkbox" checked={nextGameVoice} onChange={event=>{playMenuSound();setNextGameVoice(event.target.checked);}}/><span className="voice-checkmark" aria-hidden="true"/><span><strong>{nextGameVoice?'Voice Enabled':'Enable Voice'}</strong><small>{nextGameVoice?'When you press PLAY, the microphone will start listening.':'Allows you to use your voice to name Pokémon. Microphone permission will be requested.'}</small></span></label><div className="start-row"><div className="start-copy"><strong>{count} Pokémon</strong><span>{count?"A world of dreams and adventures with POKéMON awaits! Let's go!":'You need to select a region to play. PROF. OAK, next door is looking for you.'}</span>{selected.length>0&&!leaderboardCategory(selected)&&<span className="leaderboard-eligibility">Note: These region selections don't have a leaderboard.</span>}</div><div className="start-buttons"><button className="primary-button red-action" onClick={openLeaderboard}>View Leaderboard</button><button className="primary-button" onClick={()=>startRun(nextGameVoice)} disabled={!count||!catalogue.length}>Play</button></div></div></section></section></main>;
}
