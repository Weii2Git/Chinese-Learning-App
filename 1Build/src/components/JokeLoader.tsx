"use client";

import { useState, useEffect, useRef } from "react";

const JOKES = [
  "Why did the student eat his homework? Because the teacher told him it was a piece of cake! 🎂",
  "What do you call a fish without eyes? A fsh! 🐟",
  "Why can't Elsa have a balloon? Because she'll let it go! 🎈",
  "What do you call a sleeping dinosaur? A dino-snore! 🦕",
  "Why did the math book look so sad? Because it had too many problems! 📚",
  "What do you call cheese that isn't yours? Nacho cheese! 🧀",
  "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
  "What do you call a bear with no teeth? A gummy bear! 🐻",
  "Why don't scientists trust atoms? Because they make up everything! ⚛️",
  "What do you call a lazy kangaroo? A pouch potato! 🦘",
  "Why did the bicycle fall over? Because it was two-tired! 🚲",
  "What do you call a snowman with a six-pack? An abdominal snowman! ⛄",
  "Why did the golfer bring extra pants? In case he got a hole in one! ⛳",
  "What do you call a factory that makes okay products? A satisfactory! 🏭",
  "Why did the student bring a ladder to school? Because she wanted to go to high school! 🪜",
  "What do you call a pig that does karate? A pork chop! 🥋",
  "Why did the cookie go to the doctor? Because it was feeling crummy! 🍪",
  "What do you call a dog magician? A labracadabrador! 🐕",
  "Why did the banana go to the doctor? Because it wasn't peeling well! 🍌",
  "What do you call a sleeping bull? A bulldozer! 🐂",
  "What did the ocean say to the beach? Nothing, it just waved! 🌊",
  "Why do bees have sticky hair? Because they use honeycombs! 🐝",
  "What do you call a dinosaur that crashes their car? Tyrannosaurus Wrecks! 🦖",
  "Why did the teddy bear say no to dessert? Because she was already stuffed! 🧸",
  "What do you call a boomerang that won't come back? A stick! 🪃",
  "Why did the computer go to the doctor? Because it had a virus! 💻",
  "What do you call a train that sneezes? Achoo-choo train! 🚂",
  "Why are ghosts bad at lying? Because you can see right through them! 👻",
  "What do you call a cow with no legs? Ground beef! 🐄",
  "Why did the tomato turn red? Because it saw the salad dressing! 🍅",
  "What do you call a fake noodle? An impasta! 🍝",
  "Why did the music teacher go to jail? Because she got caught with too many sharp objects! 🎵",
  "What do you call a cat that was caught by the police? The purrpetrator! 🐱",
  "Why don't eggs tell jokes? They'd crack each other up! 🥚",
  "What do you call a belt made of watches? A waist of time! ⌚",
  "Why did the picture go to jail? Because it was framed! 🖼️",
  "What do you call a deer with no eyes? No idea! 🦌",
  "Why did the grape stop in the middle of the road? Because it ran out of juice! 🍇",
  "What do you call a fish that wears a crown? A king fish! 👑",
  "Why did the robot go on vacation? To recharge his batteries! 🤖",
  "What do you call a penguin in the desert? Lost! 🐧",
  "Why did the leaf go to the doctor? It was feeling green! 🍃",
  "What do you call a monkey that loves chips? A chipmunk! 🐒",
  "Why did the sun go to school? To get brighter! ☀️",
  "What do you call a shoe made of a banana? A slipper! 👟",
  "Why did the clock get in trouble at school? Because it was always tocking! ⏰",
  "What do you call a rabbit with fleas? Bugs Bunny! 🐰",
  "Why did the chicken join a band? Because it had the drumsticks! 🐔",
  "What do you call a cow that plays guitar? A moo-sician! 🎸",
  "Why did the book join the police? It wanted to go undercover! 📖",
  "What do you call a sleeping pizza? A piZZZa! 🍕",
  "Why did the crayon feel sad? It was feeling blue! 🖍️",
  "What do you call a duck that gets all A's? A wise quacker! 🦆",
  "Why did the balloon go near the needle? It wanted to be a pop star! 🎈",
  "What do you call a cat sitting on the beach? Sandy Claws! 🏖️",
  "Why did the astronaut break up with his girlfriend? He needed more space! 🚀",
  "What do you call a dog that does magic tricks? A Labracadabrador! 🎩",
  "Why did the strawberry cry? Because its mom was in a jam! 🍓",
  "What do you call a bear in the rain? A drizzly bear! 🌧️",
  "Why did the skeleton go to the party alone? He had no body to go with! 💀",
  "What do you call a dinosaur that knows a lot of words? A thesaurus! 📖",
  "Why did the orange stop rolling? It ran out of juice! 🍊",
  "What do you call a sleeping T-Rex? A dino-snore! 😴",
  "Why did the tree go to the dentist? To get a root canal! 🌳",
  "What do you call a cow on a trampoline? A milkshake! 🥛",
  "Why did the pencil win the race? Because it had a good point! ✏️",
  "What do you call a pig that knows karate? A pork chop! 🐷",
  "Why did the football coach go to the bank? To get his quarterback! 🏈",
  "What do you call a flower that runs on electricity? A power plant! 🌸",
  "Why did the spider go to the computer? To check his website! 🕷️",
  "What do you call a snowman in summer? A puddle! 💧",
  "Why did the broom get a promotion? It was sweeping the competition! 🧹",
  "What do you call a group of musical whales? An orca-stra! 🐋",
  "Why did the lemon go to the doctor? It wasn't peeling well! 🍋",
  "What do you call a lazy baby kangaroo? A pouch potato! 🥔",
  "Why did the moon skip dinner? It was already full! 🌕",
  "What do you call a cat that bowls? An alley cat! 🎳",
  "Why did the nose feel sad? It was always getting picked on! 👃",
  "What do you call a sleeping dinosaur? A stega-snore-us! 🦕",
  "Why did the lamp go to school? To get brighter! 💡",
  "What do you call a fish that practices medicine? A sturgeon! 🐠",
  "Why did the volcano break up with the mountain? It found someone more explosive! 🌋",
  "What do you call a rabbit that tells jokes? A funny bunny! 🐇",
  "Why did the calendar feel popular? It had a lot of dates! 📅",
  "What do you call a dinosaur that wears glasses? A do-you-think-he-saw-us! 👓",
  "Why did the shoe go to the doctor? It had a heel! 👠",
  "What do you call a bird that's afraid to fly? A chicken! 🐓",
  "Why did the eraser go to school? To correct its mistakes! 🧽",
  "What do you call a cow in an earthquake? A milkshake! 🥤",
  "Why did the cloud break up with the fog? Their relationship was too misty! ☁️",
  "What do you call a turtle that flies? A shellicopter! 🐢",
  "Why did the piano go to the doctor? Because it had too many keys stuck! 🎹",
  "What do you call a sleeping dragon? A nightmare! 🐉",
  "Why did the carrot win the race? It was always ahead! 🥕",
  "What do you call a cat that eats lemons? A sourpuss! 🐱",
  "Why did the star go to school? To get a little brighter! ⭐",
  "What do you call a happy cowboy? A jolly rancher! 🤠",
  "Why did the mushroom go to the party? Because he was a fun-gi! 🍄",
  "What do you call a sleeping dinosaur? A dino-snore! 💤",
  "Why did the toilet paper roll down the hill? To get to the bottom! 🧻",
  "What do you call a bear with no ears? B! 🐻",
  "Why did the math teacher open a bakery? She was great with pi! 🥧",
  "What do you call a fish without a tail? A one-ended stick! 🐟",
  "Why did the candle feel happy? It was lit! 🕯️",
  "What do you call a lazy dinosaur? A stega-snore-us! 😴",
  "Why did the watermelon have a wedding? Because it cantaloupe! 🍉",
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface JokeLoaderProps {
  title: string;
  subtitle?: string;
}

export function JokeLoader({ title, subtitle }: JokeLoaderProps) {
  // Shuffle once on mount, cycle through without repeats
  const shuffledRef = useRef<string[]>(shuffleArray(JOKES));
  const indexRef = useRef(0);
  const [joke, setJoke] = useState(shuffledRef.current[0]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        indexRef.current = (indexRef.current + 1) % shuffledRef.current.length;
        setJoke(shuffledRef.current[indexRef.current]);
        setVisible(true);
      }, 400);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
        {subtitle && <p className="text-slate-500 text-sm mb-6">{subtitle}</p>}

        <div className="mt-4 rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">While you wait... 😄</p>
          <p
            className="text-slate-300 text-sm leading-relaxed transition-opacity duration-400"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {joke}
          </p>
        </div>
      </div>
    </div>
  );
}
