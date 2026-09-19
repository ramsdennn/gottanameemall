import {normalize, type Pokemon, type Run} from './game.ts';

export type VoiceMatchSource='exact'|'alias'|'alternative'|'fuzzy';
export type VoiceMatch={heard:string;matchedHeard?:string;guess:string;pokemon:Pokemon;source:VoiceMatchSource;score:number};
export type VoiceGuessOutcome=
 | {kind:'accepted';pokemon:Pokemon;name:string}
 | {kind:'duplicate';pokemon:Pokemon;name:string}
 | {kind:'out-of-order';pokemon:Pokemon;name:string}
 | {kind:'no-match'};

const curatedAliases:Record<string,string>={
 charmillion:'Charmeleon',
 venasir:'Venusaur',
 wattle:'Wartortle',
 spearow:'Spearow',
 pajero:'Pidgeotto',
 vera:'Fearow',
 thearoe:'Fearow',
 theara:'Fearow',
 fiera:'Fearow',
 sunshu:'Sandshrew',
 needaround:'Nidoran',
 needorrun:'Nidoran',
 needarena:'Nidorino',
 ciderk:'Psyduck',
 mancare:'Mankey',
 polyworld:'Poliwhirl',
 mature:'Machoke',
 victorybell:'Victreebel',
 grabbelo:'Graveler',
 dugong:'Dewgong',
 doyougong:'Dewgong',
 seal:'Seel',
 gasle:'Gastly',
 onyx:'Onix',
 grbbe:'Krabby',
 cuban:'Cubone',
 chancer:'Chansey',
 harsey:'Horsea',
 rc:'Horsea',
 jinx:'Jynx',
 pincer:'Pinsir',
 tarous:'Tauros',
 viparian:'Vaporeon',
 bepartyon:'Vaporeon',
 theirpartyon:'Vaporeon',
 omani:'Omanyte',
 omeni:'Omanyte',
 amanight:'Omanyte',
 omanight:'Omanyte',
 new:'Mew',
};

// Spoken forms confirmed in the user's September 19 play-test notes.
const testedAliases=Object.fromEntries(([
 ['done fan','Donphan'],['dunfan','Donphan'],['don fan','Donphan'],['donfan','Donphan'],['don fund','Donphan'],
 ['fanfare','Phanpy'],['funfair','Phanpy'],['fun fair','Phanpy'],['fan feed','Phanpy'],
 ['mystery of us','Misdreavus'],['mis div vis','Misdreavus'],['mysterious','Misdreavus'],
 ['bursary','Ursaring'],['bailey','Bayleef'],['cinder quill','Cyndaquil'],['ted dial','Totodile'],['who toot','Hoothoot'],
 ['firo','Fearow'],['shelda','Shellder'],['coughing','Koffing'],['coffin','Koffing'],['guilty on','Jolteon'],
 ['harmonise','Omanyte'],['harmonite','Omanyte'],['on the star','Omastar'],['almost star','Omastar'],
 ['barley','Bayleef'],['balief','Bayleef'],['bare lead','Bayleef'],['bar leaf','Bayleef'],['cinder quil','Cyndaquil'],
 ['tertidial','Totodile'],['toyota dial','Totodile'],['crocoano','Croconaw'],['croakana','Croconaw'],
 ['fluffy','Flaaffy'],['zatu','Xatu'],['sudarudo','Sudowoodo'],['earpom','Aipom'],['air pump','Aipom'],
 ['sunflower','Sunflora'],['some flora','Sunflora'],['theanma','Yanma'],['makro','Murkrow'],['mercuro','Murkrow'],
 ['pancre','Pineco'],['vidress','Forretress'],['bob effect','Wobbuffet'],['unknown','Unown'],
 ['teddy russa','Teddiursa'],['scissor','Scizor'],['caeser','Scizor'],['scammerer','Skarmory'],
 ['marie','Mareep'],['ogipi','Togepi'],['tour gippy','Togepi'],['scamori','Skarmory'],
 ['tree car','Treecko'],['mastomb','Marshtomp'],['mastermp','Marshtomp'],['Marston','Marshtomp'],['mashedom','Marshtomp'],
 ['does stocks','Dustox'],['does stops','Dustox'],['lore tad','Lotad'],['my tienna','Mightyena'],['my tiana','Mightyena'],
 ['circuit','Surskit'],['tala','Taillow'],['taylor','Taillow'],['sweller','Swellow'],['wing','Wingull'],
 ['culier','Kirlia'],['guariola','Gardevoir'],['brayloun','Breloom'],['slack off','Slakoth'],
 ['whisper','Whismur'],['whisma','Whismur'],['wisma','Whismur'],['as a real','Azurill'],
 ['agron','Aggron'],['skitter','Skitty'],['stabalise','Sableye'],['stabalize','Sableye'],['server I','Sableye'],
 ['marwill','Mawile'],['mobile','Mawile'],['my while','Mawile'],['minion','Minun'],['mining','Minun'],
 ['plus all','Plusle'],['plus','Plusle'],['gold pin','Gulpin'],['gulping','Gulpin'],
 ['wheelard','Wailord'],['where lard','Wailord'],['tacos','Torkoal'],['taco','Torkoal'],
 ['spike','Spoink'],['tripping','Trapinch'],['zangus','Zangoose'],['cervyper','Seviper'],['survivor','Seviper'],
 ['car fish','Corphish'],['coffish','Corphish'],['clear doll','Claydol'],['lily','Lileep'],['lilly','Lileep'],
 ['credila','Cradily'],['phoebus','Feebas'],['kekon','Kecleon'],['why not','Wynaut'],["we're not",'Wynaut'],
 ['snow runt','Snorunt'],['clearly','Glalie'],['glarly','Glalie'],['spiel','Spheal'],['celia','Sealeo'],
 ['garbis','Gorebyss'],['garibis','Gorebyss'],['reggae ice','Regice'],['giracy','Jirachi'],['giraci','Jirachi'],
 ['worm pool','Wurmple'],['ladybird','Ledyba'],['cesar','Scizor'],['rolls','Ralts'],
 ['cardiovoir','Gardevoir'],['garden war','Gardevoir'],['menon','Minun'],['toros','Tauros'],
 ['flatter','Flaaffy'],['poly turd','Politoed'],['slurkin','Slowking'],['tricker','Treecko'],
 ['grow vail','Grovyle'],['grow vile','Grovyle'],['silicone','Silcoon'],['dust','Dustox'],
 ['sabali','Sableye'],['my wild','Mawile'],['wilma','Wailmer'],['nomal','Numel'],
 ['normal','Numel'],['tarcole','Torkoal'],['tacol','Torkoal'],
] as Array<[string,string]>).map(([heard,name])=>[normalize(heard),name])) as Record<string,string>;

