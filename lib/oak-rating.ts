import type { Run } from './game';

type Band = readonly [minimum:number, message:string];

const kanto:Band[] = [
 [0,"You still have lots to do. Look for Pokémon in grassy areas!"],
 [10,"You're on the right track! Get a Flash HM from my Aide!"],
 [20,"You still need more Pokémon! Try to catch other species!"],
 [30,"Good, you're trying hard! Get an Itemfinder from my Aide!"],
 [40,"Looking good! Go find my Aide when you get 50!"],
 [50,"You finally got at least 50 species! Be sure to get Exp.All from my Aide!"],
 [60,"Oh! This is getting even better!"],
 [70,"Very good! Go fish for some marine Pokémon!"],
 [80,"Wonderful! Do you like to collect things?"],
 [90,"I'm impressed! It must have been difficult to do!"],
 [100,"You finally got at least 100 species! I can't believe how good you are!"],
 [110,"You even have the evolved forms of Pokémon! Super!"],
 [120,"Excellent! Trade with friends to get some more!"],
 [130,"Outstanding! You've become a real pro at this!"],
 [140,"I have nothing left to say! You're the authority now!"],
];

const kantoJohto:Band[] = [
 [0,"Look for Pokémon in grassy areas!"],
 [10,"Good. I see you understand how to use Poké Balls."],
 [20,"You're getting good at this. But you have a long way to go."],
 [35,"You need to fill up the Pokédex. Catch different kinds of Pokémon!"],
 [50,"You're trying--I can see that. Your Pokédex is coming together."],
 [65,"To evolve, some Pokémon grow, others use the effects of Stones."],
 [80,"Have you gotten a fishing Rod? You can catch Pokémon by fishing."],
 [95,"Excellent! You seem to like collecting things!"],
 [110,"Some Pokémon only appear during certain times of the day."],
 [125,"Your Pokédex is filling up. Keep up the good work!"],
 [140,"I'm impressed. You're evolving Pokémon, not just catching them."],
 [155,"Have you met Kurt? His custom Poké Balls should help."],
 [170,"Wow. You've found more Pokémon than the last Pokédex research project."],
 [185,"Are you trading your Pokémon? It's tough to do this alone!"],
 [200,"Wow! You've hit 200! Your Pokédex is looking great!"],
 [215,"You've found so many Pokémon! You've really helped my studies!"],
 [230,"Magnificent! You could become a Pokémon professor right now!"],
 [245,"Your Pokédex is amazing! You're ready to turn professional!"],
];

const national:Band[] = [
 [0,"You still have lots to do. Go into every patch of grass you see and look for Pokémon!"],
 [10,"It looks as if you're getting on the right track! I've given one of my Aides a Flash HM. Make sure you go get it!"],
 [20,"Your Pokédex could use a bit more volume still! Try to catch other species of Pokémon!"],
 [30,"Good, it's apparent that you're trying hard! I've given one of my Aides an Itemfinder. Be sure to collect it!"],
 [40,"Your Pokédex is coming along quite well! I've given one of my Aides an Amulet Coin. Be sure to get it!"],
 [50,"Ah, you've finally topped 50 species! I've given one of my Aides an Exp. Share. Be sure to go get it!"],
 [60,"Hoho! This is turning into quite the respectable Pokédex!"],
 [70,"Very good! I think you'll collect even more Pokémon by going fishing!"],
 [80,"Wonderful! Let me guess... You like to collect things, don't you?"],
 [90,"I'm impressed! That must have been difficult to do!"],
 [100,"You've finally hit 100 species! I can't believe how good you are!"],
 [110,"You even have the evolved forms of Pokémon! Super!"],
 [120,"Excellent! Trade with friends to get some more!"],
 [130,"Outstanding! You've become a real pro at this!"],
 [140,"I have nothing left to say! You're the Pokémon Professor now!"],
 [152,"I have nothing left to say! You're the Pokémon Professor now! I'll be looking forward to seeing you fill the National Pokédex!"],
];

const fromBands=(count:number,bands:Band[])=>bands.reduce((message,[minimum,next])=>count>=minimum?next:message,bands[0][1]);
const isSelection=(run:Run, ids:number[])=>run.generationIds.length===ids.length&&ids.every((id,index)=>run.generationIds[index]===id);

export function oakRating(run:Run):string {
 const count=Object.keys(run.revealed).length;
 if(run.status==='complete'){
  if(isSelection(run,[1]))return 'Your Pokédex is entirely complete! Congratulations!';
  if(isSelection(run,[1,2]))return "Whoa! A perfect Pokédex! I've dreamt about this! Congratulations!";
  if(isSelection(run,[1,2,3]))return "Finally… You've finally completed the Pokédex! It's magnificent! Truly, this is a fantastic feat! Wroooooooaaaaaarrrr! Thank you! Sincerely, thank you! You've made my dream a reality!";
  return "You picked a weird combination to do! I like shorts! They're comfy and easy to wear!";
 }
 if(isSelection(run,[1]))return fromBands(count,kanto);
 if(isSelection(run,[1,2]))return fromBands(count,kantoJohto);
 return fromBands(count,national);
}
