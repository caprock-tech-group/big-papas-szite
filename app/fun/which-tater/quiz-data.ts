export type TaterSlug =
  | "big-hoss"
  | "taco-tater"
  | "mac-daddy"
  | "italian-stallion"
  | "broccoli-cheddar"
  | "chicken-fried-steak"
  | "breakfast-tater";

export type TaterResult = {
  slug: TaterSlug;
  name: string;
  persona: string;
  kicker: string;
  description: string;
  verdict: string;
  art: string;
  card: string;
  accent: string;
};

export const taterResults: Record<TaterSlug, TaterResult> = {
  "big-hoss": {
    slug: "big-hoss",
    name: "The Big Hoss",
    persona: "The Headliner",
    kicker: "Bold. Dependable. Absolutely not here to play around.",
    description:
      "You walk in like you own the place, take care of your people, and believe anything worth doing is worth doing Texas-sized.",
    verdict: "Your appetite has leadership qualities.",
    art: "/images/big-hoss-hero.webp",
    card: "/images/tater-quiz/cards/big-hoss.jpg",
    accent: "#c84335",
  },
  "taco-tater": {
    slug: "taco-tater",
    name: "Taco Tater",
    persona: "The Firestarter",
    kicker: "Spicy, social, and always ready for a good time.",
    description:
      "You bring the energy, order the extra jalapeños, and somehow turn an ordinary Tuesday into a full-blown event.",
    verdict: "You are the group chat with queso on top.",
    art: "/images/tater-quiz/art/taco-tater.png",
    card: "/images/tater-quiz/cards/taco-tater.jpg",
    accent: "#d89d31",
  },
  "mac-daddy": {
    slug: "mac-daddy",
    name: "Mac Daddy",
    persona: "The Comfort King",
    kicker: "Easygoing, lovable, and always the right answer.",
    description:
      "You know life is better when everyone is comfortable, well-fed, and laughing. People trust you—and steal bites from your plate.",
    verdict: "You are a warm hug wearing bacon.",
    art: "/images/tater-quiz/art/mac-daddy.png",
    card: "/images/tater-quiz/cards/mac-daddy.jpg",
    accent: "#bf3d32",
  },
  "italian-stallion": {
    slug: "italian-stallion",
    name: "The Italian Stallion",
    persona: "The Smooth Talker",
    kicker: "Charming, dramatic, and never shy with the Parmesan.",
    description:
      "You appreciate the finer things: big flavor, good company, and an entrance people remember. Subtlety was never really your thing.",
    verdict: "Your personality comes with extra marinara.",
    art: "/images/tater-quiz/art/italian-stallion.png",
    card: "/images/tater-quiz/cards/italian-stallion.jpg",
    accent: "#315f86",
  },
  "broccoli-cheddar": {
    slug: "broccoli-cheddar",
    name: "Broccoli Cheddar",
    persona: "The Good Influence",
    kicker: "Practical, thoughtful, and still completely covered in cheese.",
    description:
      "You keep the crew grounded, remember the important details, and make responsible choices without making them boring.",
    verdict: "You brought vegetables. We brought the cheddar.",
    art: "/images/tater-quiz/art/broccoli-cheddar.png",
    card: "/images/tater-quiz/cards/broccoli-cheddar.jpg",
    accent: "#49713c",
  },
  "chicken-fried-steak": {
    slug: "chicken-fried-steak",
    name: "Chicken Fried Steak Tater",
    persona: "The Country Legend",
    kicker: "Straight-shooting, loyal, and built for country gravy.",
    description:
      "You show up, work hard, tell it like it is, and never let your people leave hungry. Fancy is optional; flavor is not.",
    verdict: "You are Panhandle comfort with a crispy edge.",
    art: "/images/tater-quiz/art/chicken-fried-steak.png",
    card: "/images/tater-quiz/cards/chicken-fried-steak.jpg",
    accent: "#a43129",
  },
  "breakfast-tater": {
    slug: "breakfast-tater",
    name: "Breakfast Tater",
    persona: "The All-Day Hustler",
    kicker: "Up early, moving fast, and refusing to respect breakfast hours.",
    description:
      "You have a plan, three backup plans, and enough energy to get the whole crew rolling before everyone else finds their coffee.",
    verdict: "You believe sunrise is a competitive advantage.",
    art: "/images/tater-quiz/art/breakfast-tater.png",
    card: "/images/tater-quiz/cards/breakfast-tater.jpg",
    accent: "#d08a24",
  },
};

type QuizAnswer = {
  label: string;
  detail: string;
  scores: Partial<Record<TaterSlug, number>>;
};

