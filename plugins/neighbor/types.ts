export type NeighborState = {
  codes: Map<string, string>;     // userId → 4-digit code
  edges: Set<string>;             // canonical "userA|userB" pairs
  connUsers: Map<string, string>; // connId → userId (for last-connection detection)
};
