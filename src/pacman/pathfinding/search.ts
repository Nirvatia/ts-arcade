import type { GraphType } from "../types.js";

/**
 * Находит кратчайший путь между двумя узлами графа (BFS).
 *
 * @param graph - граф путей (результат createPathGraph)
 * @param start - начальный узел в формате "y,x"
 * @param target - целевой узел в формате "y,x"
 * @returns массив узлов пути или null, если путь не найден
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

  // Проверка существования начального узла
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
      // Восстановление пути с конца к началу
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

  return null; // Путь не найден
}
