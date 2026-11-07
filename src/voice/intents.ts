import type { Event } from "../core";
export type Usage = {
  kind: Event["action"];
  amount: "exact" | "half" | "all" | "unclear";
  last?: boolean;
};
export type ConversationIntent = {
  mode: "check" | "purchase" | "consume";
  kind?: Event["action"];
};
/** Recognizes explicit reporting verbs, never an instruction to mutate data. */
export function spokenIntent(text: string): ConversationIntent | null {
  if (
    /\b(?:didn't|did not|haven't|have not|not used|niet gebruikt|niet opgegeten|niet weggegooid)\b/.test(
      text,
    )
  )
    return null;
  const events: { index: number; intent: ConversationIntent }[] = [];
  const add = (r: RegExp, intent: ConversationIntent) => {
    for (const m of text.matchAll(r)) events.push({ index: m.index!, intent });
  };
  add(
    /\b(?:threw away|throw(?:n)? away|discarded|binned|gooide(?:n)? weg|weggegooid|weggegooid heb|weggegooid hebben|gooi(?:en)? weg)\b/g,
    { mode: "consume", kind: "discarded" },
  );
  add(/\b(?:ate|eaten|eet|aten|gegeten|opgegeten|ik at|opgegeten heb)\b/g, {
    mode: "consume",
    kind: "eaten",
  });
  add(
    /\b(?:used|gebruikte(?:n)?|gebruikt|(?:i|we) (?:just )?finished(?: up)?|^finished|opgemaakt|opgedronken|leeggedronken)\b/g,
    { mode: "consume", kind: "used" },
  );
  add(/\b(?:bought|purchased|gekocht|kocht(?:en)?)\b/g, { mode: "purchase" });
  add(
    /\b(?:i have|we have|there is|there's|ik heb|wij hebben|we hebben|er is|er zijn)\b/g,
    { mode: "check" },
  );
  return events.sort((a, b) => b.index - a.index)[0]?.intent ?? null;
}
export function normalizeActionOrder(text: string) {
  // Dutch completed actions put the verb after the ingredient list.
  return text
    .replace(/\bi\x27ve\b/g, "i have")
    .replace(/\bwe\x27ve\b/g, "we have")
    .replace(
      /\b(?:ik|we|wij)\s+(?:heb|hebben)\s+((?:[^.!?\n…]|\.(?=\d))+?)\s+(gebruikt|gegeten|opgegeten|weggegooid|gekocht|opgemaakt|opgedronken|gemaakt|gekookt)\b/g,
      (_, body: string, verb: string) =>
        `${verb === "gemaakt" || verb === "gekookt" ? "i cooked" : verb === "gekocht" ? "i bought" : verb === "weggegooid" ? "i threw away" : verb === "opgegeten" || verb === "gegeten" ? "i ate" : verb === "opgemaakt" || verb === "opgedronken" ? "we finished" : "i used"} ${body}`,
    )
    .replace(
      /\b((?:i|we|ik|wij)\s+(?:(?:have|just|net)\s+)*(?:used|ate|finished|threw away|bought|purchased|gebruikte|aten|kocht|gooide weg))\b/g,
      "\n$1",
    );
}
export function mealIntroduction(text: string) {
  return (
    /^(?:i|we)\s+(?:(?:just|have|had)\s+)*(?:made|cooked|prepared|am cooking|am making)\b/.test(
      text,
    ) &&
    !/\d/.test(text) &&
    spokenIntent(text)?.mode !== "consume" &&
    spokenIntent(text)?.mode !== "purchase"
  );
}
export function usageAmount(
  text: string,
  hasQuantity: boolean,
  kind: Event["action"],
): Usage {
  const half =
    /\b(?:half (?:of )?(?:the|my|our)|de helft(?: van)?(?: de| het)?|helft van)\b/.test(
      text,
    );
  const all =
    /\b(?:finished|finished up|all (?:of )?(?:the|my|our)|the rest of|everything|opgemaakt|opgedronken|alles|alle(?:maal)?|de rest van)\b/.test(
      text,
    );
  const vague =
    /\b(?:almost|nearly|bijna)\s+(?:all|alles|allemaal|finished|opgemaakt)|\b(?:some|a little|een beetje)\b/.test(
      text,
    );
  return {
    kind,
    amount: vague
      ? "unclear"
      : half
        ? "half"
        : hasQuantity
          ? "exact"
          : all
            ? "all"
            : "unclear",
    last: /\b(?:last|laatste)\b/.test(text) || undefined,
  };
}
export function usageLabel(usage: Usage) {
  return usage.kind === "discarded"
    ? "Discard as waste"
    : usage.kind === "eaten"
      ? "Record eaten"
      : "Record used in cooking";
}
