const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const imageSignatures: Record<string, (bytes: Buffer) => boolean> = {
  "image/png": (bytes) => bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (bytes) => bytes.length >= 3
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/webp": (bytes) => bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP",
  "image/gif": (bytes) => bytes.length >= 6
    && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a"),
};

type AttachmentInput = {
  fileName?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
  base64Data?: unknown;
};

type AttachmentValidation =
  | { ok: true; value: { fileName: string; mimeType: keyof typeof imageSignatures; fileSize: number; base64Data: string } }
  | { ok: false; message: string };

export function validateImageAttachment(input: AttachmentInput): AttachmentValidation {
  if (
    typeof input.fileName !== "string"
    || !input.fileName.trim()
    || input.fileName.trim().length > 255
    || typeof input.mimeType !== "string"
    || !(input.mimeType in imageSignatures)
    || typeof input.fileSize !== "number"
    || !Number.isSafeInteger(input.fileSize)
    || input.fileSize <= 0
    || input.fileSize > MAX_ATTACHMENT_BYTES
    || typeof input.base64Data !== "string"
    || !input.base64Data
    || input.base64Data.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64Data)
  ) {
    return { ok: false, message: "Attach a verified PNG, JPEG, WebP, or GIF image under 5 MB" };
  }

  const bytes = Buffer.from(input.base64Data, "base64");
  const mimeType = input.mimeType as keyof typeof imageSignatures;
  if (bytes.length !== input.fileSize || !imageSignatures[mimeType](bytes)) {
    return { ok: false, message: "Attachment contents do not match the selected image type" };
  }

  return {
    ok: true,
    value: {
      fileName: input.fileName.trim(),
      mimeType,
      fileSize: input.fileSize,
      base64Data: input.base64Data,
    },
  };
}