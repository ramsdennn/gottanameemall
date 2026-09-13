"use client";
import { memo, useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { elapsed, formatTime, normalize, matchGuess, type Pokemon, type Reveal, type Run, type Sprite } from '@/lib/game';
import { oakRating } from '@/lib/oak-rating';

function AnimatedSprite({sprite}:{sprite:Sprite}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 const [ready,setReady]=useState(false);
 const [finished,setFinished]=useState(false);
 useEffect(()=>{
  setReady(false);
  setFinished(false);
  if(sprite.durations.length<2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches){setFinished(true);return;}
  let cancelled=false,request=0;
  const image=new Image();
  image.onload=()=>{
   if(cancelled)return;
   const context=canvas.current?.getContext('2d');
   if(!context)return;
   context.imageSmoothingEnabled=false;
   const drawFrame=(frame:number)=>{context.clearRect(0,0,64,64);context.drawImage(image,(frame%sprite.columns)*64,Math.floor(frame/sprite.columns)*64,64,64,0,0,64,64);};
   const boundaries:number[]=[];let duration=0;
   sprite.durations.forEach(d=>{duration+=d;boundaries.push(duration);});
   const start=performance.now();let previous=-1;
   setReady(true);
   const tick=(now:number)=>{
    if(cancelled)return;
    const elapsed=now-start;
    if(elapsed>=duration){setReady(false);setFinished(true);return;}
    const frame=boundaries.findIndex(end=>elapsed<end);
    if(frame!==previous){drawFrame(frame);previous=frame;}
    request=requestAnimationFrame(tick);
   };
   tick(start);
  };
  image.src=sprite.sheet;
  return ()=>{cancelled=true;cancelAnimationFrame(request);image.onload=null;};
 },[sprite]);
 return <span className="sprite-wrap"><img src={finished?sprite.last:sprite.still} alt="" width={64} height={64} style={{visibility:ready?'hidden':'visible'}}/><canvas ref={canvas} width={64} height={64} hidden={!ready} aria-hidden="true"/></span>;
}

const PokemonCell=memo(function PokemonCell({pokemon,hidden,reveal,hints,silhouette,ended,next,celebrating}:{pokemon:Pokemon;hidden:Sprite;reveal?:Reveal;hints:boolean;silhouette:boolean;ended:boolean;next:boolean;celebrating:boolean}){
 const [open,setOpen]=useState(false);
 const missed=ended&&!reveal;
 const visible=!!reveal||missed;
 const entryAvailable=visible||hints;
 const contents=<><span className="dex-number">#{String(pokemon.id).padStart(3,'0')}</span><span className="pokemon-image">{reveal?<AnimatedSprite sprite={reveal.sprite}/>:missed?<img src={hidden.last} alt="" width={64} height={64}/>:silhouette?<img className="silhouette" src={hidden.last} alt="" width={64} height={64}/>:<img className="guess-pokeball" src="/ui/pokeball-guess.png" alt=""/>}</span><span className="pokemon-name">{visible?pokemon.name:entryAvailable?'View hint':''}</span></>;
 const className='pokemon-cell'+(reveal?' caught':'')+(reveal?.shiny?' shiny':'')+(celebrating?' shiny-reveal':'')+(missed?' missed':'')+(next?' next':'');
 const state=reveal?'caught':missed?'missed':'hidden';
 if(!entryAvailable)return <div className={className} data-pokemon={pokemon.id} data-state={state} aria-label={`Number ${pokemon.id}`}>{contents}</div>;
 return <Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger asChild><button type="button" className={className} data-pokemon={pokemon.id} data-state={state} aria-label={`${visible?'Pokédex entry for '+pokemon.name:'Pokédex hint for number '+pokemon.id}`} onClick={()=>setOpen(true)} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>{contents}</button></TooltipTrigger><TooltipContent className="dex-tooltip" sideOffset={8} onPointerDownOutside={()=>setOpen(false)}><div className="dex-tooltip-heading"><strong>#{String(pokemon.id).padStart(3,'0')}</strong><span className="type-badges">{pokemon.types.map(type=><img key={type} src={`/types/${type}.png`} alt={type} width={32} height={16}/>)}</span></div><div className="dex-tooltip-entry"><p>{pokemon.description}</p></div></TooltipContent></Tooltip>;
});

function Timer({run,active}:{run:Run;active:boolean}){
 const [now,setNow]=useState(()=>performance.now());
 useEffect(()=>{setNow(performance.now());if(run.startedAt===null||run.endedAt!==null)return;const timer=setInterval(()=>setNow(performance.now()),100);return()=>clearInterval(timer);},[run.startedAt,run.endedAt]);
 return <div className="timer"><span>{active?'TIME ELAPSED':'TIME'}</span><strong>{formatTime(elapsed(run,now))}</strong></div>;
}
export function GameBoard({run,onGuess,onGiveUp,onReplay,onSettings,onUiSound,onLeaderboard,submitted}:{run:Run;onGuess:(value:string)=>boolean;onGiveUp:()=>void;onReplay:()=>void;onSettings:()=>void;onUiSound:()=>void;onLeaderboard?:()=>void;submitted?:boolean}){
 const [input,setInput]=useState('');
 const [feedback,setFeedback]=useState('');
 const [showMissed,setShowMissed]=useState(false);
 const [celebratingShinyIds,setCelebratingShinyIds]=useState<Set<number>>(()=>new Set());
 const inputRef=useRef<HTMLInputElement>(null);
 const gridRef=useRef<HTMLDivElement>(null);
 const pendingGuess=useRef<ReturnType<typeof setTimeout>|null>(null);
 const count=Object.keys(run.revealed).length;
 const ended=run.status!=='playing';
 const next=run.difficulty==='very-hard'?run.pokemon.find(p=>!run.revealed[p.id])?.id:undefined;
 const handleInput=(value:string)=>{
  if(pendingGuess.current)clearTimeout(pendingGuess.current);
  setInput(value);setFeedback('');
  const key=normalize(value);
  // Allow typing Mewtwo or Porygon2 without consuming their shorter name first.
  const hasLongerName=key!=='nidoran'&&matchGuess(run,value).length>0&&run.pokemon.some(p=>!run.revealed[p.id]&&normalize(p.name)!==key&&normalize(p.name).startsWith(key));
  const accept=()=>{if(onGuess(value)){setInput('');setFeedback('');}};
  if(hasLongerName)pendingGuess.current=setTimeout(accept,350);else accept();
 };
 useEffect(()=>()=>{if(pendingGuess.current)clearTimeout(pendingGuess.current);},[]);
 useEffect(()=>{inputRef.current?.focus();},[]);
 const lastCount=useRef(count);
 const previousRevealed=useRef(new Set(Object.keys(run.revealed).map(Number)));
 const celebrationTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(celebrationTimer.current)clearTimeout(celebrationTimer.current);},[]);
 useEffect(()=>{
  if(count<=lastCount.current){lastCount.current=count;previousRevealed.current=new Set(Object.keys(run.revealed).map(Number));return;}
  const currentIds=Object.keys(run.revealed).map(Number);
  const newIds=currentIds.filter(id=>!previousRevealed.current.has(id));
  previousRevealed.current=new Set(currentIds);lastCount.current=count;
  const newShinyIds=newIds.filter(id=>run.revealed[id]?.shiny);
  if(newShinyIds.length){
   if(celebrationTimer.current)clearTimeout(celebrationTimer.current);
   setCelebratingShinyIds(new Set(newShinyIds));
   celebrationTimer.current=setTimeout(()=>{setCelebratingShinyIds(new Set());celebrationTimer.current=null;},1200);
  }
  const target=gridRef.current?.querySelector(`[data-pokemon="${newIds[0]}"]`);
  const guessBar=document.querySelector('.guess-bar');
  if(!target||!guessBar)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targetTop=target.getBoundingClientRect().top;
  const top=Math.max(0,window.scrollY+targetTop-guessBar.getBoundingClientRect().height-20);
  const maximumScroll=document.documentElement.scrollHeight-window.innerHeight;
  const extraClearance=Math.max(0,Math.ceil(top-maximumScroll));
  if(extraClearance){
   const currentPadding=parseFloat(gridRef.current?.style.paddingBottom||'0');
   gridRef.current!.style.paddingBottom=`${currentPadding+extraClearance}px`;
  }
  requestAnimationFrame(()=>window.scrollTo({top,behavior:reduced?'auto':'smooth'}));
 },[count,next,run.difficulty,run.revealed]);
 const leaderboardButton=onLeaderboard?<button className="primary-button red-action" onClick={onLeaderboard}>{submitted?'View Leaderboard':'Submit to Leaderboard'}</button>:null;
 const results=<section className="results" aria-live="polite"><h2>{count} / {run.pokemon.length}</h2><div className="results-actions"><div className="results-main-buttons">{leaderboardButton}<button className="primary-button results-back" onClick={()=>{onUiSound();setShowMissed(false);window.scrollTo(0,0);}}>Back to Oak's advice</button><button className="primary-button" onClick={onReplay}>Play again</button></div><div className="results-side"><Timer run={run} active={false}/><button className="text-button" onClick={onSettings}>Change settings</button></div></div></section>;
 const oakScreen=<section className="oak-rating" aria-live="polite"><div className="oak-scene-frame"><div className="oak-scene-crop"><img className="oak-scene" src="/ui/oak-rating.png" alt="Professor Oak and a Pokémon Trainer beside the Pokédex rating machine in his laboratory" width={208} height={90}/></div></div><div className="oak-dialogue"><strong>OAK:</strong><p>{oakRating(run)}</p></div><div className="oak-controls"><div className="oak-score">{count} / {run.pokemon.length}</div><div className="oak-buttons">{leaderboardButton}<button className="primary-button oak-review-button" onClick={()=>{onUiSound();setShowMissed(true);window.scrollTo(0,0);}}>See what I missed</button><button className="primary-button oak-replay-button" onClick={onReplay}>Play again</button></div><div className="oak-side"><Timer run={run} active={false}/><button className="text-button" onClick={onSettings}>Change settings</button></div></div></section>;
 return <section className="game"><div className={'game-heading '+(ended&&!showMissed?'oak-heading':'')}><h1>Gotta name 'em all!</h1><span className="difficulty-badge">{run.difficulty.replace('-',' ')}</span></div>{ended?(showMissed?results:oakScreen):<div className="guess-bar"><div className="guess-field"><span id="guess-prompt" className="guess-prompt">{run.startedAt===null?'Your first correct answer starts the time...':'Keep guessing!'}</span><input ref={inputRef} id="guess" aria-label="Name a Pokémon" value={input} onChange={e=>{if(!(e.nativeEvent as InputEvent).isComposing)handleInput(e.target.value);else setInput(e.target.value);}} onCompositionEnd={e=>handleInput(e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter'&&input.trim()){if(!onGuess(input))setFeedback(run.difficulty==='very-hard'?'Name the next Pokémon in Pokédex order.':'No new match. Check the name or try another Pokémon.');else{setInput('');setFeedback('');}}}} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Type a Pokémon name…" aria-describedby="guess-prompt guess-help"/></div><div className="guess-side"><Timer run={run} active/><button className="text-button give-up" onClick={onGiveUp}>Give up</button></div><p id="guess-help" className="guess-help" aria-live="polite">{feedback||`${count} / ${run.pokemon.length}`}</p></div>}{(!ended||showMissed)&&<TooltipProvider delayDuration={150}><div ref={gridRef} className="pokemon-grid">{run.pokemon.map(p=><PokemonCell key={p.id} pokemon={p} hidden={run.hidden[p.id]} reveal={run.revealed[p.id]} hints={run.difficulty==='easy'} silhouette={run.difficulty==='easy'||run.difficulty==='medium'} ended={ended} next={!ended&&next===p.id} celebrating={celebratingShinyIds.has(p.id)}/>)}</div></TooltipProvider>}</section>;
}
