import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChefHat,
  Clock,
  Heart,
  Search,
  Check,
  Plus,
  ShoppingBasket,
  Leaf,
  ArrowUpRight,
  SlidersHorizontal,
} from "lucide-react";
import { type Data, localDate, foodAmount } from "../core";
import { ingredientKey } from "./ingredients";
import {
  recommendations,
  evaluate,
  recipeShopping,
  confirmCooking,
  eligibleFoods,
  diversity,
  emptyPersonal,
  preferenceAllows,
  type Personal,
  type Match,
  type Recipe,
} from "./engine";
import {
  readPersonal,
  changePersonal,
  validatePersonal,
  recipeSnapshot,
} from "./personal";
import { photoFor } from "./photos";
import "./recipes.css";
type Commit = (next: Data, message?: string) => Promise<void>;
export function RecipeArtwork({
  recipe,
  hero = false,
}: {
  recipe: Recipe;
  hero?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const photo = recipe.source === "adaptive" ? undefined : photoFor(recipe.id);
  return (
    <div className={`dish-art ${recipe.color} ${hero ? "dish-hero" : ""}`}>
      {photo && !failed ? (
        <img
          src={`${import.meta.env.BASE_URL}${photo.path}`}
          alt={photo.alt}
          width="640"
          height="400"
          loading={hero ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <div className={`dish-plate dish-${recipe.template ?? "classic"}`}>
            <Leaf className="dish-leaf" />
            <span />
            <span />
            <span />
            <ChefHat size={36} />
          </div>
          <span className="art-caption">
            {recipe.source === "adaptive"
              ? "Made from your groceries"
              : "EatFirst kitchen"}
          </span>
        </>
      )}
      <span className="dish-time">
        <Clock size={13} />
        {recipe.time} min
      </span>
    </div>
  );
}
export function CookingCard({
  match,
  onOpen,
}: {
  match: Match;
  onOpen: (r: Recipe) => void;
}) {
  return (
    <button
      className="recipe-card cooking-card"
      onClick={() => onOpen(match)}
      aria-label={`${match.name} · ${match.state}`}
    >
      <RecipeArtwork recipe={match} />
      <div className="recipe-card-body">
        <span
          className={`recipe-match ${match.state === "Ready to cook" ? "ready" : ""}`}
        >
          {match.state === "Ready to cook" ? (
            <>
              <Check size={14} />
              Ready to cook
            </>
          ) : match.state === "Mostly available" ? (
            `Almost ready · missing ${match.missing.length}`
          ) : (
            match.state
          )}
        </span>
        <h3>{match.name}</h3>
        <p>{match.description}</p>
        <div className="dish-tags">
          <span>{match.difficulty}</span>
          {match.tags.slice(0, 1).map((t) => (
            <span key={t}>{t}</span>
          ))}
          <span>
            {match.available}/{match.ingredients.length} matched
          </span>
        </div>
        {match.missing.length > 0 && (
          <p className="dish-missing">
            Missing:{" "}
            {match.missing
              .map((i) => i.name)
              .slice(0, 3)
              .join(", ")}
            {match.missing.length > 3 ? "…" : ""}
          </p>
        )}
        {match.verification.length > 0 && (
          <p className="dish-missing">
            Verify units or preparation: {match.verification.join(", ")}
          </p>
        )}
        <div className="card-foot">
          <span>
            {match.urgent
              ? `Use soon: ${match.urgentNames.join(", ")}`
              : match.source === "adaptive"
                ? "Adapted to your kitchen"
                : match.category}
          </span>
          <ArrowUpRight size={17} />
        </div>
      </div>
    </button>
  );
}
function Section({
  title,
  sub,
  matches,
  onOpen,
  empty,
}: {
  title: string;
  sub: string;
  matches: Match[];
  onOpen: (r: Recipe) => void;
  empty: string;
}) {
  return (
    <section className="cooking-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">{sub}</p>
        </div>
        <span className="section-count">{matches.length}</span>
      </div>
      {matches.length ? (
        <div className="recipe-grid">
          {matches.map((m) => (
            <CookingCard key={m.id} match={m} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="recipe-empty">
          <ChefHat size={26} />
          <p>{empty}</p>
        </div>
      )}
    </section>
  );
}
export function useRecipePersonal(identity: string) {
  const [personal, setPersonal] = useState<Personal>(emptyPersonal),
    [error, setError] = useState(""),
    [loadedFor, setLoadedFor] = useState("");
  const current = useRef(identity);
  current.current = identity;
  useEffect(() => {
    let active = true;
    setPersonal(emptyPersonal());
    setError("");
    void readPersonal(identity)
      .then((p) => {
        if (active) {
          setPersonal(p);
          setLoadedFor(identity);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Recipe memories could not be loaded. Your groceries are unchanged.",
          );
      });
    return () => {
      active = false;
    };
  }, [identity]);
  async function update(fn: (p: Personal) => Personal) {
    const key = identity;
    const next = await changePersonal(key, fn);
    if (current.current === key) setPersonal(next);
  }
  return { personal, update, error, loading: loadedFor !== identity };
}
export function RecipeExperience({
  data,
  today,
  personal,
  update,
  onOpen,
  initialReady = false,
}: {
  data: Data;
  today: string;
  personal: Personal;
  update: (fn: (p: Personal) => Personal) => Promise<void>;
  onOpen: (r: Recipe) => void;
  initialReady?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [max, setMax] = useState(90),
    [servings, setServings] = useState(2),
    [view, setView] = useState(initialReady ? "Ready" : "Home"),
    [exclude, setExclude] = useState(personal.exclusions.join(", ")),
    [showPreferences, setShowPreferences] = useState(false),
    [error, setError] = useState(""),
    [limit, setLimit] = useState(24);
  const matches = useMemo(
    () => recommendations(data, today, personal, servings),
    [data, today, personal, servings],
  );
  const filtered = matches.filter(
    (r) =>
      r.time <= max &&
      (category === "All" || r.category === category) &&
      (!query ||
        [r.name, ...r.ingredients.map((i) => i.name)].some((s) =>
          ingredientKey(s).includes(ingredientKey(query)),
        )),
  );
  const open = (r: Recipe) => onOpen(r);
  const groups: {
    title: string;
    sub: string;
    items: Match[];
    empty: string;
  }[] = [
    {
      title: "Cook with what we have",
      sub: "Quantity-aware ideas for your household, including pantry assumptions.",
      items: diversity(filtered.filter((r) => r.state === "Ready to cook")),
      empty:
        "Add groceries with quantities and units to find ready-to-cook meals. Unclear quantities appear under verification.",
    },
    {
      title: "Eat these first",
      sub: "Meals that use eligible ingredients due within three days.",
      items: diversity(
        filtered
          .filter((r) => r.urgent > 0)
          .sort((a, b) => b.urgent - a.urgent || b.score - a.score),
      ),
      empty:
        "No eligible ingredients are due within three days. Past-date food is kept out of automatic matches.",
    },
    {
      title: "Almost ready",
      sub: "One or two missing ingredients; add only the shortfall to shopping.",
      items: diversity(
        filtered.filter((r) => r.missing.length > 0 && r.missing.length <= 2),
      ),
      empty: "Add some groceries to discover close matches.",
    },
    {
      title: "Quick meals",
      sub: "Everyday cooking in 20 minutes or less.",
      items: diversity(filtered.filter((r) => r.time <= 20)),
      empty: "No quick meals match these filters.",
    },
    {
      title: "From the EatFirst kitchen",
      sub: "Photographed dishes from our original collection. Photo credits are in each recipe.",
      items: filtered.filter((r) => Boolean(photoFor(r.id))),
      empty:
        "No photographed recipes match these preferences. Other meals use our kitchen artwork.",
    },
    {
      title: "Family favorites",
      sub: "Your saved recipes on this device, scoped to this account and kitchen.",
      items: personal.favorites
        .filter((r) => preferenceAllows(r, data, personal))
        .map((r) => evaluate(r, data, today, servings)),
      empty: "Open a recipe and tap Save favorite to keep it here.",
    },
    {
      title: "Recently cooked",
      sub: "Your last six meals. Recent repeats get a small ranking penalty.",
      items: personal.history
        .filter((h) => preferenceAllows(h.recipe, data, personal))
        .slice(0, 6)
        .map((h) => evaluate(h.recipe, data, today, servings))
        .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i),
      empty: "Confirm a cooked meal to start your history.",
    },
  ];
  const categories = [...new Set(matches.map((m) => m.category))].sort();
  function exportMemories() {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              { format: "eatfirst-recipes", version: 1, ...personal },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      );
    a.href = url;
    a.download = "eatfirst-recipe-memories.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div
      className={`recipe-experience ${view === "Home" ? "recipe-home" : ""}`}
    >
      <div className="cooking-heading">
        <p className="eyebrow">A LITTLE LESS WASTE. A LOT MORE POSSIBILITY.</p>
        <h1>What’s cooking?</h1>
        <p>
          Your groceries, reimagined. Practical meals for the way your family
          eats.
        </p>
        <div className="cooking-summary">
          <span>
            <Leaf size={16} />
            {matches.filter((r) => r.source === "adaptive").length} ideas from
            your groceries
          </span>
          <span>
            {matches.filter((r) => r.state === "Ready to cook").length} ready
            with your pantry
          </span>
        </div>
      </div>
      <div className="cooking-toolbar panel">
        <label className="recipe-search">
          <Search size={18} />
          <span className="sr-only">Search recipes or ingredients</span>
          <input
            placeholder="Try chicken, spinach, pasta…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(24);
            }}
          />
        </label>
        <label>
          Meal category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>All</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Maximum time
          <select value={max} onChange={(e) => setMax(Number(e.target.value))}>
            {[15, 20, 30, 45, 60, 90].map((n) => (
              <option value={n} key={n}>
                {n} min
              </option>
            ))}
          </select>
        </label>
        <label>
          Servings
          <select
            aria-label="Servings"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 6, 8, 12].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          className="btn secondary"
          onClick={() => setShowPreferences(!showPreferences)}
          aria-expanded={showPreferences}
        >
          <SlidersHorizontal size={17} />
          Preferences
        </button>
      </div>
      {showPreferences && (
        <section className="panel padded recipe-preferences">
          <h2>Make it yours</h2>
          <p className="muted">
            Pantry staples and dietary tags in Settings belong to the active
            household. Favorites, exclusions and cooking history here belong to
            your account and kitchen on this device; they do not sync between
            phones.
          </p>
          <label>
            Exclude ingredients (comma separated)
            <input
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              placeholder="peanut butter, mushroom"
              maxLength={1000}
            />
          </label>
          <button
            className="btn primary"
            onClick={() =>
              void update((p) => ({
                ...p,
                exclusions: exclude
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })).catch((e) => setError(e.message))
            }
          >
            Save exclusions
          </button>
          <fieldset className="allergen-preferences">
            <legend>Exclude known allergens</legend>
            <p className="muted small">
              Conservative filtering of listed allergens; always check labels
              and cross-contact. Unknown-label recipes are excluded when a
              filter is active.
            </p>
            <div className="chips">
              {[
                "milk",
                "egg",
                "wheat",
                "soy",
                "peanut",
                "sesame",
                "pine nut",
                "celery",
                "fish",
              ].map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={(personal.allergens ?? []).includes(a)}
                  className={
                    (personal.allergens ?? []).includes(a) ? "selected" : ""
                  }
                  onClick={() =>
                    void update((p) => ({
                      ...p,
                      allergens: (p.allergens ?? []).includes(a)
                        ? p.allergens!.filter((x) => x !== a)
                        : [...(p.allergens ?? []), a],
                    })).catch((e) => setError(e.message))
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="recipe-memory-actions">
            <button className="btn secondary" onClick={exportMemories}>
              Export recipe memories
            </button>
            <label className="btn secondary">
              Import recipe memories
              <input
                className="sr-only"
                type="file"
                accept="application/json"
                onChange={async (e) => {
                  try {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 1000000)
                      throw Error("Recipe backup is too large.");
                    const parsed = JSON.parse(await f.text());
                    if (
                      parsed.format !== "eatfirst-recipes" ||
                      parsed.version !== 1
                    )
                      throw Error("Not an EatFirst recipe backup.");
                    const next = validatePersonal(parsed);
                    if (
                      window.confirm(
                        "Replace personal favorites, cooking history and exclusions for this account and kitchen on this device? Groceries stay unchanged.",
                      )
                    )
                      await update(() => next);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </label>
          </div>
          <p className="muted small">
            Recipe memories have their own backup. Inventory and shared-data
            backups remain in Settings.
          </p>
        </section>
      )}
      {error && (
        <p role="alert" className="banner danger">
          {error}
        </p>
      )}
      <div className="chips recipe-chips" aria-label="Recipe sections">
        {[
          "Home",
          "Ready",
          "Almost ready",
          "Discover",
          "Favorites",
          "Recently cooked",
        ].map((v) => (
          <button
            key={v}
            className={v === view ? "selected" : ""}
            aria-pressed={v === view}
            onClick={() => {
              setView(v);
              setLimit(24);
            }}
          >
            {v === "Ready"
              ? "I can make this"
              : v === "Discover"
                ? "Discover recipes"
                : v}
          </button>
        ))}
      </div>
      <p className="recipe-safety-note">
        Past use-by and past best-before foods are excluded. Unknown units,
        preparation forms and thawing require verification. Pantry matches are
        assumptions; check package labels for allergens.
      </p>
      {view === "Home" ? (
        groups.map((g) => (
          <Section
            key={g.title}
            title={g.title}
            sub={g.sub}
            matches={g.items}
            onOpen={open}
            empty={g.empty}
          />
        ))
      ) : view === "Favorites" || view === "Recently cooked" ? (
        groups
          .filter(
            (g) =>
              g.title ===
              (view === "Favorites" ? "Family favorites" : "Recently cooked"),
          )
          .map((g) => (
            <Section
              key={g.title}
              title={g.title}
              sub={g.sub}
              matches={g.items}
              onOpen={open}
              empty={g.empty}
            />
          ))
      ) : (
        <>
          <Section
            title={
              view === "Discover"
                ? "Discover recipes"
                : view === "Ready"
                  ? "Cook with what we have"
                  : "Almost ready"
            }
            sub="Ranked by verified availability, urgency, missing ingredients and preparation time."
            matches={filtered
              .filter(
                (m) =>
                  view === "Discover" ||
                  (view === "Ready"
                    ? m.state === "Ready to cook"
                    : m.missing.length > 0 && m.missing.length <= 2),
              )
              .slice(0, limit)}
            onOpen={open}
            empty="No meals match these filters. Add groceries, check units or broaden your filters."
          />
          {filtered.length > limit && (
            <button
              className="btn secondary full"
              onClick={() => setLimit((n) => n + 24)}
            >
              Show more recipes
            </button>
          )}
        </>
      )}
    </div>
  );
}
export function RecipeDetail({
  recipe,
  data,
  today,
  commit,
  personal,
  update,
  close,
  Modal,
}: {
  recipe: Recipe;
  data: Data;
  today: string;
  commit: Commit;
  personal: Personal;
  update: (fn: (p: Personal) => Personal) => Promise<void>;
  close: () => void;
  Modal: (p: {
    title: string;
    children: ReactNode;
    close: () => void;
  }) => ReactNode;
}) {
  const [servings, setServings] = useState(recipe.servings),
    [cook, setCook] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState("");
  const baseline = useRef(data);
  const match = evaluate(recipe, data, today, servings);
  const saved = personal.favorites.some((r) => r.id === recipe.id);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={recipe.name} close={close}>
      <RecipeArtwork recipe={recipe} hero />
      <p className="detail-description">{recipe.description}</p>
      <div className="recipe-meta">
        <span>
          <Clock size={16} />
          {recipe.time} min · {recipe.prepTime} prep + {recipe.cookTime} cook
        </span>
        <span>{recipe.difficulty}</span>
        {recipe.tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="detail-controls">
        <label>
          Servings
          <select
            aria-label="Servings"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 6, 8, 12].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          className="btn secondary"
          disabled={busy}
          aria-pressed={saved}
          onClick={() =>
            void run(() =>
              update((p) => ({
                ...p,
                favorites: saved
                  ? p.favorites.filter((r) => r.id !== recipe.id)
                  : [recipeSnapshot(recipe), ...p.favorites].slice(0, 200),
              })),
            )
          }
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
          {saved ? "Saved favorite" : "Save favorite"}
        </button>
      </div>
      {error && (
        <p className="banner danger" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="banner" role="status">
          {done}
        </p>
      )}
      <p className="recipe-state">
        {match.state}
        {match.verification.length
          ? ` · Check: ${match.verification.join(", ")}`
          : ""}
      </p>
      <p className="muted small">
        Pantry staples are assumptions, not measured stock. A piece, bag or pack
        is not silently converted into grams. Check labels and storage before
        cooking.
      </p>
      <h3>What you’ll need</h3>
      <ul className="ingredient-list">
        {match.checks.map((c) => (
          <li key={c.ingredient.name}>
            <span>
              <span
                className={c.status === "available" ? "ingredient-ok" : "muted"}
              >
                {c.status === "available" ? (
                  <Check size={15} />
                ) : (
                  <Plus size={15} />
                )}{" "}
                {c.ingredient.name}
              </span>
              <small className="ingredient-note">
                {c.note}
                {c.ingredient.form
                  ? ` Required form: ${c.ingredient.form}.`
                  : ""}
              </small>
            </span>
            <strong>{c.ingredient.amount}</strong>
          </li>
        ))}
      </ul>
      <button
        className="btn secondary full"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await commit(
              recipeShopping(data, match),
              match.missing.length
                ? "Missing ingredients added (duplicates checked)"
                : "No known shortfall; verify any uncertain ingredients",
            );
            setDone(
              match.missing.length
                ? "Shopping list updated. Compatible existing quantities cover the largest requested shortfall; repeated taps do not double it."
                : "Nothing added. Check any ingredients marked for verification.",
            );
          })
        }
      >
        <ShoppingBasket size={18} />
        Add missing ingredients to shopping
      </button>
      {photoFor(recipe.id) && (
        <p className="photo-credit">
          Photo:{" "}
          <a
            href={photoFor(recipe.id)!.source}
            target="_blank"
            rel="noreferrer"
          >
            {photoFor(recipe.id)!.credit}
          </a>
        </p>
      )}
      <h3>Let’s cook</h3>
      <p className="muted small">
        Quantities scale with servings. Use larger cookware or batches; cooking
        times are guides. Check temperature and doneness rather than multiplying
        the timer.
      </p>
      <ol className="steps">
        {recipe.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <details className="recipe-guidance">
        <summary>Allergens & substitutions</summary>
        <p>
          Known allergens:{" "}
          {recipe.allergens.length
            ? recipe.allergens.join(", ")
            : "none identified from the ingredient list"}
          . This is not an allergen-free guarantee; check every package and
          cross-contact risk.
        </p>
        {recipe.substitutions.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </details>
      <details className="recipe-guidance">
        <summary>Food safety & storage</summary>
        {recipe.safety.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </details>
      <button
        className="btn primary full"
        onClick={() => {
          baseline.current = structuredClone(data);
          setCook(!cook);
        }}
      >
        {cook ? "Hide inventory deduction" : "Cooked it? Update your inventory"}
      </button>
      {cook && (
        <form
          className="cook-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run(async () => {
              const amounts = Object.fromEntries(
                eligibleFoods(data, recipe, today).map((f) => [
                  f.id,
                  Number(fd.get(f.id) ?? 0),
                ]),
              );
              for (const [id, n] of Object.entries(amounts))
                if (
                  n > 0 &&
                  JSON.stringify(data.foods.find((f) => f.id === id)) !==
                    JSON.stringify(
                      baseline.current.foods.find((f) => f.id === id),
                    )
                )
                  throw Error(
                    "An ingredient changed while you were reviewing it. Reopen the quantity form.",
                  );
              await commit(
                confirmCooking(data, recipe, amounts, localDate()),
                "Cooking quantities recorded",
              );
              setCook(false);
              setDone(
                "Confirmed quantities were saved. Recording your meal history…",
              );
              await update((p) => ({
                ...p,
                history: [
                  {
                    recipe: recipeSnapshot(recipe),
                    date: new Date().toISOString(),
                    servings,
                  },
                  ...p.history,
                ].slice(0, 100),
              }));
              setCook(false);
              setDone("Meal recorded. Only confirmed amounts were deducted.");
            });
          }}
        >
          <h3>Confirm what you used</h3>
          <p className="muted">
            Nothing is deducted automatically. Enter actual amounts in your
            inventory units; leave zero for ingredients you did not use.
            Confirming also records this meal in your personal history.
          </p>
          {eligibleFoods(data, recipe, today).map((f) => (
            <label key={f.id}>
              {f.quantityUnknown
                ? `${f.name} (${foodAmount(f)}; record an amount in Inventory first)`
                : `${f.name} (${f.unit}, ${f.quantity} available)`}
              <input
                type="number"
                name={f.id}
                disabled={f.quantityUnknown}
                min="0"
                max={f.quantity}
                step="any"
                defaultValue="0"
              />
            </label>
          ))}
          <button className="btn primary" disabled={busy}>
            Confirm quantities used
          </button>
        </form>
      )}
    </Modal>
  );
}
