export type Ingredient = {
  name: string;
  amount: string;
  quantity: number;
  unit: string;
  form?: string;
};
export type Recipe = {
  id: string;
  name: string;
  description: string;
  category: string;
  prepTime: number;
  cookTime: number;
  time: number;
  difficulty: "Easy" | "Moderate";
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  allergens: string[];
  substitutions: string[];
  safety: string[];
  color: string;
  image?: string;
  imageAlt?: string;
  source: "curated" | "adaptive";
  template?: string;
};
export type Profile = {
  name: string;
  group: "base" | "vegetable" | "protein" | "fruit" | "flavour" | "dairy";
  quantity: number;
  unit: string;
  prep: string;
  method:
    | "root"
    | "firm"
    | "leaf"
    | "soft"
    | "cold"
    | "chicken"
    | "fish"
    | "tofu"
    | "bean"
    | "egg"
    | "base";
  animal?: boolean;
  allergens?: string[];
  form?: string;
};
