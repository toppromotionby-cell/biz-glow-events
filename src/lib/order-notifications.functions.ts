// Server function for sending order-status notification emails to clients.
// Called from admin UI when an order's status changes.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { renderWithOverride } from '@/lib/email-templates/render-with-override'
import { resolveSender } from '@/lib/email/sender.server'

const STATUS_TO_TEMPLATE: Record<string, string> = {
  confirmed: 'order-confirmed',
  paid: 'order-paid',
  completed: 'order-completed',
  cancelled: 'order-cancelled',
}

const FROM_ADDRESS = 'event-hub.by <noreply@event-hub.by>'
const REPLY_TO = 'noreply@event-hub.by'
const SENDER_DOMAIN = 'notify.event-hub.by'

export const notifyOrderStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orderId: z.string().uuid(), status: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
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
      .select('id, order_number, client_name, client_email, total, event_date')
      .eq('id', data.orderId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!order || !order.client_email) {
      return { ok: false, skipped: true, reason: 'no client_email' }
    }

    // Skip if recipient is suppressed
    const recipient = String(order.client_email).toLowerCase()
    const { data: suppressed } = await supabaseAdmin
      .from('suppressed_emails')
      .select('id')
      .eq('email', recipient)
      .maybeSingle()
    if (suppressed) return { ok: false, skipped: true, reason: 'suppressed' }

    const templateData = {
      clientName: order.client_name ?? 'клиент',
      orderId: (order.order_number ?? '').trim() || String(order.id).slice(0, 8),
      total: Number(order.total ?? 0),
      eventDate: order.event_date,
    }

    const rendered = await renderWithOverride(templateKey, templateData, async (key) => {
      const { data: row } = await supabaseAdmin
        .from('email_templates')
        .select('template_key, subject, preheader, html_body, enabled')
        .eq('template_key', key)
        .maybeSingle()
      return row as any
    })

    const messageId = crypto.randomUUID()
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateKey,
      recipient_email: recipient,
      status: 'pending',
    })

    const sender = await resolveSender('orders')

    const { error: enqueueErr } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: recipient,
        from: sender.from,
        reply_to: sender.replyTo,
        sender_domain: SENDER_DOMAIN,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        purpose: 'transactional',
        label: templateKey,
        idempotency_key: `${templateKey}-${order.id}`,
        queued_at: new Date().toISOString(),
      },
    })
    if (enqueueErr) {
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateKey,
        recipient_email: recipient,
        status: 'failed',
        error_message: enqueueErr.message,
      })
      throw new Error('Не удалось поставить письмо в очередь')
    }
    return { ok: true, messageId }
  })
