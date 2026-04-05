export const prerender = false;

export async function GET({ locals }) {
  const runtime = locals.runtime;
  const bucket = runtime.env?.R2_BUCKET;
  
  if (!bucket) {
    return new Response(JSON.stringify({ error: 'R2 bucket not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const objects = await bucket.list();
    return new Response(JSON.stringify({ 
      bucket: 'data-md',
      objects: objects.objects.map(o => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded
      }))
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