export type QuizQuestion = {
  eyebrow: string;
  prompt: string;
  answers: QuizAnswer[];
};

export const quizQuestions: QuizQuestion[] = [
  {
    eyebrow: "Question one",
    prompt: "You walk into a cookout. What happens next?",
    answers: [
      { label: "I take charge of the grill", detail: "Somebody has to run this operation.", scores: { "big-hoss": 3, "chicken-fried-steak": 1 } },
      { label: "I turn up the music", detail: "This party needed some energy.", scores: { "taco-tater": 3, "italian-stallion": 1 } },
      { label: "I find the comfiest chair", detail: "I came prepared to stay awhile.", scores: { "mac-daddy": 3, "broccoli-cheddar": 1 } },
      { label: "I brought breakfast burritos", detail: "The cookout starts when I say it starts.", scores: { "breakfast-tater": 3, "chicken-fried-steak": 1 } },
    ],
  },
  {
    eyebrow: "Question two",
    prompt: "Pick the flavor you would defend with your whole chest.",
    answers: [
      { label: "Smoky BBQ", detail: "Bold, rich, and unapologetically Texas.", scores: { "big-hoss": 3, "chicken-fried-steak": 1 } },
      { label: "Queso with a kick", detail: "Cheese is good. Spicy cheese is better.", scores: { "taco-tater": 3, "mac-daddy": 1 } },
      { label: "Marinara and Parmesan", detail: "I appreciate a little drama.", scores: { "italian-stallion": 3 } },
      { label: "Country gravy", detail: "Put it on everything and ask questions later.", scores: { "chicken-fried-steak": 2, "breakfast-tater": 2 } },
    ],
  },
  {
    eyebrow: "Question three",
    prompt: "Your friends need help moving. Who are you?",
    answers: [
      { label: "The one with the truck", detail: "I already brought straps and a plan.", scores: { "big-hoss": 2, "chicken-fried-steak": 2 } },
      { label: "The morale department", detail: "I have jokes, drinks, and a playlist.", scores: { "taco-tater": 2, "italian-stallion": 2 } },
      { label: "The snack coordinator", detail: "Nobody lifts a couch on an empty stomach.", scores: { "mac-daddy": 3, "breakfast-tater": 1 } },
      { label: "The careful organizer", detail: "Every box is labeled. You are welcome.", scores: { "broccoli-cheddar": 3 } },
    ],
  },
  {
    eyebrow: "Question four",
    prompt: "Choose your ideal Texas road-trip soundtrack.",
    answers: [
      { label: "Outlaw country", detail: "Windows down. Volume up.", scores: { "big-hoss": 2, "chicken-fried-steak": 2 } },
      { label: "Anything that starts a dance", detail: "The gas station is now a venue.", scores: { "taco-tater": 3 } },
      { label: "Big dramatic sing-alongs", detail: "Every chorus deserves a performance.", scores: { "italian-stallion": 3, "mac-daddy": 1 } },
      { label: "A calm, carefully made playlist", detail: "No skips. No surprises.", scores: { "broccoli-cheddar": 2, "breakfast-tater": 2 } },
    ],
  },
  {
    eyebrow: "Question five",
    prompt: "What is your real-life superpower?",
    answers: [
      { label: "Getting things done", detail: "Hand me the problem and step aside.", scores: { "big-hoss": 2, "breakfast-tater": 2 } },
      { label: "Making everyone laugh", detail: "Serious situations fear me.", scores: { "taco-tater": 2, "mac-daddy": 2 } },
      { label: "Winning people over", detail: "Charm is a renewable resource.", scores: { "italian-stallion": 3 } },
      { label: "Keeping everybody grounded", detail: "I remembered the charger and the directions.", scores: { "broccoli-cheddar": 2, "chicken-fried-steak": 2 } },
    ],
  },
  {
    eyebrow: "Final question",
    prompt: "Be honest: how hungry are you?",
    answers: [
      { label: "Texas-sized hungry", detail: "Bring me the headliner.", scores: { "big-hoss": 4 } },
      { label: "Hungry enough to get reckless", detail: "Extra jalapeños. Let us ride.", scores: { "taco-tater": 3, "italian-stallion": 1 } },
      { label: "I need comfort immediately", detail: "Cheese is now a medical necessity.", scores: { "mac-daddy": 2, "broccoli-cheddar": 2 } },
      { label: "I could eat breakfast twice", detail: "Time is a social construct.", scores: { "breakfast-tater": 3, "chicken-fried-steak": 1 } },
    ],
  },
];

export const taterSlugs = Object.keys(taterResults) as TaterSlug[];
