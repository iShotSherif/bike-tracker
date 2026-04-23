interface Env {
  ALERT_STORE: KVNamespace
  RESEND_API_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_PUBLIC_KEY: string
  VAPID_SUBJECT: string
  STRAVA_CLIENT_ID: string
  STRAVA_CLIENT_SECRET: string
  STRAVA_REDIRECT_URI: string
  JWT_SECRET: string  // random 32-byte hex, set via: wrangler secret put JWT_SECRET
  APP_URL: string     // e.g. https://yourdomain.com (no trailing slash)
}

interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

interface NotificationSettings {
  email?: string
  pushSubscription?: PushSubscription
  alertLevel?: 'overdue-only' | 'soon-and-overdue'
}

interface AlertComponentPayload {
  componentName: string
  bikeName: string
  status: 'overdue' | 'soon'
  detail: string
}

interface SyncPayload {
  userId: string
  notificationSettings: NotificationSettings
  alertComponents: AlertComponentPayload[]
}

interface ProfilePayload {
  userId: string
  componentsByBike: Record<string, unknown[]>
  serviceLog: unknown[]
  notificationSettings: NotificationSettings
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

const CORS_PREFLIGHT = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_PREFLIGHT })
    }

    const { pathname } = new URL(request.url)

    if (request.method === 'POST' && pathname === '/sync') {
      return handleSync(request, env)
    }

    if (request.method === 'POST' && pathname === '/test-notify') {
      return handleTestNotify(request, env)
    }

    if (request.method === 'POST' && pathname === '/profile') {
      return handleProfileSave(request, env)
    }

    if (request.method === 'GET' && pathname.startsWith('/profile/')) {
      const userId = pathname.slice('/profile/'.length)
      return handleProfileGet(userId, env)
    }

    if (request.method === 'POST' && pathname === '/auth/request') {
      return handleAuthRequest(request, env)
    }

    if (request.method === 'POST' && pathname === '/auth/verify') {
      return handleAuthVerify(request, env)
    }

    if (request.method === 'POST' && pathname === '/handoff') {
      return handleHandoffCreate(request, env)
    }

    if (request.method === 'GET' && pathname.startsWith('/handoff/')) {
      const token = pathname.slice('/handoff/'.length)
      return handleHandoffRedeem(token, env)
    }

    if (request.method === 'GET' && pathname === '/strava/auth') {
      return handleStravaAuth(request, env)
    }

    if (request.method === 'GET' && pathname === '/strava/callback') {
      return handleStravaCallback(request, env)
    }

    if (request.method === 'GET' && pathname === '/strava/activities') {
      return handleStravaActivities(request, env)
    }

    return new Response(JSON.stringify({ error: 'Introuvable' }), { status: 404, headers: CORS })
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await handleCron(env)
  },
}

async function handleSync(request: Request, env: Env): Promise<Response> {
  let body: SyncPayload
  try {
    body = await request.json() as SyncPayload
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400, headers: CORS })
  }

  if (!body.userId || typeof body.userId !== 'string') {
    return new Response(JSON.stringify({ error: 'userId manquant' }), { status: 400, headers: CORS })
  }

  const { email, pushSubscription } = body.notificationSettings ?? {}
  if (!email && !pushSubscription) {
    return new Response(JSON.stringify({ error: 'Aucun canal de notification configuré' }), { status: 400, headers: CORS })
  }

  await env.ALERT_STORE.put(body.userId, JSON.stringify(body), { expirationTtl: 172800 })

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS })
}

async function handleProfileSave(request: Request, env: Env): Promise<Response> {
  // Accept JWT auth (magic link) or fall back to userId in body (legacy API key flow)
  const authedUserId = await getUserIdFromRequest(request, env)
  let body: ProfilePayload
  try {
    body = await request.json() as ProfilePayload
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide' }), { status: 400, headers: CORS })
  }
  const userId = authedUserId ?? body.userId
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401, headers: CORS })
  }
  await env.ALERT_STORE.put(`profile:${userId}`, JSON.stringify({ ...body, userId }))
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS })
}

// --- Handoff (QR code device transfer) ---