// Saved aliases and additional failed transcripts from the attached diagnostic report.
const reportedAliases=Object.fromEntries(([
 ['poliworld','Poliwhirl'],['polyrath','Poliwrath'],['retrievers','Misdreavus'],['quailfish','Qwilfish'],
 ['sweet corn','Suicune'],['illuminum','Illumise'],['what auto','Wartortle'],['picture','Pidgey'],
 ['need a run','Nidoran'],['need iran','Nidoran'],['pics','Vulpix'],['venon','Venonat'],['cadabra','Kadabra'],
 ['matured','Machoke'],['tentacle','Tentacool'],['gravela','Graveler'],['bonita','Ponyta'],
 ['slough park','Slowpoke'],['saabra','Slowbro'],['dodriel','Dodrio'],['tangler','Tangela'],
 ['parser','Horsea'],['either','Eevee'],['on the night','Omanyte'],['dial','Totodile'],
 ['crocodile','Croconaw'],['p2','Pichu'],['target p','Togepi'],['target','Togetic'],
 ['flapper','Flaaffy'],['marrow','Marill'],['sudauder','Sudowoodo'],['hop','Hoppip'],
 ['wil','Wooper'],['snubble','Snubbull'],['granville','Granbull'],['castle','Corsola'],
 ['macbeth','Magby'],['melissa','Blissey'],['lil gear','Lugia'],['tartik','Torchic'],
 ['ma stomp','Marshtomp'],['mastomp','Marshtomp'],['cd','Seedot'],['wingle','Wingull'],['bigger off','Vigoroth'],
 ['save a life','Sableye'],['marwell','Mawile'],['electronic','Electrike'],
 ['magnet magnet tricks','Manectric'],['gold pen','Gulpin'],['swallowed','Swalot'],
 ['kaknia','Cacnea'],['luna turn','Lunatone'],['graduant','Crawdaunt'],['anaris','Anorith'],
 ['shepherd','Shuppet'],['burnett','Banette'],['the scots','Dusclops'],['trimaca','Chimecho'],
 ['gle','Glalie'],['bc','Blissey'],['dementia','Chimecho'],['trimeca','Chimecho'],
 ['daudia','Dodrio'],['do','Dodrio'],['ev','Eevee'],['grumble','Granbull'],
 ['pop it','Hoppip'],['party','Horsea'],['blue gear','Lugia'],['maturk','Machoke'],
 ['magbear','Magby'],['naderina','Nidorino'],['night','Omanyte'],['furniture','Ponyta'],
 ['noble','Snubbull'],['pseudo','Sudowoodo'],['so the weather','Sudowoodo'],
 ['more total','Wartortle'],['wall tile','Wartortle'],['garda','Gardevoir'],
 ['carter','Nincada'],['save-a-line','Sableye'],
] as Array<[string,string]>).map(([heard,name])=>[normalize(heard),name])) as Record<string,string>;

