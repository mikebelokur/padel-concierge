import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import sharp from "sharp";
import type { File } from "@google-cloud/storage";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const IMAGE_VARIANTS = {
  thumb: { width: 400, quality: 72 },
  medium: { width: 1000, quality: 80 },
} as const;

const VARIANT_CACHE_CONTROL = "public, max-age=31536000, immutable";
const ORIGINAL_CACHE_TTL_SEC = 86400;

async function serveFile(req: Request, res: Response, file: File): Promise<void> {
  const variantParam = typeof req.query.v === "string" ? req.query.v : "";
  const variant = (IMAGE_VARIANTS as Record<string, { width: number; quality: number }>)[variantParam];

  if (variant) {
    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "";
    const isResizable =
      contentType.startsWith("image/") &&
      !contentType.includes("svg") &&
      !contentType.includes("gif");

    if (isResizable) {
      const chunks: Buffer[] = [];
      for await (const chunk of file.createReadStream() as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }
      const input = Buffer.concat(chunks);
      const output = await sharp(input)
        .rotate()
        .resize({ width: variant.width, withoutEnlargement: true })
        .webp({ quality: variant.quality })
        .toBuffer();
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", VARIANT_CACHE_CONTROL);
      res.setHeader("Content-Length", String(output.length));
      res.end(output);
      return;
    }
  }

  const response = await objectStorageService.downloadObject(file, ORIGINAL_CACHE_TTL_SEC);
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body) {
    const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
    nodeStream.pipe(res);
  } else {
    res.end();
  }
}

const UPLOAD_ALLOWED_ROLES = new Set(["admin", "owner", "coach", "developer"]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_UPLOAD_PREFIXES = ["image/"];

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const role = (req as unknown as { auth?: { role?: string } }).auth?.role;
  if (!role || !UPLOAD_ALLOWED_ROLES.has(role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    if (size > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: "File too large" });
      return;
    }
    if (!ALLOWED_UPLOAD_PREFIXES.some((p) => contentType.toLowerCase().startsWith(p))) {
      res.status(400).json({ error: "Unsupported content type" });
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    await serveFile(req, res, file);
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    await serveFile(req, res, objectFile);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
