import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRun,submitGuess,matchGuess,giveUp,elapsed,normalize} from '../lib/game.ts';
import {oakRating} from '../lib/oak-rating.ts';
const data=JSON.parse(readFileSync(new URL('../public/pokemon/catalogue.json',import.meta.url),'utf8'));
const normal=()=>0.5;
const ratedRun=(generations,count,status='gave-up')=>{const run=createRun(data,generations,'easy',normal);return {...run,status,endedAt:100,revealed:Object.fromEntries(run.pokemon.slice(0,count).map(p=>[p.id,{sprite:p.normal[0],shiny:false}]))};};
test('Professor Oak ratings follow selection, score boundaries and completion',()=>{
 assert.match(oakRating(ratedRun([1],9)),/lots to do/);
 assert.match(oakRating(ratedRun([1],10)),/right track/);
 assert.match(oakRating(ratedRun([1,2],79)),/evolve/);
 assert.match(oakRating(ratedRun([1,2],80)),/fishing Rod/);
 assert.match(oakRating(ratedRun([1,2,3],152)),/National Pokédex/);
 assert.match(oakRating(ratedRun([1,2,3],386,'complete')),/Thank you! Sincerely, thank you!/);
 assert.match(oakRating(ratedRun([2,3],235,'complete')),/comfy and easy to wear/);
 for(const generations of [[1],[1,2],[1,2,3],[2,3]])for(const count of [0,10,386])assert.doesNotMatch(oakRating(ratedRun(generations,count,count===386?'complete':'gave-up')),/Trainer/i);
});
test('all seven generation combinations have unique, ordered IDs and correct totals',()=>{
 for(let mask=1;mask<8;mask++){const gens=[1,2,3].filter(g=>mask&(1<<(g-1)));const run=createRun(data,gens,'easy',normal);assert.equal(run.pokemon.length,gens.reduce((n,g)=>n+[151,100,135][g-1],0));assert.equal(new Set(run.pokemon.map(p=>p.id)).size,run.pokemon.length);assert.deepEqual(run.pokemon.map(p=>p.id),run.pokemon.map(p=>p.id).sort((a,b)=>a-b));}
 assert.throws(()=>createRun(data,[],'easy'));
});
test('automatic normalisation and Nidoran variants',()=>{
 const r=createRun(data,[1],'easy',normal);
 assert.deepEqual(matchGuess(r,' MR. MIME '),[122]);assert.deepEqual(matchGuess(r,"farfetch’d"),[83]);assert.deepEqual(matchGuess(r,'NIDORAN'),[29,32]);assert.deepEqual(matchGuess(r,'nidoran♀'),[29]);assert.deepEqual(matchGuess(r,'nidoran-m'),[32]);assert.equal(normalize('Pokémon'),'pokemon');
 for(const difficulty of ['easy','medium','hard']){let run=createRun(data,[1],difficulty,normal);run=submitGuess(run,'nidoran',100,normal);assert.deepEqual(Object.keys(run.revealed),['29','32']);assert.deepEqual(matchGuess(run,'nidoran'),[]);}
});
test('timer starts only on first success; duplicate guesses consume no randomness',()=>{
 let r=createRun(data,[1],'hard',normal);assert.equal(elapsed(r,90000),0);assert.equal(submitGuess(r,'garbage',1000,normal),r);r=submitGuess(r,'bulbasaur',2000,normal);assert.equal(r.startedAt,2000);assert.equal(elapsed(r,6500),4500);assert.equal(submitGuess(r,'bulbasaur',9999,()=>{throw Error('Rerolled');}),r);r=giveUp(r,10000);assert.equal(elapsed(r,999999),8000);assert.equal(submitGuess(r,'ivysaur',20000,normal),r);assert.equal(elapsed(giveUp(createRun(data,[1],'hard',normal),100),999),0);
});
test('very hard preserves strict order, including two separate Nidoran entries',()=>{
 let r=createRun(data,[1],'very-hard',normal);assert.deepEqual(matchGuess(r,'ivysaur'),[]);
 for(const p of r.pokemon.filter(p=>p.id<29))r=submitGuess(r,p.name,p.id*1000,normal);
 assert.deepEqual(matchGuess(r,'nidoran'),[29]);r=submitGuess(r,'nidoran',29000,normal);assert.deepEqual(matchGuess(r,'nidoran'),[]);r=submitGuess(r,'nidorina',30000,normal);r=submitGuess(r,'nidoqueen',31000,normal);assert.deepEqual(matchGuess(r,'nidoran'),[32]);
});
test('every difficulty can finish all 386, timer stops and no guesses accepted afterwards',()=>{
 for(const difficulty of ['easy','medium','hard','very-hard']){let r=createRun(data,[1,2,3],difficulty,normal);for(const p of r.pokemon)r=submitGuess(r,p.name,p.id*1000,normal);assert.equal(r.status,'complete');assert.equal(Object.keys(r.revealed).length,386);assert.equal(elapsed(r,999999),385000);assert.equal(submitGuess(r,'bulbasaur',999999,normal),r);}
});
test('very hard skips excluded generations',()=>{
 let r=createRun(data,[1,3],'very-hard',normal);for(const p of r.pokemon.filter(p=>p.generation===1))r=submitGuess(r,p.name,p.id,normal);assert.deepEqual(matchGuess(r,'chikorita'),[]);assert.deepEqual(matchGuess(r,'treecko'),[252]);assert.deepEqual(matchGuess(createRun(data,[2],'very-hard',normal),'chikorita'),[152]);
});
test('shiny threshold is exactly 1/500 and forms are chosen from the rolled pool',()=>{
 const r=createRun(data,[2],'easy',normal);let sequence=[0.001999,0.999];let shiny=submitGuess(r,'unown',10,()=>sequence.shift());assert.equal(shiny.revealed[201].shiny,true);assert.equal(shiny.revealed[201].sprite,r.pokemon.find(p=>p.id===201).shiny.at(-1));sequence=[0.002,0];const ordinary=submitGuess(r,'unown',10,()=>sequence.shift());assert.equal(ordinary.revealed[201].shiny,false);assert.equal(ordinary.revealed[201].sprite,r.pokemon.find(p=>p.id===201).normal[0]);
 const kanto=createRun(data,[1],'easy',normal);sequence=[0,0,0.5,0];const both=submitGuess(kanto,'nidoran',10,()=>sequence.shift());assert.equal(both.revealed[29].shiny,true);assert.equal(both.revealed[32].shiny,false);
});
test('give up preserves caught sprites without rolling remaining Pokémon',()=>{
 const r=submitGuess(createRun(data,[1],'easy',normal),'bulbasaur',10,normal);const end=giveUp(r,20);assert.equal(end.status,'gave-up');assert.equal(end.revealed,r.revealed);assert.equal(end.hidden,r.hidden);assert.equal(Object.keys(end.revealed).length,1);
});
test('catalogue is complete with valid first frames, final frames, animation sheets and hints',()=>{
 assert.equal(data.length,386);let total=0;const seenTypes=new Set();for(const p of data){assert.ok(p.description.length>10);assert.doesNotMatch(p.description,/(?:A|An|a|an|The|the) This Pokémon|This Pokémonitic|This Pokémonsis|This Pokémon (?:are|make)\b|This Pokémon flocks|copy- protected|--/);const escaped=p.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');assert.doesNotMatch(p.description,new RegExp(`\\b${escaped}\\b`,'i'));assert.ok(p.types.length>=1&&p.types.length<=2);p.types.forEach(type=>seenTypes.add(type));assert.ok(p.normal.length&&p.shiny.length);for(const sprite of [...p.normal,...p.shiny]){total++;assert.ok(sprite.durations.every(d=>d>0));assert.ok(existsSync(new URL('../public'+sprite.still,import.meta.url)));assert.ok(existsSync(new URL('../public'+sprite.last,import.meta.url)));assert.ok(existsSync(new URL('../public'+sprite.sheet,import.meta.url)));}}assert.ok(data.some(p=>/A POKéMON/.test(p.description)));assert.equal(total,835);assert.equal(seenTypes.size,17);for(const type of seenTypes)assert.ok(existsSync(new URL(`../public/types/${type}.png`,import.meta.url)));
});
test('catalogue keeps approved anonymous wording corrections',()=>{
 const description=id=>data.find(p=>p.id===id).description;
 assert.match(description(46),/parasitic tochukaso mushrooms/);
 assert.match(description(97),/deep hypnosis/);
 assert.match(description(219),/have turned their bodies into magma/);
 assert.match(description(227),/feathers fallen from this Pokémon/);
 assert.match(description(250),/feathers—which glow.*light—are thought/);
 assert.match(description(333),/flocks of these Pokémon move closer to towns/);
 assert.match(description(342),/A veteran of this type of Pokémon that has prevailed/);
 assert.match(description(370),/^These Pokémon make/);
});
test('catalogue uses Generation 3 typing in slot order',()=>{
 const types=id=>data.find(p=>p.id===id).types;
 assert.deepEqual(types(3),['grass','poison']);
 assert.deepEqual(types(6),['fire','flying']);
 assert.deepEqual(types(35),['normal']);
 assert.deepEqual(types(81),['electric','steel']);
 assert.deepEqual(types(122),['psychic']);
 assert.deepEqual(types(184),['water']);
 assert.ok(existsSync(new URL('../public/audio/menu-select.mp3',import.meta.url)));
});
