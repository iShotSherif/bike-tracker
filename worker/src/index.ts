interface Env {
  ALERT_STORE: KVNamespace
  RESEND_API_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_PUBLIC_KEY: string
  VAPID_SUBJECT: string  // e.g. "mailto:admin@example.com"
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

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS })
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
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS })
  }

  if (!body.userId || typeof body.userId !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400, headers: CORS })
  }

  const { email, pushSubscription } = body.notificationSettings ?? {}
  if (!email && !pushSubscription) {
    return new Response(JSON.stringify({ error: 'No notification channels configured' }), { status: 400, headers: CORS })
  }

  await env.ALERT_STORE.put(body.userId, JSON.stringify(body), { expirationTtl: 172800 })

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS })
}

async function handleProfileSave(request: Request, env: Env): Promise<Response> {
  let body: ProfilePayload
  try {
    body = await request.json() as ProfilePayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS })
  }
  if (!body.userId) {
    return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400, headers: CORS })
  }
  await env.ALERT_STORE.put(`profile:${body.userId}`, JSON.stringify(body))
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS })
}

async function handleProfileGet(userId: string, env: Env): Promise<Response> {
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400, headers: CORS })
  }
  const raw = await env.ALERT_STORE.get(`profile:${userId}`)
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS })
  }
  return new Response(raw, { status: 200, headers: CORS })
}

async function handleTestNotify(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { email?: string; userId?: string; pushSubscription?: PushSubscription }

  if (body.pushSubscription) {
    await sendWebPush(env, body.pushSubscription, {
      title: '🚴 Ride & Maintain',
      body: 'Push notifications are working! You\'ll get maintenance alerts here.',
      tag: 'test',
    })
  }

  if (body.email) {
    await sendEmail(
      env.RESEND_API_KEY,
      body.email,
      'Bike Maintenance — Test',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#e85d26;margin:0 0 8px">Ride &amp; Maintain</h2>
        <p>Your email notifications are working correctly. You'll receive maintenance alerts here every morning when something is due.</p>
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
        if (overdue) parts.push(`${overdue} overdue`)
        if (soon) parts.push(`${soon} due soon`)
        await sendWebPush(env, pushSubscription, {
          title: `🚴 Bike maintenance: ${parts.join(', ')}`,
          body: filtered.slice(0, 3).map((c) => `${c.componentName} — ${c.detail}`).join('\n'),
          tag: 'bike-maintenance-daily',
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

  // Ephemeral sender key pair — cast to CryptoKeyPair since we asked for both usages
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

  // RFC 8291: IKM via HKDF — salt=auth, info="WebPush: info\0" + receiverPub + senderPub
  const hkdfBase = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits'])
  const ikmInfo = concat(new TextEncoder().encode('WebPush: info\0'), concat(p256dh, senderPublicRaw))
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: auth, info: ikmInfo },
    hkdfBase, 256
  ))

  // RFC 8188: CEK and nonce via HKDF — salt=salt, info=label
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
  if (overdue) parts.push(`${overdue} overdue`)
  if (soon) parts.push(`${soon} due soon`)
  return `🚴 Bike maintenance: ${parts.join(', ')}`
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
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#78716c;font-weight:600">Component</th>
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#78716c;font-weight:600">Bike</th>
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#78716c;font-weight:600">Status</th>
          </tr>
        </thead>
        <tbody>${rows.map((r) => row(r, color)).join('')}</tbody>
      </table>`

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f7f5f2">
      <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e0d8">
        <h2 style="color:#e85d26;margin:0 0 4px;font-size:22px">Ride &amp; Maintain</h2>
        <p style="color:#78716c;margin:0 0 20px;font-size:14px">Daily maintenance digest</p>
        ${section('Overdue', '#dc2626', overdueRows)}
        ${section('Due soon', '#d97706', soonRows)}
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e0d8" />
        <p style="font-size:12px;color:#a8a29e;margin:0">
          Remove your email from the Notification settings in the app to stop these alerts.
        </p>
      </div>
    </div>`
}