export const voiceAliases:Record<string,string>={...reportedAliases,...curatedAliases,...testedAliases};

// These ordinary words are useful as exact speech corrections, but a near miss
// in unrelated conversation should not become a Pokémon guess.
const exactOnlyAliases=new Set([
 'barley','coffin','coughing','either','electronic','fluffy','furniture',
 'flatter','mobile','normal','picture','scissor','silicone','sunflower','target','taylor','unknown',
]);

function damerauLevenshtein(left:string,right:string):number{
 const rows=left.length+1,columns=right.length+1;
 const distance=Array.from({length:rows},()=>Array<number>(columns).fill(0));
 for(let row=0;row<rows;row++)distance[row][0]=row;
 for(let column=0;column<columns;column++)distance[0][column]=column;
 for(let row=1;row<rows;row++)for(let column=1;column<columns;column++){
  const substitution=left[row-1]===right[column-1]?0:1;
  distance[row][column]=Math.min(distance[row-1][column]+1,distance[row][column-1]+1,distance[row-1][column-1]+substitution);
  if(row>1&&column>1&&left[row-1]===right[column-2]&&left[row-2]===right[column-1])distance[row][column]=Math.min(distance[row][column],distance[row-2][column-2]+substitution);
 }
 return distance[left.length][right.length];
}

export function voiceSimilarity(left:string,right:string):number{
 const a=normalize(left),b=normalize(right);
 if(!a&&!b)return 1;
 if(!a||!b)return 0;
 return 1-damerauLevenshtein(a,b)/Math.max(a.length,b.length);
}

type Candidate={guess:string;pokemon:Pokemon;source:Exclude<VoiceMatchSource,'alternative'>;score:number};

function resolveCandidate(value:string,pokemon:Pokemon[]):Candidate|null{
 const key=normalize(value);
 if(!key)return null;
 if(key==='nidoran'){
  const nidoran=pokemon.find(entry=>entry.id===29)??pokemon.find(entry=>entry.id===32);
  if(nidoran)return {guess:'nidoran',pokemon:nidoran,source:'exact',score:1};
 }
 const exact=pokemon.find(entry=>normalize(entry.name)===key);
 if(exact)return {guess:exact.name,pokemon:exact,source:'exact',score:1};
 const aliasName=voiceAliases[key];
 if(aliasName==='Nidoran'){
  const nidoran=pokemon.find(entry=>entry.id===29)??pokemon.find(entry=>entry.id===32);
  if(nidoran)return {guess:'nidoran',pokemon:nidoran,source:'alias',score:1};
 }
 const alias=aliasName&&pokemon.find(entry=>normalize(entry.name)===normalize(aliasName));
 if(alias)return {guess:alias.name,pokemon:alias,source:'alias',score:1};
 if(key.length<=4)return null;
 const ranked=pokemon.map(entry=>({pokemon:entry,score:voiceSimilarity(key,entry.name)})).sort((a,b)=>b.score-a.score);
 const winner=ranked[0],runnerUp=ranked[1];
 if(winner&&winner.score>=.72&&(!runnerUp||winner.score-runnerUp.score>=.12))return {...winner,guess:winner.pokemon.name,source:'fuzzy'};

 const activeNames=new Map(pokemon.map(entry=>[normalize(entry.name),entry]));
 const aliasScores=new Map<string,{guess:string;pokemon:Pokemon;score:number}>();
 for(const [heard,name] of Object.entries(voiceAliases)){
  if(heard.length<6||exactOnlyAliases.has(heard))continue;
  const target=name==='Nidoran'?(pokemon.find(entry=>entry.id===29)??pokemon.find(entry=>entry.id===32)):activeNames.get(normalize(name));
  if(!target)continue;
  const score=voiceSimilarity(key,heard);
  const previous=aliasScores.get(name);
  if(!previous||score>previous.score)aliasScores.set(name,{guess:name==='Nidoran'?'nidoran':target.name,pokemon:target,score});
 }
 const aliasRanked=[...aliasScores.values()].sort((a,b)=>b.score-a.score);
 const aliasWinner=aliasRanked[0],aliasRunnerUp=aliasRanked[1];
 const competingNameScore=ranked.find(entry=>entry.pokemon.id!==aliasWinner?.pokemon.id)?.score??0;
 if(!aliasWinner||aliasWinner.score<.85||aliasWinner.score-Math.max(aliasRunnerUp?.score??0,competingNameScore)<.12)return null;
 return {...aliasWinner,source:'fuzzy'};
}

