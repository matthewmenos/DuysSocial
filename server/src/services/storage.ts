import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v"]);

function extOf(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

function r2() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.r2AccessKey, secretAccessKey: config.r2Secret },
  });
}

export function kindOf(filename: string, mime = "") {
  const e = extOf(filename);
  if (IMAGE_EXT.has(e) || mime.startsWith("image/")) return "image";
  if (VIDEO_EXT.has(e) || mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export async function saveFile(
  buf: Buffer,
  originalName: string,
  mime: string,
  opts: { privateBucket?: boolean } = {},
) {
  const ext = extOf(originalName) || "bin";
  const key = `${randomUUID()}.${ext}`;
  if (config.r2Enabled) {
    const bucket = opts.privateBucket ? config.r2PrivateBucket : config.r2Bucket;
    await r2().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: mime || "application/octet-stream" }),
    );
    const url = opts.privateBucket
      ? `/api/media/private/${key}`
      : config.r2PublicUrl
        ? `${config.r2PublicUrl.replace(/\/$/, "")}/${key}`
        : `/media/${key}`;
    return { key, url, mime, kind: kindOf(originalName, mime) };
  }
  await fs.mkdir(config.localUploadDir, { recursive: true });
  await fs.writeFile(path.join(config.localUploadDir, key), buf);
  return { key, url: `/media/${key}`, mime, kind: kindOf(originalName, mime) };
}

export async function deleteFile(key: string, privateBucket = false) {
  if (!key) return;
  if (config.r2Enabled) {
    const bucket = privateBucket ? config.r2PrivateBucket : config.r2Bucket;
    await r2().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
    return;
  }
  await fs.unlink(path.join(config.localUploadDir, key)).catch(() => {});
}
