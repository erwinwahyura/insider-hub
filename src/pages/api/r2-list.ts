export const prerender = false;

export async function GET({ request, locals }) {
  const runtime = locals.runtime;
  const bucket = runtime.env?.R2_BUCKET;
  
  if (!bucket) {
    return new Response(JSON.stringify({ error: 'R2 bucket not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || '';
  
  try {
    const prefix = type ? `insider-hub/data/${type}/` : 'insider-hub/data/';
    const objects = await bucket.list({ prefix });
    
    // Group by directory
    const grouped = objects.objects.reduce((acc, obj) => {
      const parts = obj.key.split('/');
      const dir = parts[2] || 'root'; // insider-hub/data/{type}/...
      if (!acc[dir]) acc[dir] = [];
      acc[dir].push({
        key: obj.key,
        filename: obj.key.split('/').pop(),
        size: obj.size,
        uploaded: obj.uploaded,
        fullPath: obj.key.replace('insider-hub/data/', '')
      });
      return acc;
    }, {});
    
    return new Response(JSON.stringify({ 
      bucket: 'data-md',
      basePath: 'insider-hub/data/',
      directories: grouped,
      total: objects.objects.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