function resolveTranscript(transcript:string,pokemon:Pokemon[]):VoiceMatch[]{
 const words=transcript.trim().split(/\s+/).filter(Boolean);
 const matches:VoiceMatch[]=[];
 for(let index=0;index<words.length;){
  let selected:{length:number;heard:string;candidate:Candidate}|null=null;
  const maximum=Math.min(4,words.length-index);
  // Prefer the longest exact/curated phrase before considering fuzzy matches.
  for(let length=maximum;length>=1;length--){
   const heard=words.slice(index,index+length).join(' ');
   const candidate=resolveCandidate(heard,pokemon);
   if(!candidate)continue;
   if(candidate.source==='exact'||candidate.source==='alias'){selected={length,heard,candidate};break;}
   if(!selected||candidate.score>selected.candidate.score)selected={length,heard,candidate};
  }
  if(!selected){index++;continue;}
  matches.push({heard:selected.heard,...selected.candidate});
  index+=selected.length;
 }
 return matches;
}

export function resolveVoiceTranscript(primary:string,alternatives:string[],pokemon:Pokemon[]):VoiceMatch[]{
 const primaryMatches=resolveTranscript(primary,pokemon);
 if(primaryMatches.length)return primaryMatches;
 for(const alternative of alternatives){
  const matches=resolveTranscript(alternative,pokemon);
  if(matches.length)return matches.map(match=>({...match,matchedHeard:match.heard,heard:primary.trim()||match.heard,source:'alternative'}));
 }
 return [];
}

// Browser interim transcripts are provisional. Apply the same resolver as final
// speech, but reveal a candidate only after it survives a second update.
export class VoiceTranscriptTracker{
 private results=new Map<number,{previous:VoiceMatch[];committed:VoiceMatch[]}>();

 observe(index:number,primary:string,alternatives:string[],isFinal:boolean,pokemon:Pokemon[]):{matches:VoiceMatch[];noMatch:boolean}{
  const state=this.results.get(index)??{previous:[],committed:[]};
  const resolved=resolveVoiceTranscript(primary,alternatives,pokemon);
  const matches:VoiceMatch[]=[];
  const committedPrefix=state.committed.every((match,position)=>resolved[position]?.guess===match.guess);
  for(let position=committedPrefix?state.committed.length:0;position<resolved.length;position++){
   const match=resolved[position];
   const previous=state.previous[position];
   if(!isFinal&&(!previous||previous.guess!==match.guess))break;
   matches.push(match);
  }
  state.committed=committedPrefix?[...state.committed,...matches]:matches;
  state.previous=resolved;
  this.results.set(index,state);
  return {matches,noMatch:isFinal&&!resolved.length&&!state.committed.length};
 }
}

export function classifyVoiceGuess(run:Run,value:number|string,heard=''):VoiceGuessOutcome{
 if(typeof value==='string'&&normalize(heard)==='needarena'&&normalize(value)==='nidorino'){
  const nidorina=run.pokemon.find(entry=>entry.id===30);
  const nidorino=run.pokemon.find(entry=>entry.id===33);
  if(nidorina&&nidorino&&run.revealed[nidorino.id]&&!run.revealed[nidorina.id])value=nidorina.name;
 }
 const neutralNidoran=typeof value==='string'&&normalize(value)==='nidoran';
 const candidates=neutralNidoran?run.pokemon.filter(entry=>entry.id===29||entry.id===32):run.pokemon.filter(entry=>typeof value==='number'?entry.id===value:normalize(entry.name)===normalize(value));
 const pokemon=candidates[0];
 if(!pokemon)return {kind:'no-match'};
 const name=neutralNidoran?'Nidoran':pokemon.name;
 if(candidates.every(entry=>run.revealed[entry.id]))return {kind:'duplicate',pokemon,name};
 if(run.difficulty==='very-hard'){
  const next=run.pokemon.find(entry=>!run.revealed[entry.id]);
  if(!candidates.some(entry=>entry.id===next?.id))return {kind:'out-of-order',pokemon,name};
 }
 return {kind:'accepted',pokemon,name};
}
