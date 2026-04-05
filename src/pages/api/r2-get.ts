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
  const path = url.searchParams.get('path');
  
  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const key = path.startsWith('insider-hub/data/') ? path : `insider-hub/data/${path}`;

  try {
    const object = await bucket.get(key);
    if (!object) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await object.text();
    const contentType = object.httpMetadata?.contentType || 'application/json';
    
    return new Response(body, {
      headers: { 
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
        'X-R2-Key': key,
        'X-R2-Size': object.size.toString()
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
