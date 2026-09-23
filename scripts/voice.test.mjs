import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,submitGuess} from '../lib/game.ts';
import {VoiceTranscriptTracker,classifyVoiceGuess,resolveVoiceTranscript,voiceAliases,voiceSimilarity} from '../lib/voice.ts';

const catalogue=JSON.parse(readFileSync(new URL('../public/pokemon/catalogue.json',import.meta.url),'utf8'));
const kanto=catalogue.filter(pokemon=>pokemon.generation===1);

test('voice matching supports exact, curated and alternative transcripts',()=>{
 assert.equal(resolveVoiceTranscript('Charmander',[],kanto)[0].pokemon.name,'Charmander');
 const corrected=resolveVoiceTranscript('char million',[],kanto)[0];
 assert.equal(corrected.pokemon.name,'Charmeleon');
 assert.equal(corrected.source,'alias');
 const alternative=resolveVoiceTranscript('unrelated words',['Charizard'],kanto)[0];
 assert.equal(alternative.pokemon.name,'Charizard');
 assert.equal(alternative.heard,'unrelated words');
 assert.equal(alternative.source,'alternative');
});

test('tested Generation 1 speech aliases resolve to canonical Pokémon names',()=>{
 const aliases={
  'vena sir':'Venusaur','Wattle':'Wartortle','spearow':'Spearow','pajero':'Pidgeotto',vera:'Fearow',thearoe:'Fearow',theara:'Fearow',fiera:'Fearow',sunshu:'Sandshrew',
  'need around':'Nidoran♀','need or run':'Nidoran♀','need arena':'Nidorino',ciderk:'Psyduck',mancare:'Mankey',polyworld:'Poliwhirl',mature:'Machoke','victory bell':'Victreebel',
  grabbelo:'Graveler',dugong:'Dewgong','do you gong':'Dewgong',seal:'Seel','gas le':'Gastly',onyx:'Onix',grbbe:'Krabby',cuban:'Cubone',chancer:'Chansey',harsey:'Horsea',
  RC:'Horsea',jinx:'Jynx',pincer:'Pinsir',tarous:'Tauros',viparian:'Vaporeon','be party on':'Vaporeon','their party on':'Vaporeon',omani:'Omanyte','omen I':'Omanyte','am a night':'Omanyte','om a night':'Omanyte',new:'Mew',
 };
 for(const [alias,name] of Object.entries(aliases))assert.equal(resolveVoiceTranscript(alias,[],kanto)[0]?.pokemon.name,name,alias);
 assert.equal(resolveVoiceTranscript('need or run',[],kanto)[0].guess,'nidoran');
});

test('all curated, play-tested, and report aliases resolve to active canonical Pokémon',()=>{
 for(const [heard,target] of Object.entries(voiceAliases)){
  const expected=target==='Nidoran'?'Nidoran♀':target;
  assert.ok(catalogue.some(pokemon=>pokemon.name===expected),`${heard} targets an unknown Pokémon: ${target}`);
  assert.equal(resolveVoiceTranscript(heard,[],catalogue)[0]?.pokemon.name,expected,heard);
 }
 assert.equal(resolveVoiceTranscript('need arena',[],catalogue)[0]?.pokemon.name,'Nidorino');
 assert.equal(resolveVoiceTranscript('mystery of us',[],catalogue)[0]?.pokemon.name,'Misdreavus');
 assert.equal(resolveVoiceTranscript('giraci',[],catalogue)[0]?.pokemon.name,'Jirachi');
});

test('latest spoken aliases resolve to the intended Pokémon',()=>{
 const aliases={
  'worm pool':'Wurmple',ladybird:'Ledyba',Caeser:'Scizor',Cesar:'Scizor',rolls:'Ralts',Rolls:'Ralts',
  cardiovoir:'Gardevoir','garden war':'Gardevoir',Menon:'Minun',menon:'Minun',toros:'Tauros',
  flatter:'Flaaffy','poly turd':'Politoed',slurkin:'Slowking',tricker:'Treecko',
  'grow vail':'Grovyle','grow vile':'Grovyle',silicone:'Silcoon',dust:'Dustox',
  sabali:'Sableye','my wild':'Mawile',Wilma:'Wailmer',wilma:'Wailmer',
  nomal:'Numel',normal:'Numel',tarcole:'Torkoal',tacol:'Torkoal',
  drowsee:'Drowzee',cedra:'Seadra',ceadra:'Seadra','ride on':'Rhydon',Ceaser:'Scizor',
 };
 for(const [heard,name] of Object.entries(aliases))assert.equal(resolveVoiceTranscript(heard,[],catalogue)[0]?.pokemon.name,name,heard);
});

test('voice matching processes multiple names in spoken order',()=>{
 assert.deepEqual(resolveVoiceTranscript('Charmander Charmeleon Charizard',[],kanto).map(match=>match.pokemon.name),['Charmander','Charmeleon','Charizard']);
});

test('stable interim names reveal as speech continues without final-event duplicates',()=>{
 const tracker=new VoiceTranscriptTracker();
 const heard=(value,final=false)=>tracker.observe(0,value,[],final,kanto).matches.map(match=>match.pokemon.name);
 assert.deepEqual(heard('Charmander'),[]);
 assert.deepEqual(heard('Charmander Charmeleon'),['Charmander']);
 assert.deepEqual(heard('Charmander Charmeleon Charizard'),['Charmeleon']);
 assert.deepEqual(heard('Charmander Charmeleon Charizard'),['Charizard']);
 assert.deepEqual(heard('Charmander Charmeleon Charizard',true),[]);
 assert.deepEqual(heard('Charmander Charmeleon Charizard',true),[]);
});

