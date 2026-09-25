// src/modules/base-module/types/tree.types.ts

export interface GraphNode {
  id: string;
  label: string;
  relationType?: string;
  relationValue?: number;
  incoming?: GraphNode[];
  children?: GraphNode[];
  totalChildren?: number; // Totaal aantal sub-objecten in de database
  hasMore?: boolean;       // True als dit een "+ N meer..." knop/fiche is
}