import {
  type FamilyGraph,
  childrenOf,
  parentsOf,
  partnersOf,
  siblingsOf,
} from "./types";

export const CARD_W = 168;
export const CARD_H = 92;
const GAP_X = 28;
const GAP_Y = 118;

export type LaidOutNode = {
  id: string;
  x: number;
  y: number;
  gen: number;
};

export type JunctionEdge = {
  key: string;
  parentIds: string[];
  childIds: string[];
  /** point de jonction */
  jx: number;
  jy: number;
  kinds: string[];
};

export type TreeLayout = {
  nodes: LaidOutNode[];
  junctions: JunctionEdge[];
  unionLinks: { a: string; b: string; status: string }[];
  width: number;
  height: number;
  hidden: Map<string, { children: number; parents: number }>;
};

/**
 * Sélectionne les personnes visibles : le noyau autour de « moi » plus les
 * branches ouvertes explicitement.
 */
export function visibleSet(graph: FamilyGraph, focusId: string, expanded: Set<string>): Set<string> {
  const visible = new Set<string>([focusId]);
  const add = (id: string) => visible.add(id);

  const seeds = new Set<string>([focusId, ...expanded]);
  for (const seed of seeds) {
    if (!graph.persons.some((p) => p.id === seed)) continue;
    add(seed);
    parentsOf(graph, seed).forEach(add);
    childrenOf(graph, seed).forEach(add);
    partnersOf(graph, seed).forEach(add);
    if (seed === focusId) {
      siblingsOf(graph, seed).forEach(add);
      // grands-parents connus
      for (const parent of parentsOf(graph, seed)) {
        parentsOf(graph, parent).forEach(add);
        partnersOf(graph, parent).forEach(add);
      }
    }
  }
  return visible;
}

/** Génération de chaque personne (les parents au-dessus, les enfants en dessous). */function generations(graph: FamilyGraph, visible: Set<string>, focusId: string): Map<string, number> {
  const gen = new Map<string, number>([[focusId, 0]]);
  const queue = [focusId];
  while (queue.length) {
    const current = queue.shift()!;
    const g = gen.get(current)!;
    const neighbours: [string, number][] = [
      ...parentsOf(graph, current).map((id) => [id, g - 1] as [string, number]),
      ...childrenOf(graph, current).map((id) => [id, g + 1] as [string, number]),
      ...partnersOf(graph, current).map((id) => [id, g] as [string, number]),
    ];
    for (const [id, value] of neighbours) {
      if (!visible.has(id) || gen.has(id)) continue;
      gen.set(id, value);
      queue.push(id);
    }
  }
  for (const id of visible) if (!gen.has(id)) gen.set(id, 0);
  return gen;
}

export function layoutTree(graph: FamilyGraph, focusId: string, expanded: Set<string>): TreeLayout {
  const visible = visibleSet(graph, focusId, expanded);
  const gen = generations(graph, visible, focusId);

  // Regroupement par génération, couples côte à côte
  const byGen = new Map<number, string[]>();
  for (const id of visible) {
    const g = gen.get(id)!;
    byGen.set(g, [...(byGen.get(g) ?? []), id]);
  }

  const order = new Map<number, string[]>();
  for (const [g, ids] of byGen) {
    const placed: string[] = [];
    const done = new Set<string>();
    const sorted = [...ids].sort((a, b) => (a === focusId ? -1 : b === focusId ? 1 : a.localeCompare(b)));
    for (const id of sorted) {
      if (done.has(id)) continue;
      placed.push(id);
      done.add(id);
      for (const partner of partnersOf(graph, id)) {
        if (visible.has(partner) && !done.has(partner) && gen.get(partner) === g) {
          placed.push(partner);
          done.add(partner);
        }
      }
    }
    order.set(g, placed);
  }

  // Position horizontale : barycentre des parents/enfants, quelques passes
  const x = new Map<string, number>();
  const gensSorted = [...order.keys()].sort((a, b) => a - b);
  for (const g of gensSorted) {
    order.get(g)!.forEach((id, index) => x.set(id, index * (CARD_W + GAP_X)));
  }
  for (let pass = 0; pass < 4; pass += 1) {
    for (const g of gensSorted) {
      const ids = order.get(g)!;
      const targets = ids.map((id) => {
        const refs = [...parentsOf(graph, id), ...childrenOf(graph, id)].filter((r) => visible.has(r));
        if (!refs.length) return x.get(id)!;
        return refs.reduce((sum, r) => sum + (x.get(r) ?? 0), 0) / refs.length;
      });
      const withTarget = ids.map((id, i) => ({ id, target: targets[i]! }));
      withTarget.sort((a, b) => a.target - b.target);
      let cursor = Math.min(...withTarget.map((w) => w.target));
      for (const item of withTarget) {
        const position = Math.max(item.target, cursor);
        x.set(item.id, position);
        cursor = position + CARD_W + GAP_X;
      }
      order.set(
        g,
        withTarget.map((w) => w.id),
      );
    }
  }

  const minX = Math.min(...[...x.values()], 0);
  const minGen = Math.min(...gensSorted);
  const nodes: LaidOutNode[] = [...visible].map((id) => ({
    id,
    x: (x.get(id) ?? 0) - minX + 20,
    y: (gen.get(id)! - minGen) * (CARD_H + GAP_Y) + 20,
    gen: gen.get(id)!,
  }));
  const pos = new Map(nodes.map((n) => [n.id, n]));

  // Jonctions de filiation par ensemble de parents (éléments visuels)
  const groups = new Map<string, { parents: string[]; children: Set<string>; kinds: Set<string> }>();
  for (const child of visible) {
    const parents = parentsOf(graph, child).filter((p) => visible.has(p));
    if (!parents.length) continue;
    const key = [...parents].sort().join("|");
    const entry = groups.get(key) ?? { parents: [...parents].sort(), children: new Set(), kinds: new Set() };
    entry.children.add(child);
    for (const rel of graph.relations) {
      if (rel.child_id === child && parents.includes(rel.parent_id)) entry.kinds.add(rel.kind);
    }
    groups.set(key, entry);
  }

  const junctions: JunctionEdge[] = [...groups.entries()].map(([key, entry]) => {
    const parentNodes = entry.parents.map((id) => pos.get(id)!).filter(Boolean);
    const jx =
      parentNodes.reduce((sum, n) => sum + n.x + CARD_W / 2, 0) / Math.max(parentNodes.length, 1);
    const jy = Math.max(...parentNodes.map((n) => n.y + CARD_H)) + GAP_Y / 2;
    return {
      key,
      parentIds: entry.parents,
      childIds: [...entry.children],
      jx,
      jy,
      kinds: [...entry.kinds],
    };
  });

  const unionLinks = graph.unions
    .filter((u) => visible.has(u.person_a_id) && visible.has(u.person_b_id))
    .map((u) => ({ a: u.person_a_id, b: u.person_b_id, status: u.status }));

  const hidden = new Map<string, { children: number; parents: number }>();
  for (const id of visible) {
    const hiddenChildren = childrenOf(graph, id).filter((c) => !visible.has(c)).length;
    const hiddenParents = parentsOf(graph, id).filter((p) => !visible.has(p)).length;
    if (hiddenChildren || hiddenParents) hidden.set(id, { children: hiddenChildren, parents: hiddenParents });
  }

  const width = Math.max(...nodes.map((n) => n.x + CARD_W), 320) + 40;
  const height = Math.max(...nodes.map((n) => n.y + CARD_H), 200) + 40;

  return { nodes, junctions, unionLinks, width, height, hidden };
}
