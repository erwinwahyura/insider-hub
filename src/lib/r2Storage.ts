// Upload data to R2 bucket (insider-hub/data/)
export async function uploadToR2(bucket, type, filename, data, contentType = 'application/json') {
  const key = `insider-hub/data/${type}/${filename}`;
  
  const object = await bucket.put(key, data, {
    httpMetadata: { contentType },
    customMetadata: {
      uploaded: new Date().toISOString(),
      type,
      size: data.length.toString()
    }
  });
  
  return { key, success: true };
}

// List data by type
export async function listR2Data(bucket, type, prefix = '') {
  const path = `insider-hub/data/${type}/${prefix}`;
  const objects = await bucket.list({ prefix: path });
  return objects;
}

// Get specific file
export async function getR2Data(bucket, type, filename) {
  const key = `insider-hub/data/${type}/${filename}`;
  const object = await bucket.get(key);
  if (!object) return null;
  return {
    body: await object.text(),
    metadata: object.customMetadata,
    key
  };
}
