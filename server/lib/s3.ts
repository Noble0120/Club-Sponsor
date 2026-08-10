import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

const REGION = process.env.AWS_REGION;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

function extFromMimeType(mimeType: string, filename?: string): string {
  if (filename && filename.includes(".")) {
    return filename.split(".").pop() as string;
  }
  const parts = mimeType.split("/");
  return parts[1] || "bin";
}

export async function uploadBase64File(
  base64: string,
  mimeType: string,
  userId: number,
  filename?: string,
): Promise<{ url: string; fileKey: string }> {
  if (!BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME environment variable is required");
  }

  const buffer = Buffer.from(base64.replace(/^data:.*;base64,/, ""), "base64");
  const ext = extFromMimeType(mimeType, filename);
  const fileKey = `${userId}-uploads/${Date.now()}-${nanoid(8)}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  const url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileKey}`;
  return { url, fileKey };
}

// The public object URL has no Content-Disposition header, so a plain `<a download>` gets
// ignored cross-origin and the browser just opens the PDF again instead of downloading it.
// A presigned URL with ResponseContentDisposition forces a real download on navigation,
// regardless of origin, without changing how the object serves for inline preview.
export async function getContractDownloadUrl(fileKey: string, filename: string): Promise<string> {
  if (!BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME environment variable is required");
  }
  const safeFilename = filename.replace(/["\\]/g, "");
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
    }),
    { expiresIn: 300 },
  );
}
