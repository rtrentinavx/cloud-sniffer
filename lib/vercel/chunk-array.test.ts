import { describe, expect, it } from "vitest";
import { chunkArray } from "./chunk-array";

describe("chunkArray", () => {
  it("returns empty array for empty input", () => {
    expect(chunkArray([], 300)).toEqual([]);
  });

  it("splits items into fixed-size chunks", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns one chunk when size exceeds length", () => {
    expect(chunkArray(["a", "b"], 500)).toEqual([["a", "b"]]);
  });

  it("rejects invalid chunk size", () => {
    expect(() => chunkArray([1], 0)).toThrow(/chunkSize/);
  });
});
