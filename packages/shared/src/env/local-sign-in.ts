import { isLocalhostLikeHostname } from '../utils';

/**
 * Whether the local password sign-in route may answer.
 *
 * This route exists only so local tooling can obtain a session without driving
 * the sign-in form. It is `auth: false` and captcha-free, so if it answers on a
 * public host it is an unauthenticated oracle for testing email and password
 * pairs against the real Supabase project.
 *
 * It used to be gated on `new URL(request.url).hostname` alone. That reads the
 * hostname the *server* was reached on, which behind a reverse proxy is the
 * container's internal address, so the guard opened on every deployed host. Unit
 * tests passed because they construct a Request with the public URL directly, so
 * the check they exercised was never the one running in production.
 *
 * Reading a forwarded header instead would not fix it: `Host` and
 * `X-Forwarded-Host` are both supplied by the client, so anyone can send
 * `Host: localhost` and reopen the route. No host-derived value can carry this
 * decision.
 *
 * The build mode can. `next build` bakes `NODE_ENV=production` into every
 * deployed image, including the dev deployments, while `next dev` runs as
 * development. So the route answers under a local dev server and nowhere else,
 * with no configuration to remember and nothing an attacker can influence.
 *
 * The hostname check is kept as a second condition. It no longer carries the
 * decision, but it costs nothing and keeps the route closed if something ever
 * runs a development build on a shared host.
 */
export function isLocalPasswordSignInAllowed(options: {
  hostname: string;
  nodeEnv?: string | undefined;
}): boolean {
  const { hostname, nodeEnv = process.env.NODE_ENV } = options;

  if (nodeEnv === 'production') {
    return false;
  }

  return isLocalhostLikeHostname(hostname);
}
