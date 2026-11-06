// Public compatibility entry point. V3 keeps stable V1/V2 recipe identifiers.
export { recipes, recommendations as matchRecipes } from "./cooking/engine";
export type { Recipe } from "./cooking/types";
