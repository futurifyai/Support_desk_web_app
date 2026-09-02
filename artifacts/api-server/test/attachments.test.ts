import { describe, expect, it } from "vitest";
import { validateImageAttachment } from "../src/lib/attachments";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngInput = {
  fileName: "receipt.png",
  mimeType: "image/png",
  fileSize: png.length,
  base64Data: png.toString("base64"),
};

describe("validateImageAttachment", () => {
  it("accepts a declared PNG with matching bytes", () => {
    expect(validateImageAttachment(pngInput)).toMatchObject({ ok: true, value: { mimeType: "image/png" } });
  });

  it("rejects active SVG content", () => {
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
    expect(validateImageAttachment({
      fileName: "attack.svg",
      mimeType: "image/svg+xml",
      fileSize: svg.length,
      base64Data: svg.toString("base64"),
    }).ok).toBe(false);
  });

  it("rejects a MIME type whose magic bytes do not match", () => {
    expect(validateImageAttachment({ ...pngInput, mimeType: "image/jpeg" }).ok).toBe(false);
  });

  it("rejects malformed data and mismatched declared size", () => {
    expect(validateImageAttachment({ ...pngInput, base64Data: "not valid base64!" }).ok).toBe(false);
    expect(validateImageAttachment({ ...pngInput, fileSize: png.length + 1 }).ok).toBe(false);
  });
});