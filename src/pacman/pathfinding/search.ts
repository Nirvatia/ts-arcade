import type { GraphType } from "../shared/types.js";

/**
 * Finds the shortest path between two nodes using a Breadth-First Search (BFS).
 * @param graph - The path graph adjacency list
 * @param start - Starting node key formatted as "y,x"
 * @param target - Target node key formatted as "y,x"
 * @returns Array of node keys tracking the path from start to target, or null if no path exists
 */
export function findShortestPath(
  graph: GraphType,
  start: string,
  target: string,
): string[] | null {
  if (!graph || Object.keys(graph).length === 0) {
    console.error("findShortestPath failed: The graph provided is empty!");
    return null;
  }

  // Ensure the starting point exists within the grid topology
  if (!graph[start]) {
    console.error(
      `findShortestPath failed: Start node '${start}' does not exist in the graph.`,
    );
    return null;
  }

  if (start === target) return [start];

  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parent: Record<string, string | null> = { [start]: null };

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === target) {
      // Reconstruct the path backwards from target to start
      const path: string[] = [];
      let step: string | null = current;
      while (step !== null) {
        path.unshift(step);
        step = parent[step];
      }
      return path;
    }

    const neighbors = graph[current] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent[neighbor] = current;
        queue.push(neighbor);
      }
    }
  }

  return null; // No valid path resolved
}