async function handleHandoffCreate(request: Request, env: Env): Promise<Response> {
  const authedUserId = await getUserIdFromRequest(request, env)
  const body = await request.json() as { userId?: string; sessionToken?: string }
  const userId = authedUserId ?? body.userId
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401, headers: CORS })
  }

  // Pull current profile snapshot
  const profileRaw = await env.ALERT_STORE.get(`profile:${userId}`)

  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const appUrl = env.APP_URL ?? 'http://localhost:5173'
  const handoffUrl = `${appUrl}?handoff=${token}`

  // Store: sessionToken (if JWT auth) + profile snapshot, 5min TTL
  const sessionToken = extractBearer(request) ?? body.sessionToken ?? ''
  await env.ALERT_STORE.put(
    `handoff:${token}`,
    JSON.stringify({ userId, sessionToken, profileSnapshot: profileRaw ? JSON.parse(profileRaw) : null }),
    { expirationTtl: 300 }
  )

  return new Response(JSON.stringify({ handoffUrl }), { status: 200, headers: CORS })
}

async function handleHandoffRedeem(token: string, env: Env): Promise<Response> {
  if (!token) {
    return new Response(JSON.stringify({ error: 'Token manquant' }), { status: 400, headers: CORS })
  }

  const raw = await env.ALERT_STORE.get(`handoff:${token}`)
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Jeton invalide ou expiré' }), { status: 404, headers: CORS })
  }

  // One-time use â€” delete immediately
  await env.ALERT_STORE.delete(`handoff:${token}`)

  const data = JSON.parse(raw) as { userId: string; sessionToken: string; profileSnapshot: unknown }
  return new Response(JSON.stringify(data), { status: 200, headers: CORS })
}

async function handleProfileGet(userId: string, env: Env): Promise<Response> {
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId manquant' }), { status: 400, headers: CORS })
  }
  const raw = await env.ALERT_STORE.get(`profile:${userId}`)
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Introuvable' }), { status: 404, headers: CORS })
  }
  return new Response(raw, { status: 200, headers: CORS })
}

// --- JWT helpers (HS256 via HMAC-SHA256) ---

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(sig)}`
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  )
  const padding = (s: string) => s + '='.repeat((4 - s.length % 4) % 4)
  const sigBytes = Uint8Array.from(atob(padding(parts[2]).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  if (!valid) return null
  try {
    const payload = JSON.parse(atob(padding(parts[1]).replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch { return null }
}

async function hashEmail(email: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase().trim()))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

function extractBearer(request: Request): string | null {
  const auth = request.headers.get('Authorization') ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

async function getUserIdFromRequest(request: Request, env: Env): Promise<string | null> {
  const token = extractBearer(request)
  if (!token) return null
  const payload = await verifyJwt(token, env.JWT_SECRET)
  return payload?.userId as string | null
}

// --- Auth endpoints ---

async function handleAuthRequest(request: Request, env: Env): Promise<Response> {
  const { email } = await request.json() as { email?: string }
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Email invalide' }), { status: 400, headers: CORS })
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const userId = await hashEmail(email)
  await env.ALERT_STORE.put(`otp:${userId}`, otp, { expirationTtl: 900 }) // 15 min

  const appUrl = env.APP_URL ?? 'http://localhost:5173'
  const magicLink = `${appUrl}?otp=${otp}&email=${encodeURIComponent(email)}`

  await sendEmail(
    env.RESEND_API_KEY,
    email,
    'Ton lien de connexion — Ride & Maintain',
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f7f5f2">
      <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e0d8">
        <h2 style="color:#e85d26;margin:0 0 16px;font-size:20px">Ride &amp; Maintain</h2>
        <p style="margin:0 0 20px;color:#44403c">Ton code de connexion :</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:0.15em;color:#e85d26;margin:0 0 20px">${otp}</div>
        <p style="margin:0 0 16px;color:#44403c">Ou clique directement :</p>
        <a href="${magicLink}" style="display:inline-block;background:#e85d26;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Connexion automatique</a>
        <p style="margin:20px 0 0;font-size:12px;color:#a8a29e">Valable 15 minutes. Si tu n'es pas Ã  l'origine de cette demande, ignore cet email.</p>
      </div>
    </div>`
  )

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS })
}

