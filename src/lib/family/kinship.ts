import {
  type FamilyGraph,
  parentsOf,
  childrenOf,
  partnersOf,
  personById,
} from "./types";

export type PathStep = { from: string; to: string; label: string };
export type KinshipResult = {
  /** Terme de parenté validé, ou null si incertain. */
  term: string | null;
  /** Chaîne factuelle lisible, toujours fournie quand un chemin existe. */
  chain: string | null;
  path: string[];
  steps: PathStep[];
  multiple: boolean;
  connected: boolean;
};

type Edge = { to: string; label: string; type: "parent" | "child" | "partner" };

function buildEdges(graph: FamilyGraph): Map<string, Edge[]> {
  const map = new Map<string, Edge[]>();
  const push = (from: string, e: Edge) => {
    const list = map.get(from) ?? [];
    list.push(e);
    map.set(from, list);
  };
  for (const p of graph.persons) map.set(p.id, []);
  for (const r of graph.relations) {
    const adoptive = r.kind === "adoptive" ? " (adoption)" : "";
    push(r.child_id, { to: r.parent_id, label: `son parent${adoptive}`, type: "parent" });
    push(r.parent_id, { to: r.child_id, label: `son enfant${adoptive}`, type: "child" });
  }
  for (const u of graph.unions) {
    const label = u.status === "past" ? "son ancien conjoint/partenaire" : "son conjoint/partenaire";
    push(u.person_a_id, { to: u.person_b_id, label, type: "partner" });
    push(u.person_b_id, { to: u.person_a_id, label, type: "partner" });
  }
  return map;
}

/** Ancêtres avec leur profondeur minimale. */
function ancestorDepths(graph: FamilyGraph, id: string, max = 12): Map<string, number> {
  const out = new Map<string, number>();
  let frontier = [id];
  let depth = 0;
  while (frontier.length && depth < max) {
    depth += 1;
    const next: string[] = [];
    for (const person of frontier) {
      for (const parent of parentsOf(graph, person)) {
        if (!out.has(parent)) {
          out.set(parent, depth);
          next.push(parent);
        }
      }
    }
    frontier = next;
  }
  return out;
}

function descendantDepths(graph: FamilyGraph, id: string, max = 12): Map<string, number> {
  const out = new Map<string, number>();
  let frontier = [id];
  let depth = 0;
  while (frontier.length && depth < max) {
    depth += 1;
    const next: string[] = [];
    for (const person of frontier) {
      for (const child of childrenOf(graph, person)) {
        if (!out.has(child)) {
          out.set(child, depth);
          next.push(child);
        }
      }
    }
    frontier = next;
  }
  return out;
}

const ASCENDING = ["parent", "grand-parent", "arrière-grand-parent"];
const DESCENDING = ["enfant", "petit-enfant", "arrière-petit-enfant"];

function ascendingTerm(d: number) {
  return ASCENDING[d - 1] ?? `ancêtre à la ${d}e génération`;
}
function descendingTerm(d: number) {
  return DESCENDING[d - 1] ?? `descendant à la ${d}e génération`;
}

