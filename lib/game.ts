export type Difficulty = 'easy' | 'medium' | 'hard' | 'very-hard';
export type Sprite = {form:string;still:string;last:string;sheet:string;columns:number;durations:number[]};
export type Pokemon = {id:number;name:string;generation:number;types:string[];description:string;descriptionVersion:string;normal:Sprite[];shiny:Sprite[]};
export type Reveal = {sprite:Sprite;shiny:boolean};
export type Run = {generationIds:number[];difficulty:Difficulty;pokemon:Pokemon[];hidden:Record<number,Sprite>;revealed:Record<number,Reveal>;startedAt:number|null;endedAt:number|null;status:'playing'|'complete'|'gave-up'};
export const normalize = (name:string) => name.toLowerCase().replace(/♀/g,'female').replace(/♂/g,'male').normalize('NFD').replace(/[^a-z0-9]/g,'');
export function randomItem<T>(pool:T[], random= Math.random):T {return pool[Math.floor(random()*pool.length)];}
export function createRun(catalogue:Pokemon[], generationIds:number[], difficulty:Difficulty, random=Math.random):Run {
 const pokemon = catalogue.filter(p=>generationIds.includes(p.generation)).sort((a,b)=>a.id-b.id);
 if(!pokemon.length) throw new Error('Select at least one generation.');
 return {generationIds:[...generationIds].sort(),difficulty,pokemon,hidden:Object.fromEntries(pokemon.map(p=>[p.id,randomItem(p.normal,random)])),revealed:{},startedAt:null,endedAt:null,status:'playing'};
}
export function matchGuess(run:Run, value:string):number[] {
 const guess=normalize(value);
 if(!guess || run.status!=='playing') return [];
 const aliases:Record<string,number>={nidoranf:29,nidoranfemale:29,nidoranm:32,nidoranmale:32};
 const matches=run.pokemon.filter(p=>guess==='nidoran'?(p.id===29||p.id===32):aliases[guess]?p.id===aliases[guess]:normalize(p.name)===guess);
 const remaining=matches.filter(p=>!run.revealed[p.id]);
 if(run.difficulty==='very-hard') {
  const next=run.pokemon.find(p=>!run.revealed[p.id]);
  return remaining.filter(p=>p.id===next?.id).map(p=>p.id);
 }
 return remaining.map(p=>p.id);
}
export function submitGuess(run:Run,value:string,now:number,random=Math.random):Run {
 const ids=matchGuess(run,value);
 if(!ids.length)return run;
 const revealed={...run.revealed};
 for(const id of ids){const p=run.pokemon.find(p=>p.id===id)!;const shiny=random()<1/500;revealed[id]={shiny,sprite:randomItem(shiny?p.shiny:p.normal,random)};}
 const complete=Object.keys(revealed).length===run.pokemon.length;
 return {...run,revealed,startedAt:run.startedAt??now,endedAt:complete?now:null,status:complete?'complete':'playing'};
}
export function giveUp(run:Run,now:number):Run {return run.status==='playing'?{...run,status:'gave-up',endedAt:now}:run;}
export function elapsed(run:Run,now:number):number{return run.startedAt===null?0:Math.max(0,(run.endedAt??now)-run.startedAt);}
export function formatTime(ms:number):string {const s=Math.floor(ms/1000);return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}.${Math.floor(ms%1000/100)}`;}
