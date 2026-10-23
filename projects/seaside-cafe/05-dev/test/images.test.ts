import { describe, expect, it, vi } from "vitest";
import { ImageCache, ImagePresenter, type DecodedImage } from "../src/ui/images";

function deferred() {
  let resolve!: (image: DecodedImage) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<DecodedImage>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("scene image presentation", () => {
  it("keeps the displayed scene until the replacement has decoded", async () => {
    const next = deferred();
    const cache = new ImageCache((src) => src === "old" ? Promise.resolve({ src }) : next.promise);
    const paint = vi.fn();
    const presenter = new ImagePresenter(cache, paint);
    await presenter.show("old");
    const changing = presenter.show("next");
    expect(paint.mock.calls).toEqual([[{ src: "old" }]]);
    next.resolve({ src: "next" });
    expect(await changing).toBe(true);
    expect(paint.mock.calls).toEqual([[{ src: "old" }], [{ src: "next" }]]);
  });

  it("ignores an obsolete slow scene after a newer request wins", async () => {
    const slow = deferred();
    const fast = deferred();
    const cache = new ImageCache((src) => src === "slow" ? slow.promise : fast.promise);
    const paint = vi.fn();
    const presenter = new ImagePresenter(cache, paint);
    const first = presenter.show("slow");
    const latest = presenter.show("fast");
    fast.resolve({ src: "fast" });
    expect(await latest).toBe(true);
    slow.resolve({ src: "slow" });
    expect(await first).toBe(false);
    expect(paint.mock.calls).toEqual([[{ src: "fast" }]]);
  });

  it("cancels a pending change when returning to the already displayed scene", async () => {
    const pending = deferred();
    const cache = new ImageCache((src) => src === "old" ? Promise.resolve({ src }) : pending.promise);
    const paint = vi.fn();
    const presenter = new ImagePresenter(cache, paint);
    await presenter.show("old");
    const changing = presenter.show("next");
    await presenter.show("old");
    pending.resolve({ src: "next" });
    expect(await changing).toBe(false);
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it("retains the old scene on failure and allows retrying the failed image", async () => {
    const load = vi.fn(async (src: string) => ({ src }));
    const cache = new ImageCache(load);
    const paint = vi.fn();
    const presenter = new ImagePresenter(cache, paint);
    await presenter.show("old");
    load.mockRejectedValueOnce(new Error("decode failed"));
    expect(await presenter.show("next")).toBe(false);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(await presenter.show("next")).toBe(true);
    expect(paint).toHaveBeenLastCalledWith({ src: "next" });
  });

  it("can hide a portrait and prevents an in-flight portrait from reappearing", async () => {
    const pending = deferred();
    const cache = new ImageCache(() => pending.promise);
    const paint = vi.fn();
    const presenter = new ImagePresenter(cache, paint);
    const showing = presenter.show("portrait");
    await presenter.show(null);
    pending.resolve({ src: "portrait" });
    expect(await showing).toBe(false);
    expect(paint).toHaveBeenLastCalledWith(null);
  });
});

describe("decoded image cache", () => {
  it("shares a pending decode between preloading and display requests", async () => {
    const pending = deferred();
    const load = vi.fn(() => pending.promise);
    const cache = new ImageCache(load);
    const preload = cache.load("next");
    const paint = vi.fn();
    const showing = new ImagePresenter(cache, paint).show("next");
    expect(load).toHaveBeenCalledTimes(1);
    expect(paint).not.toHaveBeenCalled();
    const image = { src: "next" };
    pending.resolve(image);
    expect(await preload).toBe(image);
    await showing;
    expect(await cache.load("next")).toBe(image);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("bounds retained images and evicts the least recently used image", async () => {
    const load = vi.fn(async (src: string) => ({ src }));
    const cache = new ImageCache(load, 2);
    await cache.load("a");
    await cache.load("b");
    await cache.load("a");
    await cache.load("c");
    await cache.load("a");
    expect(load).toHaveBeenCalledTimes(3);
    await cache.load("b");
    expect(load).toHaveBeenCalledTimes(4);
  });
});
