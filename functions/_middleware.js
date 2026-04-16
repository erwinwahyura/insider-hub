// Auth middleware for protected routes
export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Public routes - no auth needed
  const publicRoutes = ['/login', '/api/auth/login', '/api/auth/register', '/'];
  if (publicRoutes.some(route => url.pathname.startsWith(route))) {
    return context.next();
  }
  
  // Check session cookie
  const cookie = context.request.headers.get('Cookie') || '';
  const sessionMatch = cookie.match(/session=([^;]+)/);
  const sessionId = sessionMatch?.[1];
  
  if (!sessionId) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: { 'Location': '/login/' }
    });
  }
  
  // Validate session in D1
  const db = context.env.DB;
  const session = await db.prepare(
    'SELECT s.*, u.email, u.name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > ?'
  ).bind(sessionId, Date.now()).first();
  
  if (!session) {
    // Clear invalid cookie
    return new Response('Unauthorized', { 
      status: 401,
      headers: { 
        'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
        'Location': '/login/'
      }
    });
  }
  
  // Add user to context
  context.data.user = {
    id: session.user_id,
    email: session.email,
    name: session.name
  };
  
  return context.next();
}
