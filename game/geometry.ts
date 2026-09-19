import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const TUNNEL_PROFILE = [
  [-4.8, -4.2], [4.8, -4.2], [6.7, -2.3], [6.7, 2.3],
  [4.8, 4.2], [-4.8, 4.2], [-6.7, 2.3], [-6.7, -2.3],
] as const;

export function createFrameGeometry(thickness = 0.025) {
  const edges: BufferGeometry[] = [];
  for (let axis = 0; axis < 3; axis += 1) {
    for (const firstSign of [-1, 1]) {
      for (const secondSign of [-1, 1]) {
        const dimensions = [thickness, thickness, thickness];
        dimensions[axis] = 1;
        const center = [0, 0, 0];
        center[(axis + 1) % 3] = firstSign * 0.5;
        center[(axis + 2) % 3] = secondSign * 0.5;
        const edge = new BoxGeometry(dimensions[0], dimensions[1], dimensions[2]);
        edge.translate(center[0], center[1], center[2]);
        edges.push(edge);
      }
    }
  }
  const geometry = mergeGeometries(edges);
  for (const edge of edges) edge.dispose();
  return geometry;
}

export function createTunnelGeometry() {
  const vertices: number[] = [];
  for (let index = 0; index < TUNNEL_PROFILE.length; index += 1) {
    const start = TUNNEL_PROFILE[index];
    const end = TUNNEL_PROFILE[(index + 1) % TUNNEL_PROFILE.length];
    vertices.push(
      start[0], start[1], 20, end[0], end[1], 20, end[0], end[1], -230,
      start[0], start[1], 20, end[0], end[1], -230, start[0], start[1], -230,
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createCraftGeometry() {
  const points = [
    [0, 0.03, -1.05], [-0.74, -0.14, 0.65], [0.74, -0.14, 0.65],
    [0, 0.22, 0.52], [0, -0.28, 0.5], [0, 0.05, 0.86],
  ];
  const faces = [[0, 1, 3], [0, 3, 2], [0, 4, 1], [0, 2, 4], [1, 4, 5], [1, 5, 3], [3, 5, 2], [2, 5, 4]];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(faces.flatMap((face) => face.flatMap((index) => points[index])), 3));
  geometry.computeVertexNormals();
  return geometry;
}