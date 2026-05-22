import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  endpoint: "https://nyc3.digitaloceanspaces.com",
  region: "nyc3",
  credentials: {
    accessKeyId: "DO00B42FBN8H", // Fake key
    secretAccessKey: "8IskwO3Pk4jpQwy41PqezvHajUm88I6KuHrAVxriXTI" // Fake secret
  },
  forcePathStyle: false
});

const command = new PutObjectCommand({
  Bucket: "nod-media",
  Key: "test.mp4",
  ContentType: "video/mp4"
});

getSignedUrl(client, command, { expiresIn: 600 }).then(console.log);