async function handleAuthVerify(request: Request, env: Env): Promise<Response> {
  const { email, otp } = await request.json() as { email?: string; otp?: string }
  if (!email || !otp) {
    return new Response(JSON.stringify({ error: 'Champs manquants' }), { status: 400, headers: CORS })
  }

  const userId = await hashEmail(email)
  const stored = await env.ALERT_STORE.get(`otp:${userId}`)
  if (!stored || stored !== otp.trim()) {
    return new Response(JSON.stringify({ error: 'Code invalide ou expiré' }), { status: 401, headers: CORS })
  }

  await env.ALERT_STORE.delete(`otp:${userId}`)

  const token = await signJwt(
    { userId, email, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 },
    env.JWT_SECRET
  )

  return new Response(JSON.stringify({ token, userId }), { status: 200, headers: CORS })
}

// --- Strava OAuth ---

interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete_id: number
}

interface StravaAthleteGear {
  id: string
  name: string
  distance: number
  primary: boolean
}

interface StravaActivity {
  id: number
  name: string
  type: string
  start_date: string
  distance: number
  moving_time: number
  gear_id: string | null
}

function stravaKey(userId: string): string {
  return `strava:${userId}`
}

function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function handleStravaAuth(request: Request, env: Env): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId manquant' }), { status: 400, headers: CORS })
  }

  const state = `${userId}:${generateState()}`
  // Store state briefly to validate on callback (5 min TTL)
  await env.ALERT_STORE.put(`strava-state:${state}`, userId, { expirationTtl: 300 })

  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: env.STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all,profile:read_all',
    state,
  })

  return Response.redirect(`https://www.strava.com/oauth/authorize?${params}`, 302)
}

async function handleStravaCallback(request: Request, env: Env): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const frontendUrl = env.STRAVA_REDIRECT_URI.replace('/strava/callback', '')

  if (errorParam || !code || !state) {
    return Response.redirect(`${frontendUrl}?strava=denied`, 302)
  }

  // Validate state
  const storedUserId = await env.ALERT_STORE.get(`strava-state:${state}`)
  if (!storedUserId) {
    return Response.redirect(`${frontendUrl}?strava=error`, 302)
  }
  await env.ALERT_STORE.delete(`strava-state:${state}`)

  // Exchange code for tokens
  const tokenRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return Response.redirect(`${frontendUrl}?strava=error`, 302)
  }

  const tokenData = await tokenRes.json() as StravaTokens & { athlete?: { bikes?: StravaAthleteGear[] } }
  const tokens: StravaTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_at,
    athlete_id: tokenData.athlete_id,
  }
  await env.ALERT_STORE.put(stravaKey(storedUserId), JSON.stringify(tokens))

  return Response.redirect(`${frontendUrl}?strava=connected`, 302)
}

async function refreshStravaToken(env: Env, tokens: StravaTokens): Promise<StravaTokens> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Échec du rafraîchissement du jeton')
  const data = await res.json() as StravaTokens
  return { ...tokens, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at }
}

async function handleStravaActivities(request: Request, env: Env): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId manquant' }), { status: 400, headers: CORS })
  }

  const raw = await env.ALERT_STORE.get(stravaKey(userId))
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Compte non connecté' }), { status: 401, headers: CORS })
  }

  let tokens = JSON.parse(raw) as StravaTokens

  // Refresh if expired (with 60s buffer)
  if (Date.now() / 1000 > tokens.expires_at - 60) {
    try {
      tokens = await refreshStravaToken(env, tokens)
      await env.ALERT_STORE.put(stravaKey(userId), JSON.stringify(tokens))
    } catch {
      return new Response(JSON.stringify({ error: 'Échec du rafraîchissement du jeton' }), { status: 401, headers: CORS })
    }
  }

  // Fetch athlete profile to get bikes
  const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const athleteData = athleteRes.ok
    ? await athleteRes.json() as { bikes?: StravaAthleteGear[] }
    : { bikes: [] }

  const bikes = (athleteData.bikes ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    distance: b.distance,
    primary: b.primary,
  }))

  // Fetch last 2 years of activities (paginated)
  const after = Math.floor((Date.now() - 730 * 24 * 60 * 60 * 1000) / 1000)
  const allActivities: StravaActivity[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    if (!res.ok) break
    const batch = await res.json() as StravaActivity[]
    if (batch.length === 0) break
    allActivities.push(...batch)
    if (batch.length < 200) break
    page++
  }

  // Map to IntervalsActivity shape
  const activities = allActivities.map((a) => ({
    id: `strava-${a.id}`,
    start_date_local: a.start_date,
    type: a.type,
    distance: a.distance, // meters, same as Intervals
    moving_time: a.moving_time,
    gear: a.gear_id ? { id: a.gear_id } : undefined,
  }))

  return new Response(JSON.stringify({ bikes, activities }), { status: 200, headers: CORS })
}

