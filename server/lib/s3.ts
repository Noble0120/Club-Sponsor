import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
