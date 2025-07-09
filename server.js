// server.js
const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer'); // For handling file uploads
const cors = require('cors'); // For handling Cross-Origin Resource Sharing
const path = require('path');

const app = express();
const port = 3000;

// Use memory storage for multer, files will be available in req.file.buffer
const upload = multer({ storage: multer.memoryStorage() });

// Enable CORS for all origins (for development, restrict in production)
app.use(cors());
app.use(express.json()); // To parse JSON request bodies

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store S3 instance and bucket details temporarily on the server
// In a real application, you'd use session management or more robust state handling
let s3Client = null;
let currentBucketName = null;

// Endpoint to connect to S3
app.post('/api/connect', (req, res) => {
  const { accessKeyId, secretAccessKey, region, bucketName } = req.body;

  if (!accessKeyId || !secretAccessKey || !region || !bucketName) {
    return res.status(400).json({ success: false, message: 'All AWS credentials and bucket name are required.' });
  }

  try {
    AWS.config.update({
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      region: region,
    });
    s3Client = new AWS.S3();
    currentBucketName = bucketName;
    res.json({ success: true, message: 'Connected to S3 successfully!' });
  } catch (error) {
    console.error('Error connecting to S3:', error);
    res.status(500).json({ success: false, message: 'Failed to connect to S3. Check credentials.' });
  }
});

// Endpoint to disconnect from S3
app.post('/api/disconnect', (req, res) => {
  s3Client = null;
  currentBucketName = null;
  res.json({ success: true, message: 'Disconnected from S3.' });
});

// Endpoint to list files
app.get('/api/files', async (req, res) => {
  if (!s3Client || !currentBucketName) {
    return res.status(401).json({ success: false, message: 'Not connected to S3.' });
  }

  const pathPrefix = req.query.path || ''; // Get path from query parameter
  const params = {
    Bucket: currentBucketName,
    Delimiter: '/', // To list folders
    Prefix: pathPrefix, // List objects within this prefix
  };

  try {
    const data = await s3Client.listObjectsV2(params).promise();

    const files = [];

    // Add folders (CommonPrefixes)
    if (data.CommonPrefixes) {
      data.CommonPrefixes.forEach(prefix => {
        // Only add folders that are direct children of the current path
        if (prefix.Prefix !== pathPrefix) { // Avoid adding the current path itself as a folder
            files.push({
                Key: prefix.Prefix, // Keep full path for navigation
                Type: 'Folder',
                Size: '-',
                LastModified: '-',
            });
        }
      });
    }

    // Add files (Contents)
    if (data.Contents) {
      data.Contents.forEach(content => {
        // Exclude the current folder itself if it appears as a file (e.g., a 0-byte object representing the folder)
        if (content.Key !== pathPrefix && content.Key !== `${pathPrefix}/`) {
          files.push({
            Key: content.Key,
            Type: getFileType(content.Key),
            Size: content.Size, // Send raw bytes, frontend will format
            LastModified: content.LastModified,
          });
        }
      });
    }
    res.json({ success: true, files });
  } catch (error) {
    console.error('Error listing files from S3:', error);
    res.status(500).json({ success: false, message: 'Failed to list files from S3.' });
  }
});

// Endpoint to upload a file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!s3Client || !currentBucketName) {
    return res.status(401).json({ success: false, message: 'Not connected to S3.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const filePath = req.body.path || ''; // Get path from form data
  const uploadParams = {
    Bucket: currentBucketName,
    Key: `${filePath}${req.file.originalname}`, // Prepend current path to filename
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };

  try {
    await s3Client.upload(uploadParams).promise();
    res.json({ success: true, message: 'File uploaded successfully!' });
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    res.status(500).json({ success: false, message: 'Failed to upload file to S3.' });
  }
});

