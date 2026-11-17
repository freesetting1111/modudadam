import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import pg from "pg";

const required = ["DATABASE_URL", "AWS_REGION", "AWS_S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(
    `SELECT images.id, images.object_key AS "objectKey", images.status, images.post_id AS "postId",
       COALESCE(posts.attributes->>'contentHtml', '') LIKE '%' || images.id::text || '%' AS "referencedInContent"
     FROM post_images images
     LEFT JOIN posts ON posts.id = images.post_id
     ORDER BY images.created_at DESC
     LIMIT 1`,
  );
  const image = result.rows[0];
  if (!image) {
    console.log("No post image exists in the database.");
  } else {
    const client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    const input = { Bucket: process.env.AWS_S3_BUCKET, Key: image.objectKey };
    const metadata = await client.send(new HeadObjectCommand(input));
    const signedUrl = await getSignedUrl(client, new GetObjectCommand(input), { expiresIn: 60 });
    const response = await fetch(signedUrl);

    console.log(JSON.stringify({
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
      objectPrefix: image.objectKey.split("/").slice(0, -1).join("/"),
      databaseStatus: image.status,
      linkedToPost: Boolean(image.postId),
      postId: image.postId,
      referencedInContent: image.referencedInContent,
      contentType: metadata.ContentType,
      contentLength: metadata.ContentLength,
      signedReadStatus: response.status,
      readable: response.ok,
    }, null, 2));
  }
} finally {
  await pool.end();
}