/** Calcule le lien entre « moi » et une autre personne, sans inventer de cousinage. */
export function computeKinship(graph: FamilyGraph, meId: string, otherId: string): KinshipResult {
  if (meId === otherId) {
    return { term: "vous", chain: null, path: [meId], steps: [], multiple: false, connected: true };
  }

  const edges = buildEdges(graph);
  const { path, steps } = shortestPath(edges, meId, otherId);
  const connected = path.length > 0;

  const myAnc = ancestorDepths(graph, meId);
  const myDesc = descendantDepths(graph, meId);
  const otherAnc = ancestorDepths(graph, otherId);
  const otherDesc = descendantDepths(graph, otherId);

  const matches: string[] = [];

  // Union directe
  if (partnersOf(graph, meId).includes(otherId)) {
    const union = graph.unions.find(
      (u) =>
        (u.person_a_id === meId && u.person_b_id === otherId) ||
        (u.person_b_id === meId && u.person_a_id === otherId),
    );
    matches.push(union?.status === "past" ? "ancien conjoint/partenaire" : "conjoint/partenaire");
  }

  // Ligne directe
  if (myAnc.has(otherId)) matches.push(ascendingTerm(myAnc.get(otherId)!));
  if (myDesc.has(otherId)) matches.push(descendingTerm(myDesc.get(otherId)!));

  // Fratrie
  const myParents = new Set(parentsOf(graph, meId));
  const theirParents = new Set(parentsOf(graph, otherId));
  const common = [...myParents].filter((p) => theirParents.has(p));
  if (common.length > 0) {
    const full = common.length >= 2 && myParents.size >= 2 && theirParents.size >= 2;
    matches.push(full ? "frère/sœur" : "demi-frère/demi-sœur");
  }

  // Oncle / tante, neveu / nièce, cousin germain
  if (!matches.length) {
    const isParentSibling = [...myParents].some((parent) => shareAParent(graph, parent, otherId));
    if (isParentSibling) matches.push("oncle/tante");

    const isSiblingChild = [...theirParents].some((parent) => shareAParent(graph, parent, meId));
    if (isSiblingChild) matches.push("neveu/nièce");

    const cousin = [...myParents].some((mp) =>
      [...theirParents].some((tp) => mp !== tp && shareAParent(graph, mp, tp)),
    );
    if (cousin) matches.push("cousin germain/cousine germaine");
  }

  // Par alliance (conjoint d'un parent proche)
  if (!matches.length && connected) {
    const viaPartner = partnersOf(graph, otherId).some(
      (partner) => myAnc.has(partner) || myDesc.has(partner) || shareAParent(graph, partner, meId),
    );
    if (viaPartner) matches.push("lien par alliance");
  }

  const chain = connected ? describeChain(graph, path, steps) : null;
  const term = matches.length === 1 ? matches[0]! : matches.length > 1 ? matches[0]! : null;

  return {
    term,
    chain,
    path,
    steps,
    multiple: matches.length > 1 || countDistinctPaths(graph, meId, otherId) > 1,
    connected,
  };
}

function shareAParent(graph: FamilyGraph, a: string, b: string): boolean {
  if (a === b) return false;
  const pa = new Set(parentsOf(graph, a));
  if (pa.size === 0) return false;
  return parentsOf(graph, b).some((p) => pa.has(p));
}

function shortestPath(edges: Map<string, Edge[]>, from: string, to: string) {
  const prev = new Map<string, { node: string; label: string }>();
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) break;
    for (const edge of edges.get(current) ?? []) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      prev.set(edge.to, { node: current, label: edge.label });
      queue.push(edge.to);
    }
  }
  if (!seen.has(to)) return { path: [] as string[], steps: [] as PathStep[] };
  const path = [to];
  const steps: PathStep[] = [];
  let cursor = to;
  while (cursor !== from) {
    const step = prev.get(cursor);
    if (!step) break;
    steps.unshift({ from: step.node, to: cursor, label: step.label });
    path.unshift(step.node);
    cursor = step.node;
  }
  return { path, steps };
}

function countDistinctPaths(graph: FamilyGraph, a: string, b: string): number {
  const anc = ancestorDepths(graph, a);
  const other = ancestorDepths(graph, b);
  let shared = 0;
  for (const key of anc.keys()) if (other.has(key)) shared += 1;
  return shared > 2 ? 2 : 1;
}

function describeChain(graph: FamilyGraph, path: string[], steps: PathStep[]): string {
  const names = personById(graph);
  const parts = steps.map((step, index) => {
    const subject = index === 0 ? "Vous" : names.get(step.from)?.display_name ?? "?";
    const target = names.get(step.to)?.display_name ?? "?";
    const label = index === 0 ? step.label.replace("son ", "votre ") : step.label;
    return `${subject} → ${label} : ${target}`;
  });
  return parts.join(", puis ") || `${path.length} étapes`;
}
