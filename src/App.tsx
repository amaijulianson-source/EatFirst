import {
  useEffect,
  useRef,
  useState,
  useId,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Leaf,
  LayoutDashboard,
  Refrigerator,
  ChefHat,
  ShoppingBasket,
  ChartNoAxesColumn,
  Settings,
  Plus,
  Search,
  ArrowRight,
  Clock,
  Check,
  X,
  Trash2,
  Pencil,
  Download,
  Upload,
  ShieldCheck,
  ArrowUpRight,
  Carrot,
  Milk,
  Wheat,
  Fish,
  Package,
  Flame,
  ChevronRight,
  Minus,
  CheckCheck,
  Info,
  Users,
} from "lucide-react";
import {
  addShopping,
  categories,
  consume,
  daysUntil,
  emptyData,
  eligible,
  localDate,
  locations,
  normalize,
  status,
  validateBackup,
  wasteStats,
  type Data,
  type Food,
  type Event,
  type Shopping,
} from "./core";
import { preserveBackup } from "./db";
import { kitchen } from "./family/store";
import { useKitchen } from "./family/useKitchen";
import { Family } from "./family/Family";
import { ShoppingView } from "./family/ShoppingView";
import { canonical } from "./family/changes";
import { matchRecipes, type Recipe } from "./recipes";
type Page =
  | "Today"
  | "Inventory"
  | "Recipes"
  | "Shopping"
  | "Waste"
  | "Settings"
  | "Privacy"
  | "Family";
const nav = [
  { name: "Today", icon: LayoutDashboard },
  { name: "Inventory", icon: Refrigerator },
  { name: "Recipes", icon: ChefHat },
  { name: "Shopping", icon: ShoppingBasket },
  { name: "Waste", icon: ChartNoAxesColumn },
] as const;
const iconFor = (c: string) =>
  c === "Produce"
    ? Carrot
    : c === "Dairy"
      ? Milk
      : c === "Meat & fish"
        ? Fish
        : c === "Bread & bakery"
          ? Wheat
          : Package;
