// Server function for sending order-status notification emails to clients.
// Called from admin UI when an order's status changes.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const STATUS_TO_TEMPLATE: Record<string, string> = {
  confirmed: 'order-confirmed',
  paid: 'order-paid',
  completed: 'order-completed',
  cancelled: 'order-cancelled',
}

export const notifyOrderStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orderId: z.string().uuid(), status: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Staff-only
    const { data: roles } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', context.userId)
    const isStaff = (roles ?? []).some((r: { role: string }) =>
      ['admin', 'manager'].includes(r.role),
    )
    if (!isStaff) throw new Error('Доступ запрещён')

    const templateKey = STATUS_TO_TEMPLATE[data.status]
    if (!templateKey) return { ok: false, skipped: true, reason: 'no template for status' }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id, client_name, client_email, total, event_date')
      .eq('id', data.orderId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!order || !order.client_email) {
      return { ok: false, skipped: true, reason: 'no client_email' }
    }

    // Reuse the transactional send route via internal fetch to keep all the
    // logging/suppression/queueing logic in one place.
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    // Pass through the caller's bearer so the staff check passes inside /send.
    headers.set('Authorization', `Bearer ${context.claims?.token ?? ''}`)

    const url = `${process.env.SUPABASE_URL ? '' : ''}/lovable/email/transactional/send`
    // In server-fn handler we can call the same-origin route via fetch on the request host.
    // TanStack server fns run on the same Worker as the route, so a relative URL works.
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        templateName: templateKey,
        recipientEmail: order.client_email,
        idempotencyKey: `${templateKey}-${order.id}`,
        templateData: {
          clientName: order.client_name ?? 'клиент',
          orderId: String(order.id).slice(0, 8),
          total: Number(order.total ?? 0),
          eventDate: order.event_date,
        },
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, status: res.status, error: (json as any)?.error ?? 'send failed' }
    }
    return { ok: true, queued: true }
  })
