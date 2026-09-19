"use client";
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { elapsed, formatTime, normalize, matchGuess, type Pokemon, type Reveal, type Run, type Sprite } from '@/lib/game';
import { oakRating } from '@/lib/oak-rating';
import {VoiceTranscriptTracker, type VoiceGuessOutcome} from '@/lib/voice';

type RecognitionAlternative={transcript:string;confidence:number};
type RecognitionResult={isFinal:boolean;length:number;[index:number]:RecognitionAlternative};
type RecognitionEvent={resultIndex:number;results:{length:number;[index:number]:RecognitionResult}};
type RecognitionErrorEvent={error:string};
type RecognitionInstance={lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;onstart:(()=>void)|null;onresult:((event:RecognitionEvent)=>void)|null;onerror:((event:RecognitionErrorEvent)=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type RecognitionConstructor=new()=>RecognitionInstance;
type VoiceStatus='off'|'requesting'|'listening'|'restarting'|'unavailable'|'error';

function voiceMessage(heard:string,outcome:VoiceGuessOutcome):string{
 const prefix=`Heard “${heard.trim()}” → `;
 if(outcome.kind==='accepted')return prefix+outcome.name;
 if(outcome.kind==='duplicate')return prefix+`Already guessed ${outcome.name}`;
 if(outcome.kind==='out-of-order')return prefix+`${outcome.name} is not next`;
 return prefix+'No match';
}

function VoiceControl({enabled,onEnabledChange,run,onVoiceGuess,onFeedback}:{enabled:boolean;onEnabledChange:(enabled:boolean)=>void;run:Run;onVoiceGuess:(value:string,heard:string)=>VoiceGuessOutcome;onFeedback:(message:string)=>void}){
 const [status,setStatus]=useState<VoiceStatus>('off');
 const desired=useRef(enabled);
 const restartTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{desired.current=enabled;},[enabled]);
 useEffect(()=>{
  if(!enabled||run.status!=='playing')return;
  const Recognition=(window as typeof window & {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor}).SpeechRecognition??(window as typeof window & {webkitSpeechRecognition?:RecognitionConstructor}).webkitSpeechRecognition;
  if(!Recognition){queueMicrotask(()=>setStatus('unavailable'));return;}
  const recognition=new Recognition();
  const transcriptTracker=new VoiceTranscriptTracker();
  let disposed=false;
  recognition.lang='en-GB';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=5;
  const start=()=>{
   if(disposed||!desired.current)return;
   setStatus(previous=>previous==='restarting'?'restarting':'requesting');
   try{recognition.start();}catch{setStatus('error');}
  };
  recognition.onstart=()=>setStatus('listening');
  recognition.onresult=event=>{
   for(let index=event.resultIndex;index<event.results.length;index++){
    const result=event.results[index];
    if(!result.length)continue;
    const alternatives=Array.from({length:result.length},(_,alternativeIndex)=>result[alternativeIndex].transcript);
    const primary=alternatives[0]?.trim()??'';
    const {matches,noMatch}=transcriptTracker.observe(index,primary,alternatives.slice(1),result.isFinal,run.pokemon);
    if(noMatch)onFeedback(voiceMessage(primary||'…',{kind:'no-match'}));
    for(const match of matches)onFeedback(voiceMessage(match.heard,onVoiceGuess(match.guess,match.matchedHeard??match.heard)));
   }
  };
  recognition.onerror=event=>{
   if(event.error==='aborted')return;
   if(event.error==='not-allowed'||event.error==='service-not-allowed'){desired.current=false;setStatus('error');return;}
   setStatus('restarting');
  };
  recognition.onend=()=>{
   if(disposed||!desired.current)return;
   setStatus('restarting');
   restartTimer.current=setTimeout(start,250);
  };
  start();
  return()=>{
   disposed=true;
   if(restartTimer.current){clearTimeout(restartTimer.current);restartTimer.current=null;}
   recognition.onend=null;recognition.onresult=null;recognition.onerror=null;recognition.onstart=null;
   try{recognition.abort();}catch{}
  };
 },[enabled,onFeedback,onVoiceGuess,run.pokemon,run.status]);
 const visibleStatus:VoiceStatus=enabled?status:'off';
 const label:Record<VoiceStatus,string>={off:'ENABLE VOICE',requesting:'REQUESTING MIC…',listening:'LISTENING…',restarting:'RESTARTING MIC…',unavailable:'VOICE UNAVAILABLE',error:'MICROPHONE ERROR'};
 return <button type="button" className={'voice-game-toggle status-'+visibleStatus} aria-pressed={enabled} onClick={()=>{if(enabled)setStatus('off');onEnabledChange(!enabled);}}><span className="voice-dot" aria-hidden="true"/><span className="voice-game-label">{label[visibleStatus]}</span></button>;
}

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

type ConfirmationKind='give-up'|'settings';

function ConfirmationDialog({kind,onCancel,onConfirm}:{kind:ConfirmationKind;onCancel:()=>void;onConfirm:()=>void}){
 const titleId=useId();
 const descriptionId=useId();
 const dialogRef=useRef<HTMLDivElement>(null);
 const noRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  noRef.current?.focus();
  const handleKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onCancel();return;}
   if(event.key!=='Tab')return;
   const controls=Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')??[]);
   if(!controls.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',handleKeyDown);
  return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',handleKeyDown);};
 },[onCancel]);
 const message=kind==='give-up'?'Are you sure you want to give up?':'If you do this before you submit to leaderboard, you will lose this game. Is that ok?';
 return <div className="confirmation-backdrop"><div ref={dialogRef} className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}><h2 id={titleId}>ARE YOU SURE?</h2><p id={descriptionId}>{message}</p><div className="confirmation-actions"><button type="button" className="confirmation-choice" onClick={onConfirm}>YES</button><button ref={noRef} type="button" className="confirmation-choice selected" onClick={onCancel}>NO</button></div></div></div>;
}
export function GameBoard({run,initialVoiceEnabled,onGuess,onVoiceGuess,onGiveUp,onReplay,onSettings,onUiSound,onLeaderboard,submitted}:{run:Run;initialVoiceEnabled:boolean;onGuess:(value:string)=>boolean;onVoiceGuess:(value:string,heard:string)=>VoiceGuessOutcome;onGiveUp:()=>void;onReplay:()=>void;onSettings:()=>void;onUiSound:()=>void;onLeaderboard?:()=>void;submitted?:boolean}){
 const [input,setInput]=useState('');
 const [feedback,setFeedback]=useState('');
 const [voiceEnabled,setVoiceEnabled]=useState(initialVoiceEnabled);
 const [voiceFeedback,setVoiceFeedback]=useState<string|null>(null);
 const [showMissed,setShowMissed]=useState(false);
 const [confirmation,setConfirmation]=useState<ConfirmationKind|null>(null);
 const [celebratingShinyIds,setCelebratingShinyIds]=useState<Set<number>>(()=>new Set());
 const inputRef=useRef<HTMLInputElement>(null);
 const gridRef=useRef<HTMLDivElement>(null);
 const pendingGuess=useRef<ReturnType<typeof setTimeout>|null>(null);
 const voiceFeedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const confirmationTrigger=useRef<HTMLButtonElement|null>(null);
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
 useEffect(()=>()=>{if(voiceFeedbackTimer.current)clearTimeout(voiceFeedbackTimer.current);},[]);
 const showVoiceFeedback=useCallback((message:string)=>{
  if(voiceFeedbackTimer.current)clearTimeout(voiceFeedbackTimer.current);
  setVoiceFeedback(message);
  voiceFeedbackTimer.current=setTimeout(()=>{
   setVoiceFeedback(null);
   voiceFeedbackTimer.current=null;
  },2500);
 },[]);
 useEffect(()=>{inputRef.current?.focus();},[]);
 const openConfirmation=(kind:ConfirmationKind,event:React.MouseEvent<HTMLButtonElement>)=>{confirmationTrigger.current=event.currentTarget;onUiSound();setConfirmation(kind);};
 const cancelConfirmation=()=>{onUiSound();setConfirmation(null);requestAnimationFrame(()=>confirmationTrigger.current?.focus());};
 const confirmAction=()=>{const action=confirmation;setConfirmation(null);if(action==='give-up')onGiveUp();else if(action==='settings')onSettings();};
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
 const results=<section className="results" aria-live="polite"><h2>{count} / {run.pokemon.length}</h2><div className="results-actions"><div className="results-main-buttons">{leaderboardButton}<button className="primary-button results-back" onClick={()=>{onUiSound();setShowMissed(false);window.scrollTo(0,0);}}>Back to Oak's advice</button><button className="primary-button" onClick={onReplay}>Play again</button></div><div className="results-side"><Timer run={run} active={false}/><button className="text-button" onClick={event=>openConfirmation('settings',event)}>Change settings</button></div></div></section>;
 const oakScreen=<section className="oak-rating setup-panel oak-frame" aria-live="polite"><div className="oak-scene-frame"><div className="oak-scene-crop"><img className="oak-scene" src="/ui/oak-rating.png" alt="Professor Oak and a Pokémon Trainer beside the Pokédex rating machine in his laboratory" width={208} height={90}/></div></div><div className="oak-dialogue"><strong>OAK:</strong><p>{oakRating(run)}</p></div><div className="oak-controls"><div className="oak-score">{count} / {run.pokemon.length}</div><div className="oak-buttons">{leaderboardButton}<button className="primary-button oak-review-button" onClick={()=>{onUiSound();setShowMissed(true);window.scrollTo(0,0);}}>See what I missed</button><button className="primary-button oak-replay-button" onClick={onReplay}>Play again</button></div><div className="oak-side"><Timer run={run} active={false}/><button className="text-button" onClick={event=>openConfirmation('settings',event)}>Change settings</button></div></div></section>;
 return <section className="game"><div className={'game-heading site-title-row '+(ended&&!showMissed?'oak-heading':'')}><h1>Gotta name 'em all!</h1></div>{ended?(showMissed?results:oakScreen):<><div className="guess-bar"><div className="guess-field"><span id="guess-prompt" className="guess-prompt">{run.startedAt===null?'Your first correct answer starts the time...':'Keep guessing!'}</span><input ref={inputRef} id="guess" aria-label="Name a Pokémon" value={input} onChange={e=>{if(!(e.nativeEvent as InputEvent).isComposing)handleInput(e.target.value);else setInput(e.target.value);}} onCompositionEnd={e=>handleInput(e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter'&&input.trim()){if(!onGuess(input))setFeedback(run.difficulty==='very-hard'?'Name the next Pokémon in Pokédex order.':'No new match. Check the name or try another Pokémon.');else{setInput('');setFeedback('');}}}} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Type a Pokémon name…" aria-describedby="guess-prompt guess-help"/></div><div className="guess-side"><Timer run={run} active/><button className="text-button give-up" onClick={event=>openConfirmation('give-up',event)}>Give up</button></div><div className="guess-status-row"><p id="guess-help" className="guess-help" aria-live="polite">{feedback||`${count} / ${run.pokemon.length}`}</p><VoiceControl enabled={voiceEnabled} onEnabledChange={setVoiceEnabled} run={run} onVoiceGuess={onVoiceGuess} onFeedback={showVoiceFeedback}/></div></div><div className={'voice-feedback'+(voiceFeedback?' visible':'')} role="status" aria-live="polite" aria-atomic="true">{voiceFeedback}</div></>}{(!ended||showMissed)&&<TooltipProvider delayDuration={150}><div ref={gridRef} className="pokemon-grid">{run.pokemon.map(p=><PokemonCell key={p.id} pokemon={p} hidden={run.hidden[p.id]} reveal={run.revealed[p.id]} hints={run.difficulty==='easy'} silhouette={run.difficulty==='easy'||run.difficulty==='medium'} ended={ended} next={!ended&&next===p.id} celebrating={celebratingShinyIds.has(p.id)}/>)}</div></TooltipProvider>}{confirmation&&<ConfirmationDialog kind={confirmation} onCancel={cancelConfirmation} onConfirm={confirmAction}/>}</section>;
}