function FoodIcon({ category }: { category: string }) {
  const Icon = iconFor(category);
  return (
    <span
      className={`food-icon ${category === "Produce" ? "sage" : category === "Dairy" ? "gold" : "peach"}`}
    >
      <Icon size={25} strokeWidth={1.6} />
    </span>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-btn" onClick={close} aria-label="Close dialog">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const family = useKitchen();
  const [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState<Page>(
      (location.hash.slice(1) as Page) || "Today",
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false),
    [food, setFood] = useState<Partial<Food> | null>(null),
    [transfer, setTransfer] = useState<string>(),
    [action, setAction] = useState<{ f: Food; kind: Event["action"] } | null>(
      null,
    ),
    [recipe, setRecipe] = useState<Recipe | null>(null),
    [cook, setCook] = useState(false),
    [confirm, setConfirm] = useState<{
      title: string;
      body: string;
      run: () => Promise<void>;
    } | null>(null),
    [pending, setPending] = useState<Data | null>(null),
    [query, setQuery] = useState(""),
    [storage, setStorage] = useState("All"),
    [category, setCategory] = useState("All"),
    [expiry, setExpiry] = useState("All"),
    [sort, setSort] = useState("expiry"),
    [recipeFilter, setRecipeFilter] = useState("All"),
    [now, setNow] = useState(localDate()),
    [undo, setUndo] = useState<Food | null>(null);
  const dataRef = useRef<Data | null>(null);
  const lock = useRef(false);
  const transferBaseline = useRef<Shopping | null>(null);
  const formScope = useRef<string>(family.household?.id ?? "local");
  useEffect(() => {
    const timer = setInterval(() => setNow(localDate()), 30000);
    const hash = () => setPage((location.hash.slice(1) as Page) || "Today");
    window.addEventListener("hashchange", hash);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (family.data) {
      dataRef.current = family.data;
      setData(family.data);
    }
  }, [family.data]);
  useEffect(() => {
    if (family.recovery) {
      setPage("Family");
      location.hash = "Family";
    }
  }, [family.recovery]);
  useEffect(() => {
    const t = data?.settings.theme;
    document.documentElement.dataset.theme =
      t === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : (t ?? "light");
    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = () => {
      if (t === "system")
        document.documentElement.dataset.theme = media.matches
          ? "dark"
          : "light";
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [data?.settings.theme]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  async function commit(
    next: Data,
    message = "Saved on this device",
    optimistic = false,
  ) {
    if (
      (kitchen.getSnapshot().household?.id ?? "local") !==
      (family.household?.id ?? "local")
    )
      throw Error(
        "The active kitchen changed. Reopen this action in the intended kitchen.",
      );
    if (lock.current) throw Error("A save is in progress. Please try again.");
    lock.current = true;
    setUndo(null);
    setSaving(true);
    if (optimistic) setData(next);
    try {
      await kitchen.save(next, message, data ?? undefined);
      dataRef.current = next;
      setData(next);
      setNotice(
        family.household && message === "Saved on this device"
          ? "Saved to this device’s family queue"
          : message,
      );
    } catch (e) {
      if (optimistic) setData(dataRef.current);
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your change was not applied. Check Family or browser storage.",
      );
      throw e;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  function go(p: Page) {
    setPage(p);
    location.hash = p;
    window.scrollTo(0, 0);
  }
  if (!data)
    return (
      <div className="loading">
        <Leaf size={42} />
        <h1>EatFirst</h1>
        {error || family.error ? (
          <p role="alert">{error || family.error}</p>
        ) : (
          <>
            <p>Making room for good food…</p>
            <div className="skeleton" />
          </>
        )}
      </div>
    );
  const d = data;
  const meals = matchRecipes(d, now),
    soon = d.foods
      .filter((f) => daysUntil(f, now) >= 0 && daysUntil(f, now) <= 3)
      .sort((a, b) => daysUntil(a, now) - daysUntil(b, now)),
    past = d.foods.filter((f) => daysUntil(f, now) < 0),
    today = d.foods.filter((f) => daysUntil(f, now) === 0),
    recent = [...d.foods]
      .reverse()
      .sort((a, b) => b.added.localeCompare(a.added))
      .slice(0, 4),
    waste = wasteStats(d.events, now);
  const filtered = d.foods
    .filter(
      (f) =>
        (!query || f.name.toLowerCase().includes(query.toLowerCase())) &&
        (storage === "All" || f.location === storage) &&
        (category === "All" || f.category === category) &&
        (expiry === "All" ||
          (expiry === "Due soon"
            ? daysUntil(f, now) >= 0 && daysUntil(f, now) <= 3
            : status(f, now) === expiry)),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "recent"
          ? b.added.localeCompare(a.added) ||
            d.foods.indexOf(b) - d.foods.indexOf(a)
          : daysUntil(a, now) - daysUntil(b, now),
    );
  const money = (v: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: d.settings.currency,
    }).format(v);
  function newFood() {
    formScope.current = family.household?.id ?? "local";
    setTransfer(undefined);
    setFood({});
  }
  async function remove(f: Food) {
    const before = dataRef.current!;
    await commit(
      { ...before, foods: before.foods.filter((x) => x.id !== f.id) },
      `${f.name} removed`,
    );
    setUndo(f);
  }
  function foodRow(f: Food) {
    const s = status(f, now);
    return (
      <div className="food-row" key={f.id}>
        <FoodIcon category={f.category} />
        <button
          className="food-main"
          onClick={() => {
            setTransfer(undefined);
            formScope.current = family.household?.id ?? "local";
            setFood(f);
          }}
        >
          <strong>{f.name}</strong>
          <span>
            {f.quantity} {f.unit} <i>·</i> {f.location}
          </span>
        </button>
        <div className="food-date">
          <span
            className={`badge ${daysUntil(f, now) < 0 ? "danger" : daysUntil(f, now) <= 1 ? "warning" : ""}`}
          >
            {s}
          </span>
          <small>
            {f.dateType === "use-by" ? "Use-by" : "Best-before"}
            {f.expiry
              ? ` · ${new Date(`${f.expiry}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
              : ""}
          </small>
        </div>
        <div className="row-actions">
          <button
            className="icon-btn"
            aria-label={`Mark ${f.name} eaten`}
            title="Mark eaten"
            onClick={() => setAction({ f, kind: "eaten" })}
          >
            <Check size={19} />
          </button>
          <button
            className="icon-btn"
            aria-label={`More options for ${f.name}`}
            title="Edit and more"
            onClick={() => {
              setTransfer(undefined);
              formScope.current = family.household?.id ?? "local";
              setFood(f);
            }}
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>
    );
  }
  function recipeCard(r: (typeof meals)[number]) {
    return (
      <button
        className="recipe-card"
        key={r.id}
        onClick={() => {
          setRecipe(r);
          setCook(false);
        }}
      >
        <div className={`recipe-art ${r.color}`}>
          <span className="plate">
            <ChefHat size={42} strokeWidth={1.25} />
          </span>
          <span className="time">
            <Clock size={13} /> {r.time} min
          </span>
          <span className="art-leaf leaf-one" />
          <span className="art-leaf leaf-two" />
        </div>
        <div className="recipe-card-body">
          <span
            className={`recipe-match ${r.missing.length === 0 ? "ready" : ""}`}
          >
            {r.missing.length === 0 ? (
              <>
                <Check size={14} /> I can make this
              </>
            ) : r.missing.length <= 2 ? (
              `Almost ready · missing ${r.missing.length}`
            ) : (
              `${r.available} of ${r.ingredients.length} ingredients available`
            )}
          </span>
          <h3>{r.name}</h3>
          <p>{r.description}</p>
          <div className="card-foot">
            <span>
              {r.urgent
                ? `Uses ${r.urgent} ingredient${r.urgent > 1 ? "s" : ""} due soon`
                : `${r.difficulty} · ${r.tags[0] ?? "Everyday"}`}
            </span>
            <ArrowUpRight size={18} />
          </div>
        </div>
      </button>
    );
  }
  function empty(
    title: string,
    body: string,
    button?: string,
    run?: () => void,
  ) {
    return (
      <div className="empty">
        <span className="empty-icon">
          <Leaf size={30} />
        </span>
        <h3>{title}</h3>
        <p>{body}</p>
        {button && (
          <button className="btn primary" onClick={run}>
            <Plus size={17} />
            {button}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => go("Today")}>
          <span className="brand-mark">
            <Leaf size={25} />
          </span>
          EatFirst<span className="brand-dot">.</span>
        </button>
        <div className="nav-label">YOUR EVERYDAY KITCHEN</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? "active" : ""}
              onClick={() => go(n.name)}
            >
              <n.icon size={21} />
              <span>{n.name}</span>
              {n.name === "Inventory" && <small>{d.foods.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="settings-link" onClick={() => go("Family")}>
            <Users size={20} />
            Family & sync
          </button>
          <div className="local-note">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {family.household
                  ? "Your family kitchen"
                  : "Just you & your kitchen"}
              </strong>
              <p>
                {family.household
                  ? "Private to household members."
                  : "Private. Local. No account needed."}
              </p>
            </div>
          </div>
          <button
            className={
              page === "Settings" ? "active settings-link" : "settings-link"
            }
            onClick={() => go("Settings")}
          >
            <Settings size={20} />
            Settings & backup
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Your kitchen <ChevronRight size={14} /> <strong>{page}</strong>
          </span>
          <button className="mobile-brand" onClick={() => go("Today")}>
            <Leaf size={22} />
            EatFirst.
          </button>
          <div className="top-actions">
            <button
              className="icon-btn"
              aria-label="Family"
              onClick={() => go("Family")}
            >
              <Users size={21} />
            </button>
            <span className="device-dot" />
            <span className="local-label" role="status">
              {saving
                ? "Saving…"
                : family.household
                  ? `${family.state} · ${family.pending} pending`
                  : "Saved on this device"}
            </span>
            <button
              className="icon-btn"
              aria-label="Settings"
              onClick={() => go("Settings")}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>
        <main id="main">
          <a
            className="skip"
            href="#page-content"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("page-content")?.focus();
            }}
          >
            Skip to content
          </a>
          <div id="page-content" tabIndex={-1} />
          {family.readOnly && (
            <div className="banner danger">
              Another EatFirst tab is editing on this device. Use that tab, or
              close it and reload this one before editing.
            </div>
          )}
          {family.household && (
            <div
              className={`banner ${family.state === "conflict" || family.state === "locked" ? "danger" : ""}`}
            >
              <Users size={18} />
              <div>
                <strong>{family.household.name}</strong> · {family.state} ·{" "}
                {family.pending} pending{family.error && <p>{family.error}</p>}
              </div>
              <button onClick={() => go("Family")}>Family & sync</button>
            </div>
          )}
          {d.demo && (
            <div className="banner">
              Sample data mode · Your changes stay on this device.
              <button
                onClick={() =>
                  setConfirm({
                    title: "Reset sample data?",
                    body: "This removes all sample-mode inventory, shopping and history. Export first if you want to keep changes.",
                    run: async () => {
                      await commit(emptyData());
                    },
                  })
                }
              >
                Reset demo
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="banner danger">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {page === "Today" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {new Date().getHours() < 12
                      ? "GOOD MORNING"
                      : new Date().getHours() < 18
                        ? "GOOD AFTERNOON"
                        : "GOOD EVENING"}
                    . MAKE GOOD FOOD GO FURTHER.
                  </p>
                  <h1>
                    Good food, better days<span className="green">.</span>
                  </h1>
                  <p>
                    You have <strong>{d.foods.length} items</strong> in your
                    kitchen. Let’s make them count.
                  </p>
                </div>
                <button className="btn primary" onClick={newFood}>
                  <Plus size={19} /> Add food
                </button>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <Leaf size={14} /> SMALL HABITS, FRESH STARTS
                  </span>
                  <h2>
                    Good things are
                    <br />
                    already in your kitchen.
                  </h2>
                  <p>
                    A little planning goes a long way. Start with what you have,
                    and make something delicious.
                  </p>
                  <button
                    className="btn hero-btn"
                    onClick={() => go("Recipes")}
                  >
                    Find something to cook <ArrowRight size={17} />
                  </button>
                </div>
                <div className="hero-illustration" aria-hidden="true">
                  <div className="halo" />
                  <div className="bowl">
                    <span className="veg v1" />
                    <span className="veg v2" />
                    <span className="veg v3" />
                    <span className="tomato t1" />
                    <span className="tomato t2" />
                    <span className="cucumber c1" />
                    <span className="cucumber c2" />
                    <span className="cucumber c3" />
                    <span className="egg-shape" />
                  </div>
                  <span className="floating-note">
                    <Leaf size={16} /> Every ingredient matters
                  </span>
                  <span className="sprig s1" />
                  <span className="sprig s2" />
                </div>
              </section>
              <div className="stats">
                <button
                  onClick={() => {
                    setExpiry("Today");
                    go("Inventory");
                  }}
                >
                  <span className="stat-icon peach">
                    <Clock />
                  </span>
                  <div>
                    <strong>
                      {today.length}
                      <small>items</small>
                    </strong>
                    <span>Expiring today</span>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
                <button
                  onClick={() => {
                    setExpiry("Due soon");
                    go("Inventory");
                  }}
                >
                  <span className="stat-icon gold">
                    <Flame />
                  </span>
                  <div>
                    <strong>
                      {soon.length}
                      <small>items</small>
                    </strong>
                    <span>Due today to 3 days</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setRecipeFilter("Ready");
                    go("Recipes");
                  }}
                >
                  <span className="stat-icon sage">
                    <ChefHat />
                  </span>
                  <div>
                    <strong>
                      {meals.filter((r) => !r.missing.length).length}
                      <small>recipes</small>
                    </strong>
                    <span>Ready with what you have</span>
                  </div>
                </button>
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        A LITTLE ATTENTION GOES A LONG WAY
                      </span>
                      <h2>Eat these first</h2>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => go("Inventory")}
                    >
                      View all <ArrowRight size={15} />
                    </button>
                  </div>
                  {soon.length
                    ? soon.slice(0, 4).map(foodRow)
                    : empty(
                        "A fresh start for your kitchen",
                        "Add a few groceries and we’ll bring the ones due soon to the top.",
                        "Add your first food",
                        newFood,
                      )}
                  {past.length > 0 && (
                    <button
                      className="safety-note"
                      onClick={() => {
                        setExpiry("All");
                        go("Inventory");
                      }}
                    >
                      <Info size={18} />
                      {past.length} item(s) past their date. Review separately
                      before planning meals.
                      <ChevronRight size={18} />
                    </button>
                  )}
                </section>
                <section className="panel recent">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">FRESHLY UNPACKED</span>
                      <h2>Recently added</h2>
                    </div>
                    <ShoppingBasket size={23} />
                  </div>
                  {recent.length ? (
                    recent.map((f) => (
                      <button
                        className="recent-row"
                        key={f.id}
                        onClick={() => {
                          setTransfer(undefined);
                          formScope.current = family.household?.id ?? "local";
                          setFood(f);
                        }}
                      >
                        <FoodIcon category={f.category} />
                        <div>
                          <strong>{f.name}</strong>
                          <small>
                            {f.quantity} {f.unit} · {f.location}
                          </small>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))
                  ) : (
                    <p className="muted recent-empty">
                      Your next grocery haul starts here. Add food as you unpack
                      to keep everything in view.
                    </p>
                  )}
                  <button className="add-dashed" onClick={newFood}>
                    <Plus size={16} /> Quickly add a grocery
                  </button>
                </section>
              </div>
              <section className="meal-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">LESS “WHAT’S FOR DINNER?”</span>
                    <h2>A little kitchen inspiration</h2>
                    <p>Simple meals, inspired by what’s already there.</p>
                  </div>
                  <button className="text-btn" onClick={() => go("Recipes")}>
                    Explore recipes <ArrowRight size={16} />
                  </button>
                </div>
                <div className="recipe-grid">
                  {meals.slice(0, 3).map(recipeCard)}
                </div>
              </section>
              <div className="footer-note">
                <Leaf size={16} /> Make good food go further. One small choice
                at a time.
              </div>
            </>
          )}
          {page === "Inventory" && (
            <>
              <PageHeading
                title="Your kitchen, at a glance."
                sub="Know what you have. Enjoy it while it’s at its best."
                action={
                  <button className="btn primary" onClick={newFood}>
                    <Plus size={18} /> Add food
                  </button>
                }
              />
              <div className="filter-panel">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Search inventory"
                    placeholder="Find something in your kitchen…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="chips">
                  {["All", ...locations].map((l) => (
                    <button
                      key={l}
                      className={storage === l ? "selected" : ""}
                      onClick={() => setStorage(l)}
                    >
                      {l === "All" ? "All locations" : l}
                    </button>
                  ))}
                </div>
                <div className="filter-selects">
                  <label>
                    Category
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {["All", ...categories].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Expiry
                    <select
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                    >
                      {[
                        "All",
                        "Due soon",
                        "Past use-by",
                        "Past best-before",
                        "Today",
                        "Tomorrow",
                        "Next 3 days",
                        "Later",
                        "No date",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sort by
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="expiry">Expiry date</option>
                      <option value="name">Name A–Z</option>
                      <option value="recent">Recently added</option>
                    </select>
                  </label>
                </div>
              </div>
              <p className="muted">
                {filtered.length} item{filtered.length !== 1 ? "s" : ""} · Tap
                an item to edit, adjust or discard.
              </p>
              <section className="panel inventory-list">
                {filtered.length
                  ? filtered.map(foodRow)
                  : empty(
                      d.foods.length
                        ? "No groceries match"
                        : "Your kitchen starts here",
                      d.foods.length
                        ? "Try a different search or filter."
                        : "Add your first grocery. A name is all you need to get started.",
                      "Add food",
                      newFood,
                    )}
              </section>
              <Safety />
            </>
          )}
          {page === "Recipes" && (
            <>
              <PageHeading
                title="Something good is cooking."
                sub="Everyday recipes. Real ingredients. No extra guesswork."
              />
              <div className="banner">
                <Info size={18} />
                Matches include your pantry assumptions. Quantities are a guide,
                so check what you have before cooking.
                <button onClick={() => go("Settings")}>Edit staples</button>
              </div>
              <div className="chips recipe-chips">
                {["All", "Ready", "Almost ready"].map((f) => (
                  <button
                    className={recipeFilter === f ? "selected" : ""}
                    key={f}
                    onClick={() => setRecipeFilter(f)}
                  >
                    {f === "Ready" ? "I can make this" : f}
                  </button>
                ))}
              </div>
              <div className="recipe-grid">
                {meals
                  .filter(
                    (r) =>
                      recipeFilter === "All" ||
                      (recipeFilter === "Ready"
                        ? r.missing.length === 0
                        : r.missing.length > 0 && r.missing.length <= 2),
                  )
                  .map(recipeCard)}
              </div>
              {!meals.filter(
                (r) =>
                  recipeFilter === "All" ||
                  (recipeFilter === "Ready"
                    ? r.missing.length === 0
                    : r.missing.length > 0 && r.missing.length <= 2),
              ).length &&
                empty(
                  "A few ingredients away",
                  "Add groceries or update your pantry staples to find more matches.",
                )}
              <Safety />
            </>
          )}
          {page === "Shopping" && (
            <ShoppingView
              data={d}
              saving={saving}
              commit={commit}
              putAway={(s) => {
                setTransfer(s.id);
                transferBaseline.current = structuredClone(s);
                formScope.current = family.household?.id ?? "local";
                setFood({ name: s.name, category: s.category });
              }}
            />
          )}
          {page === "Family" && <Family />}
          {page === "Waste" && (
            <>
              <PageHeading
                title="Small changes, less waste."
                sub="A gentle look at what gets left behind. No guilt, just insight."
              />
              <div className="stats waste-stats">
                <div>
                  <span className="stat-icon peach">
                    <Trash2 />
                  </span>
                  <div>
                    <strong>{waste.week}</strong>
                    <span>Discard entries this week</span>
                  </div>
                </div>
                <div>
                  <span className="stat-icon gold">
                    <ChartNoAxesColumn />
                  </span>
                  <div>
                    <strong>{waste.month}</strong>
                    <span>Discard entries this month</span>
                  </div>
                </div>
                {waste.priced.length > 0 && (
                  <div>
                    <span className="stat-icon sage">
                      <span>$</span>
                    </span>
                    <div>
                      <strong>{money(waste.value)}</strong>
                      <span>Recorded waste value · all time</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="dashboard-grid">
                <section className="panel padded">
                  <h2>Waste over time</h2>
                  <p className="muted">
                    Discard entries per month · last 6 months
                  </p>
                  <div
                    className="chart"
                    role="img"
                    aria-label="Monthly discarded items chart"
                  >
                    {Array.from({ length: 6 }, (_, i) => {
                      const date = new Date(`${now}T12:00:00`);
                      date.setDate(1);
                      date.setMonth(date.getMonth() - 5 + i);
                      const prefix = localDate(date).slice(0, 7);
                      const count = waste.discarded.filter((e) =>
                        e.date.startsWith(prefix),
                      ).length;
                      const max = Math.max(
                        1,
                        ...Array.from({ length: 6 }, (_, j) => {
                          const dt = new Date(`${now}T12:00:00`);
                          dt.setDate(1);
                          dt.setMonth(dt.getMonth() - j);
                          return waste.discarded.filter((e) =>
                            e.date.startsWith(localDate(dt).slice(0, 7)),
                          ).length;
                        }),
                      );
                      return (
                        <div key={prefix} className="chart-col">
                          <strong>{count}</strong>
                          <div
                            style={{
                              height: `${Math.max(3, (count / max) * 130)}px`,
                            }}
                          />
                          <small>
                            {date.toLocaleDateString(undefined, {
                              month: "short",
                            })}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="panel padded">
                  <h2>Where to focus</h2>
                  <p className="muted">Categories discarded most · all time</p>
                  {waste.discarded.length ? (
                    categories
                      .map((c) => ({
                        name: c,
                        count: waste.discarded.filter(
                          (e) => e.food.category === c,
                        ).length,
                      }))
                      .filter((c) => c.count)
                      .sort((a, b) => b.count - a.count)
                      .map((c) => (
                        <div className="category-bar" key={c.name}>
                          <span>{c.name}</span>
                          <strong>{c.count}</strong>
                          <div
                            style={{
                              width: `${(c.count / waste.discarded.length) * 100}%`,
                            }}
                          />
                        </div>
                      ))
                  ) : (
                    <p className="muted">
                      Category insights will appear when you record discarded
                      food.
                    </p>
                  )}
                </section>
              </div>
              <section className="panel padded">
                <h2>Discard history</h2>
                {waste.discarded.length
                  ? [...waste.discarded].reverse().map((e) => (
                      <div className="history-row" key={e.id}>
                        <FoodIcon category={e.food.category} />
                        <div>
                          <strong>{e.food.name}</strong>
                          <small>
                            {e.amount} {e.food.unit} · {e.date}
                          </small>
                        </div>
                        {e.value !== undefined && <span>{money(e.value)}</span>}
                      </div>
                    ))
                  : empty(
                      "Nothing discarded yet",
                      "When food does go to waste, record it from your inventory. Your patterns will appear here.",
                    )}
              </section>
              <p className="muted">
                Counts reflect discard events, not comparable weights. Financial
                totals include only entries with an estimated value; they do not
                represent savings.
              </p>
            </>
          )}
          {page === "Settings" && (
            <>
              <PageHeading
                title="Your kitchen, your way."
                sub="A few preferences to make EatFirst feel like home."
              />
              <div className="settings-grid">
                <section className="panel padded">
                  <h2>Make it yours</h2>
                  <label>
                    Appearance
                    <select
                      value={d.settings.theme}
                      onChange={async (e) => {
                        await commit({
                          ...d,
                          settings: {
                            ...d.settings,
                            theme: e.target.value as Data["settings"]["theme"],
                          },
                        });
                      }}
                    >
                      <option value="system">Follow device</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                  <label>
                    Currency for estimated values
                    <select
                      value={d.settings.currency}
                      onChange={async (e) => {
                        await commit({
                          ...d,
                          settings: { ...d.settings, currency: e.target.value },
                        });
                      }}
                    >
                      {["USD", "GBP", "EUR", "CAD", "AUD"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <p className="muted">
                    Changing currency relabels recorded amounts; it does not
                    convert them.
                  </p>
                  <h3>Dietary preferences</h3>
                  <p className="muted">
                    Filter recipes by reliable tags. Always check ingredient
                    labels for allergens.
                  </p>
                  {["vegetarian", "vegan", "gluten-free"].map((t) => (
                    <label className="check-label" key={t}>
                      <input
                        type="checkbox"
                        checked={d.settings.diet.includes(t)}
                        onChange={async (e) => {
                          await commit({
                            ...d,
                            settings: {
                              ...d.settings,
                              diet: e.target.checked
                                ? [...d.settings.diet, t]
                                : d.settings.diet.filter((x) => x !== t),
                            },
                          });
                        }}
                      />
                      {t}
                    </label>
                  ))}
                </section>
                <section className="panel padded">
                  <h2>Your pantry assumptions</h2>
                  <p className="muted">
                    Recipes treat these ingredients as available. Only include
                    what you usually keep stocked.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const v = new FormData(e.currentTarget);
                      await commit({
                        ...d,
                        settings: {
                          ...d.settings,
                          staples: [
                            ...new Set(
                              String(v.get("staples"))
                                .split(",")
                                .map((x) => x.trim().toLowerCase())
                                .filter(Boolean),
                            ),
                          ],
                        },
                      });
                    }}
                  >
                    <label>
                      Staples, separated by commas
                      <textarea
                        name="staples"
                        defaultValue={d.settings.staples.join(", ")}
                        rows={4}
                        maxLength={2000}
                      />
                    </label>
                    <button className="btn primary">Save staples</button>
                  </form>
                  <div className="mini-tip">
                    <Leaf size={23} />
                    <p>
                      Keep your pantry honest. Removing a staple makes it show
                      up as a missing ingredient.
                    </p>
                  </div>
                </section>
                <section className="panel padded">
                  <h2>Keep a copy</h2>
                  <p>
                    Local mode stays in this browser. A selected family kitchen
                    is shared through Supabase and cached here. Export backups
                    regularly; pending changes and preserved backups can be lost
                    if browser data is cleared.
                  </p>
                  <div className="button-stack">
                    <button
                      className="btn secondary"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(d, null, 2)], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `eatfirst-backup-${now}.json`;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        setNotice("Backup exported");
                      }}
                    >
                      <Download size={18} />
                      Export JSON backup
                    </button>
                    <label className="btn secondary file-label">
                      <Upload size={18} />
                      Import backup
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            if (file.size > 10000000)
                              throw Error(
                                "Backup is too large (10 MB maximum).",
                              );
                            setPending(
                              validateBackup(JSON.parse(await file.text())),
                            );
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Invalid backup",
                            );
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </section>
                <section className="panel padded">
                  <h2>A fresh start</h2>
                  <p className="muted">
                    Try sample groceries in a clearly labelled mode, or clear
                    this kitchen.
                  </p>
                  <button
                    className="btn secondary"
                    disabled={
                      Boolean(family.household) ||
                      d.foods.length > 0 ||
                      d.events.length > 0 ||
                      d.shopping.length > 0
                    }
                    onClick={async () => {
                      const date = (n: number) => {
                        const t = new Date(`${now}T12:00:00`);
                        t.setDate(t.getDate() + n);
                        return localDate(t);
                      };
                      const foods = [
                        ["Spinach", 1, "bag", "Produce", 0],
                        ["Eggs", 6, "pieces", "Dairy", 2],
                        ["Tomatoes", 4, "pieces", "Produce", 1],
                        ["Bread", 1, "loaf", "Bread & bakery", 3],
                        ["Cheese", 200, "g", "Dairy", 7],
                        ["Milk", 1, "litre", "Dairy", 4],
                      ].map(
                        ([name, quantity, unit, category, days]) =>
                          ({
                            id: crypto.randomUUID(),
                            name,
                            quantity,
                            unit,
                            category,
                            location: "Fridge",
                            added: now,
                            expiry: date(Number(days)),
                            dateType: "best-before",
                            notes: "",
                          }) as Food,
                      );
                      await commit(
                        { ...d, foods, demo: true },
                        "Sample mode loaded",
                      );
                      go("Today");
                    }}
                  >
                    Try sample kitchen
                  </button>
                  <p className="muted small">
                    Sample mode is available only when your kitchen, shopping
                    list and history are empty.
                  </p>
                  <button
                    disabled={Boolean(family.household)}
                    className="btn danger-outline"
                    onClick={() =>
                      setConfirm({
                        title: "Delete this device’s local kitchen?",
                        body: "This permanently removes inventory, shopping, activity, and settings from this browser. Export a backup first if you need one.",
                        run: async () => {
                          await commit(emptyData(), "Local data deleted");
                          setUndo(null);
                        },
                      })
                    }
                  >
                    <Trash2 size={17} />
                    Delete all data
                  </button>
                </section>
              </div>
              <button className="text-btn" onClick={() => go("Privacy")}>
                <ShieldCheck size={18} />
                Privacy & local storage
              </button>
              <p className="muted">
                EatFirst v2.0 preview · Offline after your first successful
                load. Install from your browser’s menu when supported. Expiry
                reminders are shown when you open the app; there are no
                background notifications.
              </p>
            </>
          )}
          {page === "Privacy" && (
            <>
              <PageHeading
                title="A private little kitchen."
                sub="Local by default. Share with your household when you choose."
              />
              <section className="panel padded prose">
                <h2>What we store</h2>
                <p>
                  EatFirst stores inventory, shopping lists, activity, and
                  preferences locally. When you opt into a family household,
                  Supabase stores your account and shared groceries, shopping
                  list, activity and preferences. Other household members can
                  read and edit that household. The app has no advertising or
                  analytics.
                </p>
                <h2>Your device is your data</h2>
                <p>
                  Anyone with access to this browser profile may be able to see
                  your data. Browser storage is not an encrypted vault. Backups
                  are plain JSON files; keep them somewhere private.
                </p>
                <h2>Offline and updates</h2>
                <p>
                  The app caches its own files for offline use after an initial
                  successful load. Your host may receive normal requests for
                  these application files. Family mode synchronizes with
                  Supabase; local mode does not. Clearing site data, private
                  browsing, storage eviction, or changing browsers may remove
                  your records.
                </p>
                <h2>You’re in control</h2>
                <p>
                  Export and restore from Settings. Import replaces the current
                  kitchen after your confirmation. Delete all local data from
                  Settings. Your browser can also remove cached application
                  files.
                </p>
                <Safety />
              </section>
            </>
          )}
          {![
            "Today",
            "Inventory",
            "Recipes",
            "Shopping",
            "Waste",
            "Settings",
            "Privacy",
            "Family",
          ].includes(page) &&
            empty(
              "This page wandered off",
              "Head back to your kitchen.",
              "Go to Today",
              () => go("Today"),
            )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <button
            key={n.name}
            className={page === n.name ? "active" : ""}
            onClick={() => go(n.name)}
          >
            <n.icon size={21} />
            <span>{n.name}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          {notice}
          {undo && (
            <button
              onClick={async () => {
                const current = dataRef.current!;
                if (current.foods.some((f) => f.id === undo.id))
                  throw Error(
                    "This item is already present. It was not overwritten.",
                  );
                await commit(
                  { ...current, foods: [...current.foods, undo] },
                  "Removal undone",
                );
                setUndo(null);
              }}
            >
              Undo
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => {
              setNotice("");
              setUndo(null);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {food && (
        <FoodForm
          food={food}
          currency={d.settings.currency}
          close={() => {
            setFood(null);
            setTransfer(undefined);
          }}
          save={async (f, again) => {
            const current = dataRef.current!;
            if (formScope.current !== (family.household?.id ?? "local"))
              throw Error(
                "Your active kitchen changed. Close this form and open it in the intended kitchen.",
              );
            if (
              food.id &&
              canonical(current.foods.find((x) => x.id === food.id)) !==
                canonical(food)
            )
              throw Error(
                "This item changed while you were editing. Close it and reopen the latest version; your current form was not saved.",
              );
            if (
              transfer &&
              canonical(current.shopping.find((s) => s.id === transfer)) !==
                canonical(transferBaseline.current)
            )
              throw Error(
                "That shopping item was already put away or removed. Close this form to see the shared kitchen.",
              );
            await commit(
              {
                ...current,
                foods: current.foods.some((x) => x.id === f.id)
                  ? current.foods.map((x) => (x.id === f.id ? f : x))
                  : [...current.foods, f],
                shopping: transfer
                  ? current.shopping.filter((s) => s.id !== transfer)
                  : current.shopping,
              },
              `${f.name} saved`,
            );
            setTransfer(undefined);
            setFood(again ? {} : null);
          }}
          remove={
            food.id
              ? () => {
                  const f = food as Food;
                  setFood(null);
                  setConfirm({
                    title: `Remove ${f.name}?`,
                    body: "Remove it from inventory without recording waste. Use “Discard” to track food waste instead.",
                    run: async () => remove(f),
                  });
                }
              : undefined
          }
          act={
            food.id
              ? (kind) => {
                  setFood(null);
                  setAction({ f: food as Food, kind });
                }
              : undefined
          }
        />
      )}
      {action && (
        <Modal
          title={`${action.kind === "discarded" ? "Discard" : action.kind === "used" ? "Use" : "Eat"} ${action.f.name}`}
          close={() => setAction(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await commit(
                  consume(
                    dataRef.current!,
                    action.f.id,
                    Number(fd.get("amount")),
                    action.kind,
                  ),
                  action.kind === "discarded"
                    ? "Discard recorded"
                    : "Enjoyed & recorded",
                );
                setAction(null);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not update",
                );
              }
            }}
          >
            <p className="muted">
              {action.f.quantity} {action.f.unit} remaining. Partial amounts
              keep the rest in your inventory.
            </p>
            {daysUntil(action.f, now) < 0 && action.kind !== "discarded" && (
              <Safety />
            )}
            <label>
              Amount ({action.f.unit})
              <input
                name="amount"
                type="number"
                min="0.001"
                max={action.f.quantity}
                step="any"
                defaultValue={action.f.quantity}
                required
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={saving}>
                Confirm {action.kind}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {recipe && (
        <Modal
          title={recipe.name}
          close={() => {
            setRecipe(null);
            setCook(false);
          }}
        >
          <p>{recipe.description}</p>
          <div className="recipe-meta">
            <span>
              <Clock size={16} />
              {recipe.time} min
            </span>
            <span>{recipe.difficulty}</span>
            {recipe.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <p className="muted">
            About 2 portions unless noted. Check quantities, labels and dietary
            needs. Staples are assumptions, not verified inventory.
          </p>
          <h3>What you’ll need</h3>
          <ul className="ingredient-list">
            {recipe.ingredients.map((i) => {
              const ok =
                d.settings.staples.some(
                  (s) => normalize(s) === normalize(i.name),
                ) ||
                d.foods.some(
                  (f) =>
                    eligible(f, now) && normalize(f.name) === normalize(i.name),
                );
              return (
                <li key={i.name}>
                  <span className={ok ? "ingredient-ok" : "muted"}>
                    {ok ? <Check size={16} /> : <Plus size={16} />} {i.name}
                  </span>
                  <span>
                    {i.amount}
                    {!ok && <small> · missing</small>}
                  </span>
                </li>
              );
            })}
          </ul>
          <button
            className="btn secondary full"
            onClick={async () => {
              const missing =
                matchRecipes(dataRef.current!, now).find(
                  (r) => r.id === recipe.id,
                )?.missing ?? [];
              await commit(
                addShopping(
                  dataRef.current!,
                  missing.map((i) => i.name),
                ),
                missing.length
                  ? "Missing ingredients added (duplicates skipped)"
                  : "You have all listed ingredients",
              );
            }}
          >
            {" "}
            <ShoppingBasket size={18} />
            Add missing ingredients to shopping
          </button>
          <h3>Let’s cook</h3>
          <ol className="steps">
            {recipe.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <Safety />
          <button className="btn primary full" onClick={() => setCook(!cook)}>
            <Check size={18} />
            {cook
              ? "Hide inventory deduction"
              : "Cooked it? Update your inventory"}
          </button>
          {cook && (
            <form
              className="cook-form"
              onSubmit={async (e) => {
                e.preventDefault();
                let next = dataRef.current!;
                const fd = new FormData(e.currentTarget);
                try {
                  for (const f of next.foods) {
                    const amount = Number(fd.get(f.id));
                    if (amount > 0) next = consume(next, f.id, amount, "used");
                  }
                  await commit(next, "Cooking quantities recorded");
                  setCook(false);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Invalid quantity",
                  );
                }
              }}
            >
              <h3>Confirm what you used</h3>
              <p className="muted">
                No automatic deductions. Enter amounts in your inventory’s
                units. Start at zero and adjust only what you actually used.
              </p>
              {d.foods
                .filter(
                  (f) =>
                    eligible(f, now) &&
                    recipe.ingredients.some(
                      (i) => normalize(i.name) === normalize(f.name),
                    ),
                )
                .map((f) => (
                  <label key={f.id}>
                    {f.name} ({f.unit}, {f.quantity} available)
                    <input
                      type="number"
                      name={f.id}
                      min="0"
                      max={f.quantity}
                      step="any"
                      defaultValue="0"
                    />
                  </label>
                ))}
              <button className="btn primary" disabled={saving}>
                Confirm quantities used
              </button>
            </form>
          )}
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} close={() => setConfirm(null)}>
          <p>{confirm.body}</p>
          <div className="form-actions">
            <button className="btn secondary" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={saving}
              onClick={async () => {
                await confirm.run();
                setConfirm(null);
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
      {pending && (
        <Modal title="Replace your kitchen?" close={() => setPending(null)}>
          <p>
            This validated backup contains {pending.foods.length} groceries,{" "}
            {pending.shopping.length} shopping items and {pending.events.length}{" "}
            activity entries. Import replaces the current kitchen and settings.
            In Family mode it replaces the shared household data for everyone. A
            local backup is preserved first. Export your current data first if
            needed.
          </p>
          <div className="form-actions">
            <button className="btn secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={saving}
              onClick={async () => {
                await preserveBackup(
                  dataRef.current!,
                  "Before confirmed backup replacement",
                  family.session?.user.id,
                );
                await commit(pending, "Backup restored");
                setPending(null);
                setUndo(null);
              }}
            >
              Replace & restore
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function PageHeading({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">MAKE GOOD FOOD GO FURTHER</p>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}
function Safety() {
  return (
    <div className="safety-note">
      <Info size={19} />
      <p>
        <strong>Dates mean different things.</strong> Use-by is a safety
        deadline: don’t eat food after it. Best-before is about quality, not a
        guarantee of safety. Past best-before items are excluded from recipe
        matches. Follow storage instructions and local food-safety guidance.
      </p>
    </div>
  );
}
function FoodForm({
  food,
  currency,
  close,
  save,
  remove,
  act,
}: {
  food: Partial<Food>;
  currency: string;
  close: () => void;
  save: (f: Food, again: boolean) => Promise<void>;
  remove?: () => void;
  act?: (kind: Event["action"]) => void;
}) {
  const [more, setMore] = useState(!!food.id),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const again =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "again";
    const value = String(fd.get("value") ?? "");
    const f: Food = {
      id: food.id ?? crypto.randomUUID(),
      name: String(fd.get("name")).trim(),
      quantity: Number(fd.get("quantity")),
      unit: String(fd.get("unit")).trim(),
      category: fd.get("category") as Food["category"],
      location: fd.get("location") as Food["location"],
      added: String(fd.get("added")),
      expiry: String(fd.get("expiry")),
      dateType: fd.get("dateType") as Food["dateType"],
      notes: String(fd.get("notes")),
      value: value === "" ? undefined : Number(value),
    };
    if (!f.name) {
      setError("Please enter a food name.");
      return;
    }
    setBusy(true);
    try {
      await save(f, again);
      if (again) {
        form.current?.reset();
        form.current?.querySelector("input")?.focus();
      }
    } catch {
      setError("Could not save this food. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={food.id ? "A little kitchen upkeep" : "Add something good"}
      close={close}
    >
      <form ref={form} onSubmit={submit} key={food.id ?? food.name ?? "new"}>
        <p className="muted">
          Start with the basics. You can add details whenever you like.
        </p>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <label>
          Food name
          <input
            autoFocus
            name="name"
            required
            maxLength={100}
            placeholder="e.g. Spinach"
            defaultValue={food.name}
          />
        </label>
        <div className="form-grid">
          <label>
            Expiry date (optional)
            <input type="date" name="expiry" defaultValue={food.expiry} />
          </label>
          <label>
            Date on the package
            <select
              name="dateType"
              defaultValue={food.dateType ?? "best-before"}
            >
              <option value="best-before">Best-before · quality</option>
              <option value="use-by">Use-by · safety</option>
            </select>
          </label>
          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min="0.001"
              max="1000000"
              step="any"
              required
              defaultValue={food.quantity ?? 1}
            />
          </label>
          <label>
            Unit
            <select name="unit" defaultValue={food.unit ?? "pieces"}>
              {[
                "pieces",
                "g",
                "kg",
                "ml",
                "litre",
                "bag",
                "pack",
                "loaf",
                "portion",
                "can",
                "bottle",
                "bunch",
                "box",
              ].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            Where it lives
            <select name="location" defaultValue={food.location ?? "Fridge"}>
              {locations.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select name="category" defaultValue={food.category ?? "Other"}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="text-btn"
          onClick={() => setMore(!more)}
        >
          {more ? <Minus size={16} /> : <Plus size={16} />}More details
        </button>
        <div hidden={!more}>
          <label>
            Date added
            <input
              type="date"
              name="added"
              required
              defaultValue={food.added ?? localDate()}
            />
          </label>
          <label>
            Estimated total value ({currency}, optional)
            <input
              name="value"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              defaultValue={food.value}
            />
          </label>
          <label>
            Notes
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={food.notes}
              placeholder="Storage instructions, brand, or a little reminder"
            />
          </label>
        </div>
        <p className="small muted">
          No date? Leave it blank. EatFirst never guesses an expiry date.
        </p>
        <div className="form-actions">
          {!food.id && (
            <button
              className="btn secondary"
              name="intent"
              value="again"
              disabled={busy}
            >
              Save & add another
            </button>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save food"}
          </button>
        </div>
        {act && (
          <div className="item-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => act("eaten")}
            >
              <Check size={16} />
              Eaten
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => act("used")}
            >
              Used
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => act("discarded")}
            >
              <Trash2 size={16} />
              Discard
            </button>
            <button
              type="button"
              className="text-btn error-text"
              onClick={remove}
            >
              Remove
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