async function handleTestNotify(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { email?: string; userId?: string; pushSubscription?: PushSubscription }

  if (body.pushSubscription) {
    await sendWebPush(env, body.pushSubscription, {
      title: '🚴 Ride & Maintain',
      body: 'Les notifications fonctionnent. Tu recevras ici tes rappels d’entretien.',
      tag: 'test',
    })
  }

  if (body.email) {
    await sendEmail(
      env.RESEND_API_KEY,
      body.email,
      'Entretien vélo — Test',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#e85d26;margin:0 0 8px">Ride &amp; Maintain</h2>
        <p>Les notifications par email fonctionnent correctement. Tu recevras ici tes rappels d'entretien chaque matin lorsqu'une intervention sera due.</p>
      </div>`
    )
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS })
}

async function handleCron(env: Env): Promise<void> {
  let cursor: string | undefined
  do {
    const listed = await env.ALERT_STORE.list({ cursor })
    cursor = listed.list_complete ? undefined : (listed as any).cursor

    for (const key of listed.keys) {
      const raw = await env.ALERT_STORE.get(key.name)
      if (!raw) continue

      let payload: SyncPayload
      try { payload = JSON.parse(raw) as SyncPayload }
      catch { continue }

      const { notificationSettings, alertComponents } = payload
      const { email, pushSubscription, alertLevel = 'soon-and-overdue' } = notificationSettings

      const filtered = alertLevel === 'overdue-only'
        ? alertComponents.filter((c) => c.status === 'overdue')
        : alertComponents

      if (filtered.length === 0) continue

      if (pushSubscription) {
        const overdue = filtered.filter((c) => c.status === 'overdue').length
        const soon = filtered.filter((c) => c.status === 'soon').length
        const parts: string[] = []
        if (overdue) parts.push(`${overdue} en retard`)
        if (soon) parts.push(`${soon} bientôt dus`)
        await sendWebPush(env, pushSubscription, {
          title: `🚴 Entretien vélo : ${parts.join(', ')}`,
          body: filtered.slice(0, 3).map((c) => `${c.componentName} — ${c.detail}`).join('\n'),
          tag: 'entretien-velo-quotidien',
        })
      }

      if (email) {
        await sendEmail(
          env.RESEND_API_KEY,
          email,
          buildEmailSubject(filtered),
          buildEmailHtml(filtered)
        )
      }
    }
  } while (cursor)
}

// --- Web Push (VAPID) ---

function base64urlToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function makeVapidJwt(env: Env, audience: string): Promise<string> {
  const header = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  )
  const now = Math.floor(Date.now() / 1000)
  const claims = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({
      aud: audience,
      exp: now + 43200,
      sub: env.VAPID_SUBJECT,
    }))
  )
  const signingInput = `${header}.${claims}`

  const keyData = base64urlToUint8Array(env.VAPID_PRIVATE_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  return `${signingInput}.${uint8ArrayToBase64url(new Uint8Array(signature))}`
}

async function sendWebPush(
  env: Env,
  sub: PushSubscription,
  payload: { title: string; body: string; tag?: string }
): Promise<void> {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return

  const endpoint = sub.endpoint
  const audience = new URL(endpoint).origin

  const jwt = await makeVapidJwt(env, audience)
  const vapidAuth = `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`

  const message = new TextEncoder().encode(JSON.stringify(payload))
  const encrypted = await encryptWebPush(message, sub.keys.p256dh, sub.keys.auth)

  await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapidAuth,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: encrypted,
  })
}

async function encryptWebPush(
  plaintext: Uint8Array,
  p256dhBase64: string,
  authBase64: string,
): Promise<Uint8Array> {
  const p256dh = base64urlToUint8Array(p256dhBase64)
  const auth = base64urlToUint8Array(authBase64)

  // Import receiver public key
  const receiverKey = await crypto.subtle.importKey(
    'raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, true, []
  )

  // Ephemeral sender key pair â€” cast to CryptoKeyPair since we asked for both usages
  const senderPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  )) as CryptoKeyPair
  const senderPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderPair.publicKey) as ArrayBuffer)

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', $public: receiverKey } as any,
    senderPair.privateKey,
    256
  ))

  const salt = crypto.getRandomValues(new Uint8Array(16))

  // RFC 8291: IKM via HKDF â€” salt=auth, info="WebPush: info\0" + receiverPub + senderPub
  const hkdfBase = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits'])
  const ikmInfo = concat(new TextEncoder().encode('WebPush: info\0'), concat(p256dh, senderPublicRaw))
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: auth, info: ikmInfo },
    hkdfBase, 256
  ))

  // RFC 8188: CEK and nonce via HKDF â€” salt=salt, info=label
  const hkdfIkm = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits'])
  const cekBytes = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: aes128gcm\0') },
    hkdfIkm, 128
  ))
  const nonceBytes = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: nonce\0') },
    hkdfIkm, 96
  ))

  const cek = await crypto.subtle.importKey('raw', cekBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const padded = concat(plaintext, new Uint8Array([2])) // delimiter = last record
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBytes }, cek, padded))

  // RFC 8188 aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65)
  const header = new Uint8Array(21 + senderPublicRaw.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096, false)
  header[20] = senderPublicRaw.length
  header.set(senderPublicRaw, 21)

  return concat(header, ciphertext)
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

// --- Email ---

async function sendEmail(apiKey: string, to: string, subject: string, html: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: [to],
      subject,
      html,
    }),
  })
}

function buildEmailSubject(items: AlertComponentPayload[]): string {
  const overdue = items.filter((i) => i.status === 'overdue').length
  const soon = items.filter((i) => i.status === 'soon').length
  const parts: string[] = []
  if (overdue) parts.push(`${overdue} en retard`)
  if (soon) parts.push(`${soon} bientôt dus`)
  return `🚴 Entretien vélo : ${parts.join(', ')}`
}

function buildEmailHtml(items: AlertComponentPayload[]): string {
  const overdueRows = items.filter((i) => i.status === 'overdue')
  const soonRows = items.filter((i) => i.status === 'soon')

  const row = (item: AlertComponentPayload, color: string) =>
    `<tr>
      <td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #f0ece6">${item.componentName}</td>
      <td style="padding:8px 12px;color:#78716c;border-bottom:1px solid #f0ece6">${item.bikeName}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:13px;color:${color};border-bottom:1px solid #f0ece6">${item.detail}</td>
    </tr>`

  const section = (title: string, color: string, rows: AlertComponentPayload[]) =>
    rows.length === 0 ? '' : `
      <h3 style="color:${color};margin:20px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.05em">${title}</h3>
      <table style="border-collapse:collapse;width:100%;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e0d8">
        <thead style="background:#f7f5f2">
          <tr>
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#78716c;font-weight:600">Composant</th>
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#78716c;font-weight:600">Vélo</th>
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#78716c;font-weight:600">Statut</th>
          </tr>
        </thead>
        <tbody>${rows.map((r) => row(r, color)).join('')}</tbody>
      </table>`

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f7f5f2">
      <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e0d8">
        <h2 style="color:#e85d26;margin:0 0 4px;font-size:22px">Ride &amp; Maintain</h2>
        <p style="color:#78716c;margin:0 0 20px;font-size:14px">Récapitulatif quotidien de l'entretien</p>
        ${section('En retard', '#dc2626', overdueRows)}
        ${section('Bientôt dû', '#d97706', soonRows)}
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e0d8" />
        <p style="font-size:12px;color:#a8a29e;margin:0">
          Retire ton email dans les réglages de notification de l'application pour arrêter ces alertes.
        </p>
      </div>
    </div>`
}

