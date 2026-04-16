// Login endpoint
export async function onRequestPost(context) {
  const { email, password } = await context.request.json();
  
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const db = context.env.DB;
  
  // Get user
  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
    .bind(email).first();
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Verify password using Web Crypto PBKDF2
  const isValid = await verifyPassword(password, user.password_hash);
  
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user.id, expiresAt).run();
  
  return new Response(JSON.stringify({ success: true, user: { email: user.email, name: user.name } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
    }
  });
}

// Password verification using PBKDF2
async function verifyPassword(password, hash) {
  try {
    const [saltBase64, hashBase64] = hash.split(':');
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    
    const derivedHash = btoa(String.fromCharCode(...new Uint8Array(derived)));
    return derivedHash === hashBase64;
  } catch (e) {
    return false;
  }
}