test('stable fuzzy and alternative interim matches reveal before the final result',()=>{
 const tracker=new VoiceTranscriptTracker();
 assert.deepEqual(tracker.observe(0,'bulbasar',[],false,kanto).matches,[]);
 assert.equal(tracker.observe(0,'bulbasar',[],false,kanto).matches[0].pokemon.name,'Bulbasaur');
 assert.deepEqual(tracker.observe(0,'Bulbasaur',[],true,kanto).matches,[]);
 const alternativeTracker=new VoiceTranscriptTracker();
 assert.deepEqual(alternativeTracker.observe(0,'unrelated words',['Charizard'],false,kanto).matches,[]);
 assert.equal(alternativeTracker.observe(0,'unrelated words',['Charizard'],false,kanto).matches[0].pokemon.name,'Charizard');
 assert.deepEqual(alternativeTracker.observe(0,'unrelated words',['Charizard'],true,kanto).matches,[]);
});

test('ambiguous interim speech stays unmatched and final no-match feedback is retained',()=>{
 const tracker=new VoiceTranscriptTracker();
 assert.deepEqual(tracker.observe(0,'muu',[],false,kanto).matches,[]);
 assert.deepEqual(tracker.observe(0,'muu',[],false,kanto).matches,[]);
 assert.deepEqual(tracker.observe(0,'muu',[],true,kanto),{matches:[],noMatch:true});
});

test('fuzzy matching is permissive only for a clear winner',()=>{
 assert.ok(voiceSimilarity('bulbasar','Bulbasaur')>=.72);
 assert.equal(resolveVoiceTranscript('bulbasar',[],kanto)[0].pokemon.name,'Bulbasaur');
 assert.deepEqual(resolveVoiceTranscript('muu',[],kanto),[]);
 assert.deepEqual(resolveVoiceTranscript('ordinary conversation',[],kanto),[]);
});

test('long aliases accept clear 85% near misses but ordinary and short aliases stay exact-only',()=>{
 const corrected=resolveVoiceTranscript('fanfair',[],catalogue)[0];
 assert.equal(corrected?.pokemon.name,'Phanpy');
 assert.equal(corrected?.source,'fuzzy');
 assert.ok(corrected.score>=.85);
 assert.equal(resolveVoiceTranscript('dunfann',[],catalogue)[0]?.pokemon.name,'Donphan');
 assert.deepEqual(resolveVoiceTranscript('unknwon',[],catalogue),[]);
 assert.deepEqual(resolveVoiceTranscript('pluss',[],catalogue),[]);
 assert.equal(resolveVoiceTranscript('unknown',[],catalogue)[0]?.pokemon.name,'Unown');
});

test('voice outcomes distinguish accepted, duplicate and Pokédex ordering',()=>{
 let run=createRun(catalogue,[1],'hard',()=>.5);
 assert.equal(classifyVoiceGuess(run,5).kind,'accepted');
 run=submitGuess(run,'Charmeleon',1,()=>.5);
 const duplicate=classifyVoiceGuess(run,5);
 assert.equal(duplicate.kind,'duplicate');
 assert.equal(duplicate.pokemon.name,'Charmeleon');
 const ordered=createRun(catalogue,[1],'very-hard',()=>.5);
 assert.equal(classifyVoiceGuess(ordered,1).kind,'accepted');
 assert.equal(classifyVoiceGuess(ordered,4).kind,'out-of-order');
 assert.equal(classifyVoiceGuess(ordered,999).kind,'no-match');
});

test('gender-neutral Nidoran speech keeps the typed-game behavior',()=>{
 let run=createRun(catalogue,[1],'hard',()=>.5);
 assert.equal(classifyVoiceGuess(run,'nidoran').name,'Nidoran');
 run=submitGuess(run,'nidoran',1,()=>.5);
 assert.deepEqual(Object.keys(run.revealed),['29','32']);
 assert.equal(classifyVoiceGuess(run,'nidoran').kind,'duplicate');
});

test('need arena targets the unrevealed Nidorina or Nidorino without changing typed guesses',()=>{
 const fresh=createRun(catalogue,[1],'hard',()=>.5);
 assert.equal(classifyVoiceGuess(fresh,'Nidorino','need arena').name,'Nidorino');
 const nidorinoRevealed=submitGuess(fresh,'Nidorino',1,()=>.5);
 const fallback=classifyVoiceGuess(nidorinoRevealed,'Nidorino','NEED ARENA');
 assert.equal(fallback.kind,'accepted');
 assert.equal(fallback.name,'Nidorina');
 const bothRevealed=submitGuess(nidorinoRevealed,fallback.name,2,()=>.5);
 assert.ok(bothRevealed.revealed[30]);
 assert.equal(classifyVoiceGuess(bothRevealed,'Nidorino','Need Arena').kind,'duplicate');

 const nidorinaRevealed=submitGuess(fresh,'Nidorina',1,()=>.5);
 assert.equal(classifyVoiceGuess(nidorinaRevealed,'Nidorino','need arena').name,'Nidorino');
 assert.equal(classifyVoiceGuess(nidorinoRevealed,'Nidorino').kind,'duplicate');
 const alternative=resolveVoiceTranscript('unrelated words',['Need Arena'],kanto)[0];
 assert.equal(alternative.matchedHeard,'Need Arena');
 assert.equal(classifyVoiceGuess(nidorinoRevealed,alternative.guess,alternative.matchedHeard).name,'Nidorina');
});
