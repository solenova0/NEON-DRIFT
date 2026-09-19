import assert from "node:assert/strict";
import test from "node:test";
import { EdgesGeometry } from "three";
import { GAME_CONFIG } from "./config.ts";
import { createCraftGeometry } from "./geometry.ts";
import { THEME, THEME_CSS, comboColor } from "./theme.ts";

test("the angular craft has finite facets and fits its physical silhouette", () => {
  const geometry = createCraftGeometry();
  const edges = new EdgesGeometry(geometry, 15);
  try {
    geometry.computeBoundingBox();
    assert.equal(geometry.getAttribute("position").count / 3, 16);
    assert.ok([...geometry.getAttribute("normal").array].every(Number.isFinite));
    for (const axis of ["x", "y", "z"] as const) {
      const extent = GAME_CONFIG.flight.playerHalfExtents[axis];
      assert.ok(geometry.boundingBox!.min[axis] >= -extent - 1e-6);
      assert.ok(geometry.boundingBox!.max[axis] <= extent + 1e-6);
    }
    assert.ok(edges.getAttribute("position").count >= 16);
  } finally {
    geometry.dispose();
    edges.dispose();
  }
});

test("the shared theme supplies UI colors and cyan, magenta, gold combo stages", () => {
  assert.equal(THEME_CSS["--ink"], "#070B1A");
  assert.equal(THEME_CSS["--cyan"], THEME.palette.primary);
  assert.equal(comboColor(1), "#00F0FF");
  assert.equal(comboColor(3), "#FF2BD6");
  assert.equal(comboColor(GAME_CONFIG.scoring.maximumCombo), "#FFC857");
});