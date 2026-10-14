import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { logoVersion, pickLogoSource, prepareLogo } from "../logos";

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 200, g: 30, b: 40, alpha: 1 } } })
    .png()
    .toBuffer()
    .then((buffer) => new Uint8Array(buffer));

describe("pickLogoSource", () => {
  it("keeps the stored source while a feed still offers it", () => {
    expect(pickLogoSource("https://b/x.png", ["https://a/x.png", "https://b/x.png"])).toBe("https://b/x.png");
  });

  it("does not depend on the order the feeds answered", () => {
    expect(pickLogoSource(null, ["https://b/x.png", "https://a/x.png"])).toBe("https://a/x.png");
    expect(pickLogoSource("https://gone/x.png", ["https://a/x.png", "https://b/x.png"])).toBe("https://a/x.png");
  });

  it("has nothing to pick from no candidates", () => {
    expect(pickLogoSource(null, [])).toBeNull();
  });
});

describe("prepareLogo", () => {
  it("shrinks a raster logo to a 128px WebP", async () => {
    const logo = await prepareLogo(await png(400, 200), "image/png");
    expect(logo?.contentType).toBe("image/webp");
    expect(logo?.extension).toBe("webp");
    const meta = await sharp(logo!.bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 128, 64]);
  });

  it("does not enlarge a small logo", async () => {
    const logo = await prepareLogo(await png(60, 60), "image/png");
    expect((await sharp(logo!.bytes).metadata()).width).toBe(60);
  });

  it("stores SVGs as they are", async () => {
    const svg = new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg">${" ".repeat(300)}</svg>`);
    expect(await prepareLogo(svg, "image/svg+xml")).toEqual({ bytes: svg, contentType: "image/svg+xml", extension: "svg" });
  });

  it("rejects placeholders and unknown types", async () => {
    expect(await prepareLogo(new Uint8Array(50), "image/png")).toBeNull();
    expect(await prepareLogo(new Uint8Array(500), "text/html")).toBeNull();
  });

  it("gives the same logo the same version", async () => {
    const source = await png(300, 300);
    const [first, second] = await Promise.all([prepareLogo(source, "image/png"), prepareLogo(source, "image/png")]);
    expect(logoVersion(first!.bytes)).toBe(logoVersion(second!.bytes));
    expect(logoVersion(first!.bytes)).toMatch(/^[0-9a-f]{10}$/);
  });
});
