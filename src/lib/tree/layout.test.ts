import { describe, expect, it } from "vitest";
import { findBranches, layoutTree, SIZES, type LayoutNode, type TreeEdgeInput, type TreeNodeInput } from "./layout";

const N = (...ids: string[]): TreeNodeInput[] => ids.map((id, i) => ({ id, sortKey: i, nameRu: id }));
const T = (from: string, to: string, type: TreeEdgeInput["type"] = "teacher_of"): TreeEdgeInput => ({
  id: `${type}:${from}>${to}`, from, to, type, verified: false,
});

const boxesOverlap = (a: LayoutNode, b: LayoutNode) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

function check(layout: ReturnType<typeof layoutTree>) {
  // узлы не пересекаются
  for (let i = 0; i < layout.nodes.length; i++)
    for (let j = i + 1; j < layout.nodes.length; j++)
      expect(boxesOverlap(layout.nodes[i] as LayoutNode, layout.nodes[j] as LayoutNode)).toBe(false);
  // линии только горизонтальные и вертикальные
  for (const e of layout.edges) {
    for (let i = 1; i < e.points.length; i++) {
      const [x0, y0] = e.points[i - 1] as [number, number];
      const [x1, y1] = e.points[i] as [number, number];
      expect(x0 === x1 || y0 === y1).toBe(true);
    }
  }
  // вертикальные участки не проходят сквозь чужие узлы (родитель и ребёнок — свои)
  for (const e of layout.edges) {
    const own = new Set([...e.parentIds, e.childId]);
    for (let i = 1; i < e.points.length; i++) {
      const [x0, y0] = e.points[i - 1] as [number, number];
      const [x1, y1] = e.points[i] as [number, number];
      if (x0 !== x1) continue;
      const [ya, yb] = y0 < y1 ? [y0, y1] : [y1, y0];
      for (const n of layout.nodes) {
        if (own.has(n.id)) continue;
        const inside = x0 > n.left && x0 < n.left + n.width && yb > n.top && ya < n.top + n.height;
        expect(inside, `${e.id} проходит через ${n.id}`).toBe(false);
      }
    }
  }
}

describe("layoutTree", () => {
  it("пустой вход", () => {
    expect(layoutTree([], []).nodes).toEqual([]);
  });

  it("учитель выше ученика, ранги растут по цепочке, роли расставлены", () => {
    const l = layoutTree(N("a", "b", "c"), [T("a", "b"), T("b", "c")]);
    const by = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
    expect(by.a?.rank).toBe(0);
    expect(by.b?.rank).toBe(1);
    expect(by.c?.rank).toBe(2);
    expect((by.a?.cy ?? 0) < (by.b?.cy ?? 0)).toBe(true);
    expect(by.a?.role).toBe("master");
    expect(by.b?.role).toBe("teacher");
    expect(by.c?.role).toBe("follower");
    expect(by.a?.medW).toBe(SIZES.masterW);
    check(l);
  });

  it("один учитель — много учеников: общая шина, ученики на одном ранге без пересечений", () => {
    const l = layoutTree(N("a", "b", "c", "d"), [T("a", "b"), T("a", "c"), T("a", "d")]);
    expect(l.edges).toHaveLength(3);
    const ys = new Set(l.edges.map((e) => e.points[1]?.[1]));
    expect(ys.size).toBe(1); // одна шина
    check(l);
  });

  it("два учителя одного ученика: учителя на одном ранге рядом, есть небесная линия", () => {
    const l = layoutTree(N("t1", "t2", "p"), [T("t1", "p"), T("t2", "p")]);
    const by = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
    expect(by.t1?.rank).toBe(by.t2?.rank);
    const bond = l.edges.filter((e) => e.kind === "bond");
    expect(bond).toHaveLength(1);
    expect(bond[0]?.bondPath).toBeTruthy();
    expect(bond[0]?.relIds).toHaveLength(2);
    const dist = Math.abs((by.t1?.cx ?? 0) - (by.t2?.cx ?? 0));
    expect(dist).toBeGreaterThanOrEqual(SIZES.captionW + SIZES.bondGap - 1);
    check(l);
  });

  it("учителя на разных рангах выравниваются, длинная линия идёт мимо узлов", () => {
    // t0 -> t1; ученик p учился и у t0, и у t1 (t0 — предок t1: выравнивать нельзя)
    const l = layoutTree(N("t0", "t1", "p", "q"), [T("t0", "t1"), T("t1", "p"), T("t0", "p"), T("t1", "q")]);
    const by = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
    expect(by.t0?.rank).toBe(0);
    expect(by.t1?.rank).toBe(1);
    expect(by.p?.rank).toBe(2);
    check(l);
  });

  it("выравнивание учителей сдвигает ранг и строит цепочку через пустой ряд", () => {
    // x -> a -> b -> p, c -> p; c без родителей, но стоит на одном ранге с b
    const l = layoutTree(N("x", "a", "b", "c", "p", "z"), [T("x", "a"), T("a", "b"), T("b", "p"), T("c", "p"), T("c", "z")]);
    const by = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
    expect(by.b?.rank).toBe(by.c?.rank);
    expect(l.edges.filter((e) => e.kind === "bond")).toHaveLength(1);
    check(l);
  });

  it("влияние — пунктирный тип, соавторство выравнивает ранг", () => {
    const l = layoutTree(N("m", "l", "a", "b"), [T("m", "l", "influenced"), T("a", "b", "collaborated"), T("m", "a")]);
    expect(l.edges.find((e) => e.kind === "influence")).toBeTruthy();
    const by = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
    expect(by.a?.rank).toBe(by.b?.rank);
    expect(l.edges.find((e) => e.kind === "collab")?.points).toHaveLength(2);
    check(l);
  });

  it("цикл в данных не роняет раскладку", () => {
    const l = layoutTree(N("a", "b"), [T("a", "b"), T("b", "a")]);
    expect(l.nodes).toHaveLength(2);
  });

  it("детерминирован", () => {
    const edges = [T("a", "b"), T("a", "c"), T("d", "c")];
    expect(layoutTree(N("a", "b", "c", "d"), edges)).toEqual(layoutTree(N("a", "b", "c", "d"), edges));
  });
});

describe("findBranches", () => {
  it("делит на ветви, самая большая первая, мастера — корни", () => {
    const b = findBranches(N("a", "b", "c", "d", "e"), [T("a", "b"), T("b", "c"), T("d", "e")]);
    expect(b).toHaveLength(2);
    expect(b[0]?.nodeIds).toEqual(["a", "b", "c"]);
    expect(b[0]?.masterIds).toEqual(["a"]);
  });
});
