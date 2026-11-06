export type Recipe = {
  id: string;
  name: string;
  description: string;
  time: number;
  difficulty: "Easy";
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tags: string[];
  color: string;
};
type Row = [string, string, number, string, string[], string[]];
const rows: Row[] = [
  [
    "Garden omelette",
    "A soft, golden omelette with a generous helping of greens.",
    12,
    "egg:2|spinach:1 handful|cheese:25 g|oil:1 tsp|salt:pinch",
    [
      "Beat eggs with salt. Wash and roughly chop spinach.",
      "Heat oil in a small nonstick pan over medium heat. Wilt spinach for 1 minute.",
      "Pour in eggs. Gently pull edges inward until nearly set. Add cheese, fold, and cook until the eggs are fully set.",
    ],
    ["vegetarian", "gluten-free"],
  ],
  [
    "Vegetable fried rice",
    "A quick skillet supper for leftover rice and crisp vegetables.",
    15,
    "rice:150 g cooked|carrot:1|egg:1|soy sauce:1 tbsp|oil:1 tbsp",
    [
      "Use refrigerated cooked rice stored promptly after cooking; follow local rice-storage guidance. Grate carrot and beat egg.",
      "Heat oil in a large pan. Cook carrot for 3 minutes, then scramble egg until set.",
      "Add rice and soy sauce. Stir-fry until piping hot throughout. Serve immediately; reheat rice only once.",
    ],
    [],
  ],
  [
    "Tomato & spinach pasta",
    "A simple, bright sauce that comes together as the pasta cooks.",
    20,
    "pasta:160 g dry|tomato:3|spinach:2 handfuls|garlic:1 clove|oil:1 tbsp|salt:pinch",
    [
      "Cook pasta in salted water according to its packet; save a little cooking water.",
      "Chop tomatoes and garlic. Gently fry garlic in oil, then add tomatoes and simmer 8 minutes.",
      "Stir in spinach until wilted. Toss with pasta and a splash of cooking water.",
    ],
    ["vegan"],
  ],
  [
    "Cheese quesadilla",
    "Crisp tortillas with a melty centre and fresh tomato.",
    10,
    "tortilla:2|cheese:60 g|tomato:1|oil:1 tsp",
    [
      "Dice tomato and grate cheese.",
      "Fill one half of each tortilla with cheese and tomato; fold closed.",
      "Heat oil in a skillet over medium heat. Cook each side 2–3 minutes until golden and the cheese melts.",
    ],
    ["vegetarian"],
  ],
  [
    "Rainbow stir-fry",
    "Crunchy vegetables in a simple soy glaze.",
    20,
    "bell pepper:1|broccoli:1 small head|carrot:1|soy sauce:2 tbsp|oil:1 tbsp|rice:150 g dry",
    [
      "Cook rice according to its packet. Cut vegetables into small even pieces.",
      "Heat oil in a wide pan. Stir-fry carrot and broccoli for 5 minutes; add a splash of water if needed.",
      "Add pepper and cook 3 minutes. Toss with soy sauce and serve over rice.",
    ],
    ["vegan"],
  ],
  [
    "Carrot & lentil soup",
    "A comforting one-pot bowl with warming, earthy flavour.",
    30,
    "carrot:3|lentil:120 g red dry|onion:1|vegetable stock:700 ml|oil:1 tbsp",
    [
      "Rinse red lentils. Dice onion and carrots.",
      "Soften onion in oil for 5 minutes. Add carrot, lentils and stock.",
      "Simmer for 20 minutes until lentils and carrots are tender. Blend if desired and season to taste.",
    ],
    ["vegan", "gluten-free"],
  ],
  [
    "Tomato toast",
    "Juicy tomatoes on crisp toast, ready in minutes.",
    8,
    "bread:2 slices|tomato:2|oil:2 tsp|salt:pinch|pepper:pinch",
    [
      "Toast bread until golden.",
      "Dice tomatoes and toss with oil, salt and pepper.",
      "Spoon onto hot toast and serve straight away.",
    ],
    ["vegan"],
  ],
  [
    "Tray-roasted vegetables",
    "Caramelised edges, soft centres and very little washing up.",
    35,
    "potato:2|carrot:2|zucchini:1|oil:2 tbsp|salt:pinch",
    [
      "Heat oven to 210°C / 410°F. Scrub vegetables and cut into similar bite-size pieces.",
      "Toss with oil and salt on a large tray, leaving room between pieces.",
      "Roast 25–30 minutes, turning halfway, until potatoes are tender and edges golden.",
    ],
    ["vegan", "gluten-free"],
  ],
  [
    "Chickpea crunch salad",
    "A filling, fresh lunch with a lemony dressing.",
    12,
    "chickpea:240 g canned drained|cucumber:1/2|tomato:2|lemon:1/2|oil:1 tbsp|salt:pinch",
    [
      "Drain and rinse canned chickpeas. Chop cucumber and tomatoes.",
      "Whisk lemon juice, oil and salt in a bowl.",
      "Add vegetables and chickpeas; toss well. Serve immediately or refrigerate promptly.",
    ],
    ["vegan", "gluten-free"],
  ],
  [
    "Hummus veggie wrap",
    "A no-cook lunch with plenty of crunch.",
    10,
    "tortilla:2|hummus:4 tbsp|carrot:1|lettuce:4 leaves",
    [
      "Wash lettuce, dry well and grate carrot.",
      "Spread hummus over tortillas and layer with lettuce and carrot.",
      "Fold in the sides, roll tightly and slice in half.",
    ],
    ["vegan"],
  ],
  [
    "Cheese & tomato sandwich",
    "An everyday classic, toasted until golden.",
    10,
    "bread:4 slices|cheese:60 g|tomato:1|butter:10 g",
    [
      "Slice tomato thinly and pat off excess moisture.",
      "Layer cheese and tomato between bread. Butter the outer surfaces.",
      "Cook in a skillet over medium-low heat for 3–4 minutes per side until cheese melts.",
    ],
    ["vegetarian"],
  ],
  [
    "Creamy mushroom pasta",
    "Golden mushrooms with a simple, silky sauce.",
    25,
    "pasta:160 g dry|mushroom:200 g|milk:150 ml|flour:1 tbsp|butter:15 g|salt:pinch",
    [
      "Cook pasta according to its packet. Slice mushrooms.",
      "Fry mushrooms in butter for 7 minutes. Stir in flour and cook 1 minute.",
      "Gradually stir in milk. Simmer 3 minutes until thickened, then toss with drained pasta and season.",
    ],
    ["vegetarian"],
  ],
  [
    "Banana oat pancakes",
    "Small, tender pancakes with no added sugar.",
    15,
    "banana:1 ripe|egg:2|oats:50 g|oil:1 tsp",
    [
      "Mash banana. Blend or mix thoroughly with eggs and oats; rest for 5 minutes.",
      "Heat a nonstick pan over medium-low heat and brush with oil.",
      "Spoon small rounds into the pan. Cook 2–3 minutes each side until golden and fully set inside.",
    ],
    ["vegetarian"],
  ],
  [
    "Apple porridge",
    "A warm bowl of oats with soft apple.",
    12,
    "oats:60 g|milk:250 ml|apple:1",
    [
      "Dice or grate apple, removing its core.",
      "Combine oats, milk and apple in a small saucepan.",
      "Simmer gently for 5–8 minutes, stirring often, until oats are creamy and apple is tender. Add water if too thick.",
    ],
    ["vegetarian"],
  ],
  [
    "Spinach scrambled eggs",
    "Soft eggs and greens on toast.",
    10,
    "egg:2|spinach:1 handful|bread:2 slices|butter:10 g|salt:pinch",
    [
      "Toast bread. Beat eggs with a pinch of salt.",
      "Melt butter over medium-low heat. Add washed spinach and wilt.",
      "Add eggs and stir gently until fully set. Spoon over toast.",
    ],
    ["vegetarian"],
  ],
  [
    "Broccoli cheese soup",
    "A cozy, creamy bowl using the stems as well as the florets.",
    30,
    "broccoli:1 head|potato:1|milk:200 ml|vegetable stock:400 ml|cheese:60 g",
    [
      "Peel tough broccoli stems and chop with potato and florets.",
      "Simmer vegetables in stock for 15–20 minutes until tender.",
      "Add milk and blend carefully. Heat gently, stir in cheese until melted, and serve.",
    ],
    ["vegetarian", "gluten-free"],
  ],
  [
    "Lemon chickpea rice",
    "A bright, satisfying one-pan rice dish.",
    25,
    "rice:150 g dry|chickpea:240 g canned drained|lemon:1/2|spinach:2 handfuls|oil:1 tbsp|water:350 ml|salt:pinch",
    [
      "Rinse rice and drain chickpeas.",
      "Heat oil in a lidded saucepan. Add rice, water and salt. Cover and simmer according to rice packet instructions, adjusting water as directed.",
      "Once rice is tender, stir in chickpeas and spinach; cover and heat until piping hot. Finish with lemon juice.",
    ],
    ["vegan", "gluten-free"],
  ],
  [
    "Baked potato & beans",
    "An easy, filling meal from cupboard favourites.",
    55,
    "potato:2 medium|baked beans:1 can|cheese:40 g|oil:1 tsp",
    [
      "Heat oven to 220°C / 425°F. Scrub potatoes, prick with a fork and rub with oil.",
      "Bake 45–60 minutes until completely tender.",
      "Heat beans until piping hot. Split potatoes and top with beans and grated cheese.",
    ],
    ["vegetarian", "gluten-free"],
  ],
  [
    "Zucchini fritters",
    "Crisp little fritters with a cool yogurt spoonful.",
    25,
    "zucchini:1 large|egg:1|flour:4 tbsp|yogurt:4 tbsp|oil:2 tbsp|salt:pinch",
    [
      "Grate zucchini, sprinkle lightly with salt and leave 5 minutes. Squeeze dry in a clean towel.",
      "Mix with egg and flour to form a thick batter.",
      "Heat oil over medium heat. Fry small spoonfuls for 3–4 minutes per side until golden and fully cooked. Serve with yogurt.",
    ],
    ["vegetarian"],
  ],
  [
    "Garlic butter carrots",
    "A simple side that makes carrots the star.",
    20,
    "carrot:4|garlic:1 clove|butter:20 g|water:3 tbsp|salt:pinch",
    [
      "Cut carrots into thin batons and mince garlic.",
      "Put carrots, water and butter in a pan. Cover and cook gently 8–10 minutes until almost tender.",
      "Uncover, add garlic and cook 2–3 minutes, stirring until glossy. Season to taste.",
    ],
    ["vegetarian", "gluten-free"],
  ],
  [
    "Egg & potato hash",
    "A hearty skillet breakfast or easy supper.",
    30,
    "potato:2|onion:1|egg:2|oil:1 tbsp|salt:pinch",
    [
      "Dice potatoes small. Simmer in water for 8 minutes, then drain well.",
      "Heat oil in a skillet. Fry chopped onion and potatoes for 10 minutes until golden.",
      "Make two wells, crack in eggs and cover. Cook until whites and yolks reach your desired safe doneness; fully set for vulnerable people.",
    ],
    ["vegetarian", "gluten-free"],
  ],
  [
    "Peanut noodles",
    "A quick, creamy sauce for noodles and crunchy carrot.",
    15,
    "noodles:160 g dry|peanut butter:2 tbsp|soy sauce:1 tbsp|carrot:1|water:3 tbsp",
    [
      "Cook noodles according to the packet. Grate carrot.",
      "Whisk peanut butter, soy sauce and warm water until smooth.",
      "Toss hot drained noodles and carrot with sauce. Add a splash of noodle water to loosen.",
    ],
    ["vegan"],
  ],
  [
    "Cucumber yogurt bowl",
    "A cool, refreshing side with a spoonable dressing.",
    8,
    "cucumber:1|yogurt:150 g|lemon:1/2|salt:pinch",
    [
      "Wash cucumber and cut into small pieces.",
      "Mix yogurt with lemon juice and salt.",
      "Fold in cucumber. Serve immediately or cover and refrigerate promptly.",
    ],
    ["vegetarian", "gluten-free"],
  ],
  [
    "Tomato bean stew",
    "A generous, warming bowl from pantry essentials.",
    25,
    "white beans:240 g canned drained|canned tomato:400 g|onion:1|garlic:1 clove|oil:1 tbsp|salt:pinch",
    [
      "Dice onion and mince garlic. Drain and rinse canned beans.",
      "Soften onion in oil for 5 minutes. Add garlic and cook 1 minute.",
      "Add tomatoes and beans. Simmer gently for 15 minutes, stirring occasionally, then season.",
    ],
    ["vegan", "gluten-free"],
  ],
  [
    "Roasted pepper couscous",
    "A colourful bowl with sweet roasted vegetables.",
    30,
    "couscous:150 g|bell pepper:2|zucchini:1|oil:1 tbsp|water:180 ml|lemon:1/2|salt:pinch",
    [
      "Heat oven to 210°C / 410°F. Chop peppers and zucchini. Toss with oil and roast for 20–25 minutes.",
      "Put couscous in a heatproof bowl with salt. Add boiling water (or amount on packet), cover and rest 5 minutes.",
      "Fluff couscous with a fork. Toss with roasted vegetables and lemon juice.",
    ],
    ["vegan"],
  ],
  [
    "French toast",
    "Golden, custardy toast for a slow morning.",
    15,
    "bread:4 slices|egg:2|milk:80 ml|butter:15 g",
    [
      "Whisk eggs and milk in a shallow bowl.",
      "Briefly soak each slice of bread on both sides.",
      "Melt butter over medium heat. Cook bread for 3–4 minutes on each side until golden and the egg mixture is fully cooked.",
    ],
    ["vegetarian"],
  ],
  [
    "Pea & potato soup",
    "A silky green soup with simple ingredients.",
    25,
    "peas:250 g frozen|potato:1|onion:1|vegetable stock:600 ml|oil:1 tbsp",
    [
      "Chop onion and potato. Soften onion in oil for 5 minutes.",
      "Add potato and stock. Simmer for 12–15 minutes until tender.",
      "Add peas and simmer 4 minutes. Blend carefully until smooth and season to taste.",
    ],
    ["vegan", "gluten-free"],
  ],
];
export const recipes: Recipe[] = rows.map((r, i) => ({
  id: String(i + 1),
  name: r[0],
  description: r[1],
  time: r[2],
  difficulty: "Easy",
  ingredients: r[3].split("|").map((v) => {
    const [name, amount] = v.split(":");
    return { name, amount };
  }),
  steps: r[4],
  tags: r[5],
  color: ["peach", "sage", "lavender", "gold"][i % 4],
}));
