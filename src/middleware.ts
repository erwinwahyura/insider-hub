import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server';

const isProtectedRoute = createRouteMatcher([
  '/portfolio/add',
  '/alerts/add',
  '/api/portfolio(.*)',
  '/api/alerts(.*)',
]);

export const onRequest = clerkMiddleware((auth, context, next) => {
  // Allow public access to sign-in and sign-up pages
  if (context.url.pathname.startsWith('/sign-in') || 
      context.url.pathname.startsWith('/sign-up')) {
    return next();
  }
  
  // Get auth state
  const { userId } = auth();
  
  // Store auth in locals for page access
  context.locals.auth = { userId, sessionId: null };
  
  // Protect specific routes that require modification (add/edit/delete)
  if (isProtectedRoute(context)) {
    if (!userId) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/sign-in',
        },
      });
    }
  }
  
  return next();
});
