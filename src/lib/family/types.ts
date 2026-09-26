export type VitalStatus = "alive" | "deceased" | "unknown";
export type DatePrecision = "exact" | "year" | "approx" | "unknown";
export type FiliationKind = "biological" | "adoptive" | "step" | "unknown";
export type UnionStatus = "current" | "past" | "unknown";
export type FamilyRole = "admin" | "member" | "reader";

export type Person = {
  id: string;
  display_name: string;
  nickname?: string | null;
  birth_date?: string | null;
  birth_year?: number | null;
  birth_precision?: DatePrecision;
  vital: VitalStatus;
  death_date?: string | null;
  death_year?: number | null;
  origin_place?: string | null;
  bio?: string | null;
  is_child_record?: boolean;
  claimed_by?: string | null;
  created_by?: string | null;
};

export type ParentChild = {
  parent_id: string;
  child_id: string;
  kind: FiliationKind;
};

export type Union = {
  id: string;
  person_a_id: string;
  person_b_id: string;
  status: UnionStatus;
};

export type FamilyGraph = {
  persons: Person[];
  relations: ParentChild[];
  unions: Union[];
};

export function personById(graph: FamilyGraph): Map<string, Person> {
  return new Map(graph.persons.map((p) => [p.id, p]));
}

export function parentsOf(graph: FamilyGraph, id: string): string[] {
  return graph.relations.filter((r) => r.child_id === id).map((r) => r.parent_id);
}

export function childrenOf(graph: FamilyGraph, id: string): string[] {
  return graph.relations.filter((r) => r.parent_id === id).map((r) => r.child_id);
}

export function partnersOf(graph: FamilyGraph, id: string): string[] {
  return graph.unions
    .filter((u) => u.person_a_id === id || u.person_b_id === id)
    .map((u) => (u.person_a_id === id ? u.person_b_id : u.person_a_id));
}

/** Frères et sœurs : au moins un parent connu en commun. */
export function siblingsOf(graph: FamilyGraph, id: string): string[] {
  const myParents = new Set(parentsOf(graph, id));
  if (myParents.size === 0) return [];
  const out = new Set<string>();
  for (const r of graph.relations) {
    if (myParents.has(r.parent_id) && r.child_id !== id) out.add(r.child_id);
  }
  return [...out];
}

export function lifeDates(p: Person): string {
  const birth =
    p.birth_date && p.birth_precision === "exact"
      ? new Date(p.birth_date).getFullYear().toString()
      : p.birth_year
        ? `${p.birth_precision === "approx" ? "vers " : ""}${p.birth_year}`
        : null;
  const death = p.death_year ? p.death_year.toString() : p.death_date ? new Date(p.death_date).getFullYear().toString() : null;
  if (!birth && !death) return p.vital === "deceased" ? "Décédé(e)" : "";
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return p.vital === "deceased" ? `${birth} – ?` : `né(e) ${birth}`;
  return `décès ${death}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
