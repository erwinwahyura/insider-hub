// Logout endpoint
export async function onRequestPost(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const sessionMatch = cookie.match(/session=([^;]+)/);
  const sessionId = sessionMatch?.[1];
  
  if (sessionId) {
    // Delete session from DB
    await context.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
      .bind(sessionId).run();
  }
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
    }
  });
}
