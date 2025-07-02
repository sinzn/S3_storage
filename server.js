const express = require('express');
const multer = require('multer');
const upload = multer();
const app = express();
const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

app.use(express.json());
app.use(express.static('public'));

const s3Client = ({ accessKeyId, secretAccessKey, region }) =>
  new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });

app.post('/connect', async (req, res) => {
  try {
    const s3 = s3Client(req.body);
    await s3.send(new ListObjectsV2Command({ Bucket: req.body.bucket, MaxKeys: 1 }));
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/list', async (req, res) => {
  const s3 = s3Client(req.body);
  const data = await s3.send(new ListObjectsV2Command({ Bucket: req.body.bucket }));
  res.json({ files: data.Contents || [] });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const { accessKeyId, secretAccessKey, region, bucket } = req.body;
  const s3 = s3Client({ accessKeyId, secretAccessKey, region });
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: req.file.originalname,
    Body: req.file.buffer
  }));
  res.sendStatus(200);
});

app.post('/delete', async (req, res) => {
  const s3 = s3Client(req.body);
  await s3.send(new DeleteObjectCommand({ Bucket: req.body.bucket, Key: req.body.key }));
  res.sendStatus(200);
});

app.post('/share', async (req, res) => {
  const s3 = s3Client(req.body);
  const cmd = new GetObjectCommand({ Bucket: req.body.bucket, Key: req.body.key });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
  res.json({ url });
});

app.get('/download', async (req, res) => {
  const { ak, sk, region, bucket, key } = req.query;
  const s3 = s3Client({ accessKeyId: ak, secretAccessKey: sk, region });
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  res.redirect(url);
});

app.listen(3000, () => console.log('✅ Server running at http://localhost:3000'));