// Endpoint to download a file
app.get('/api/download/:key', async (req, res) => {
  if (!s3Client || !currentBucketName) {
    return res.status(401).json({ success: false, message: 'Not connected to S3.' });
  }

  const fileKey = req.params.key;
  const downloadParams = {
    Bucket: currentBucketName,
    Key: fileKey,
  };

  try {
    const data = await s3Client.getObject(downloadParams).promise();
    // Set content-disposition to prompt download
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fileKey)}"`);
    res.setHeader('Content-Type', data.ContentType || 'application/octet-stream');
    res.send(data.Body);
  } catch (error) {
    console.error('Error downloading file from S3:', error);
    res.status(500).json({ success: false, message: 'Failed to download file from S3.' });
  }
});

// Endpoint to delete a file or folder
app.delete('/api/delete', async (req, res) => {
  if (!s3Client || !currentBucketName) {
    return res.status(401).json({ success: false, message: 'Not connected to S3.' });
  }

  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, message: 'File key is required for deletion.' });
  }

  try {
    if (key.endsWith('/')) {
      // It's a folder (prefix) - perform recursive deletion
      let continuationToken = null;
      do {
        const listParams = {
          Bucket: currentBucketName,
          Prefix: key, // List all objects with this prefix
          ContinuationToken: continuationToken,
        };
        const listedObjects = await s3Client.listObjectsV2(listParams).promise();

        if (listedObjects.Contents.length === 0) break; // No more objects to list

        const deleteParams = {
          Bucket: currentBucketName,
          Delete: {
            Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
            Quiet: true, // Don't return deleted objects in the response
          },
        };

        await s3Client.deleteObjects(deleteParams).promise();
        continuationToken = listedObjects.NextContinuationToken;

      } while (continuationToken);

      res.json({ success: true, message: `Folder "${key}" and its contents deleted successfully!` });

    } else {
      // It's a single file
      const deleteParams = {
        Bucket: currentBucketName,
        Key: key,
      };
      await s3Client.deleteObject(deleteParams).promise();
      res.json({ success: true, message: 'File deleted successfully!' });
    }
  } catch (error) {
    console.error('Error deleting from S3:', error);
    res.status(500).json({ success: false, message: `Failed to delete "${key}": ${error.message}` });
  }
});

// Endpoint to create a new folder
app.post('/api/create-folder', async (req, res) => {
  if (!s3Client || !currentBucketName) {
    return res.status(401).json({ success: false, message: 'Not connected to S3.' });
  }

  const { folderName } = req.body; // folderName will now include the full path like 'parent/newfolder/'
  if (!folderName) {
    return res.status(400).json({ success: false, message: 'Folder name is required.' });
  }

  const createFolderParams = {
    Bucket: currentBucketName,
    Key: folderName, // S3 simulates folders with a trailing slash
    Body: '', // Empty body for a folder
  };

  try {
    await s3Client.putObject(createFolderParams).promise();
    res.json({ success: true, message: `Folder created successfully!` });
  } catch (error) {
    console.error('Error creating folder in S3:', error);
    res.status(500).json({ success: false, message: 'Failed to create folder in S3.' });
  }
});

// New Endpoint: Generate Pre-signed URL for sharing
app.post('/api/generate-presigned-url', async (req, res) => {
  if (!s3Client || !currentBucketName) {
    return res.status(401).json({ success: false, message: 'Not connected to S3.' });
  }

  const { key, expiresInSeconds } = req.body;
  if (!key || !expiresInSeconds) {
    return res.status(400).json({ success: false, message: 'File key and expiry time are required.' });
  }

  const params = {
    Bucket: currentBucketName,
    Key: key,
    Expires: expiresInSeconds, // Expiry time in seconds
  };

  try {
    const url = s3Client.getSignedUrl('getObject', params);
    res.json({ success: true, url });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    res.status(500).json({ success: false, message: 'Failed to generate shareable link.' });
  }
});


// Helper function to determine file type based on extension
const getFileType = (key) => {
  const extension = key.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
    return 'Image';
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
    return 'Video';
  }
  if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
    return 'Document';
  }
  return 'File';
};

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
