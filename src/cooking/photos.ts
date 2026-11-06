// Only these reviewed photo/recipe pairs can display photography. Adaptive meals
// always use artwork; imported backups cannot request arbitrary remote images.
export type Photo = {
  path: string;
  alt: string;
  credit: string;
  source: string;
};
export const photoCredits: Record<string, Photo> = {
  "collection-basil-pesto-farfalle": {
    path: "recipes/pasta.webp",
    alt: "Farfalle pasta with green basil pesto, cherry tomatoes and salad leaves.",
    credit: "Eaters Collective · CC0",
    source:
      "https://commons.wikimedia.org/wiki/File:Pesto_Pasta_(Unsplash).jpg",
  },
  "collection-rainbow-chickpea-salad": {
    path: "recipes/salad.webp",
    alt: "A colourful salad bowl with chickpeas, avocado, sweet potato, tomatoes and crisp vegetables.",
    credit: "Anna Pelzer · Unsplash License",
    source: "https://unsplash.com/photos/IGfIGP5ONV0",
  },
  "collection-salmon-quinoa-beans": {
    path: "recipes/salmon-quinoa.webp",
    alt: "Cooked salmon with quinoa, green beans, tomatoes and pine nuts.",
    credit: "Ella Olsson · Unsplash License",
    source: "https://unsplash.com/photos/KPDbRyFOTnE",
  },
};
export function photoFor(id: string) {
  return photoCredits[id];
}
