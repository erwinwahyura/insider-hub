import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server';

const isProtectedRoute = createRouteMatcher([
  '/portfolio(.*)',
  '/alerts(.*)',
  '/api/portfolio(.*)',
  '/api/alerts(.*)',
]);

export const onRequest = clerkMiddleware((auth, context, next) => {
  // Allow public access to sign-in and sign-up pages
  if (context.url.pathname.startsWith('/sign-in') || 
      context.url.pathname.startsWith('/sign-up')) {
    return next();
  }
  
  // Protect specific routes
  if (isProtectedRoute(context)) {
    const { userId } = auth();
    
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
