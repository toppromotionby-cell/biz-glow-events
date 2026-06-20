// Server functions for admin email-template editor.
// All functions are admin/manager-gated via has_role().
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import {
  applyPlaceholders,
  renderDefault,
  sanitizeEmailHtml,
} from '@/lib/email-templates/render-with-override'
import { TEMPLATES, AUTH_TEMPLATE_META, type TemplateCategory } from '@/lib/email-templates/registry'

const AUTH_KEYS = Object.keys(AUTH_TEMPLATE_META)
const ALL_KEYS = [...Object.keys(TEMPLATES), ...AUTH_KEYS]

export interface TemplateInfo {
  key: string
  category: TemplateCategory
  displayName: string
  defaultSubject: string
  variables: Record<string, string>
  override: {
    subject: string
    preheader: string
    html_body: string
    enabled: boolean
    updated_at: string | null
    updated_by: string | null
  } | null
}

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
  if (error) throw new Error('Не удалось проверить роль')
  const roles = (data ?? []).map((r: { role: string }) => r.role)
  if (!roles.includes('admin') && !roles.includes('manager')) {
    throw new Error('Доступ запрещён')
  }
}

function defaultsFor(key: string): { displayName: string; defaultSubject: string; variables: Record<string, string>; category: TemplateCategory } {
  const t = TEMPLATES[key]
  if (t) {
    return {
      displayName: t.displayName ?? key,
      defaultSubject: typeof t.subject === 'function' ? t.subject(t.previewData ?? {}) : t.subject,
      variables: t.variables ?? {},
      category: t.category ?? 'transactional',
    }
  }
  const a = AUTH_TEMPLATE_META[key]
  if (a) {
    return {
      displayName: a.displayName,
      defaultSubject: a.defaultSubject,
      variables: a.variables,
      category: 'auth',
    }
  }
  return { displayName: key, defaultSubject: '', variables: {}, category: 'transactional' }
}

export const listEmailTemplates = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId)
    const { data, error } = await context.supabase
      .from('email_templates')
      .select('template_key, subject, preheader, html_body, enabled, updated_at, updated_by')
    if (error) throw new Error(error.message)
    const overrides = new Map<string, any>((data ?? []).map((r: any) => [r.template_key, r]))
    const result: TemplateInfo[] = ALL_KEYS.map((key) => {
      const def = defaultsFor(key)
      const ov = overrides.get(key)
      return {
        key,
        category: def.category,
        displayName: def.displayName,
        defaultSubject: def.defaultSubject,
        variables: def.variables,
        override: ov
          ? {
              subject: ov.subject ?? '',
              preheader: ov.preheader ?? '',
              html_body: ov.html_body ?? '',
              enabled: ov.enabled,
              updated_at: ov.updated_at,
              updated_by: ov.updated_by,
            }
          : null,
      }
    })
    return result
  })

export const getEmailTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const def = defaultsFor(data.key)
    if (!ALL_KEYS.includes(data.key)) throw new Error('Шаблон не найден')

    const { data: row, error } = await context.supabase
      .from('email_templates')
      .select('subject, preheader, html_body, enabled, updated_at, updated_by')
      .eq('template_key', data.key)
      .maybeSingle()
    if (error) throw new Error(error.message)

    // Default HTML preview (used as starting point in editor when no override)
    let defaultHtml = ''
    try {
      const previewData = TEMPLATES[data.key]?.previewData ?? {}
      const rendered = await renderDefault(data.key, previewData)
      defaultHtml = rendered.html
    } catch {
      defaultHtml = ''
    }

    return {
      key: data.key,
      category: def.category,
      displayName: def.displayName,
      defaultSubject: def.defaultSubject,
      defaultHtml,
      variables: def.variables,
      previewData: TEMPLATES[data.key]?.previewData ?? {},
      override: row ?? null,
    }
  })

const saveSchema = z.object({
  key: z.string().min(1),
  subject: z.string().trim().min(1, 'Тема обязательна').max(200),
  preheader: z.string().max(200).default(''),
  html_body: z.string().min(10, 'Тело письма слишком короткое').max(200_000),
  enabled: z.boolean().default(true),
})

export const saveEmailTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    if (!ALL_KEYS.includes(data.key)) throw new Error('Шаблон не найден')

    const def = defaultsFor(data.key)
    const sanitizedHtml = sanitizeEmailHtml(data.html_body)

    const { error } = await context.supabase.from('email_templates').upsert({
      template_key: data.key,
      category: def.category,
      subject: data.subject,
      preheader: data.preheader,
      html_body: sanitizedHtml,
      enabled: data.enabled,
      updated_by: context.userId,
    }, { onConflict: 'template_key' })
    if (error) throw new Error(error.message)
    return { ok: true, sanitizedHtml }
  })

export const resetEmailTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const { error } = await context.supabase
      .from('email_templates')
      .delete()
      .eq('template_key', data.key)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

const previewSchema = z.object({
  key: z.string().min(1),
  subject: z.string().max(200).optional(),
  preheader: z.string().max(200).optional(),
  html_body: z.string().max(200_000).optional(),
  data: z.record(z.any()).optional(),
})

export const previewEmailTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => previewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    const def = defaultsFor(data.key)
    const previewData = data.data ?? TEMPLATES[data.key]?.previewData ?? {}
    if (data.html_body && data.html_body.trim().length > 0) {
      const subjectRendered = applyPlaceholders(data.subject ?? def.defaultSubject, previewData)
      const safe = sanitizeEmailHtml(applyPlaceholders(data.html_body, previewData))
      return { subject: subjectRendered, html: safe, source: 'draft' as const }
    }
    const rendered = await renderDefault(data.key, previewData)
    return { subject: rendered.subject, html: rendered.html, source: 'default' as const }
  })

const testSendSchema = z.object({
  key: z.string().min(1),
  recipient: z.string().email(),
  subject: z.string().max(200).optional(),
  preheader: z.string().max(200).optional(),
  html_body: z.string().max(200_000).optional(),
})

/**
 * Send a test version of a template to a specific recipient.
 * Uses the draft subject/body if provided (without saving), otherwise the saved override or default.
 * Bypasses suppression list because admin explicitly opted in.
 */
export const sendTestEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => testSendSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId)
    if (!ALL_KEYS.includes(data.key)) throw new Error('Шаблон не найден')

    const def = defaultsFor(data.key)
    const previewData = TEMPLATES[data.key]?.previewData ?? {}

    let subject: string
    let html: string
    let text: string
    if (data.html_body && data.html_body.trim().length > 0) {
      subject = applyPlaceholders(data.subject ?? def.defaultSubject, previewData)
      html = sanitizeEmailHtml(applyPlaceholders(data.html_body, previewData))
      text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    } else {
      const rendered = await renderDefault(data.key, previewData)
      subject = rendered.subject
      html = rendered.html
      text = rendered.text
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const messageId = crypto.randomUUID()
    const FROM = 'event-hub.by <noreply@event-hub.by>'
    const SENDER_DOMAIN = 'notify.event-hub.by'

    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: `${data.key}__test`,
      recipient_email: data.recipient,
      status: 'pending',
    })

    const { error } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: data.recipient,
        from: FROM,
        reply_to: 'noreply@event-hub.by',
        sender_domain: SENDER_DOMAIN,
        subject: `[ТЕСТ] ${subject}`,
        html,
        text,
        purpose: 'transactional',
        label: `${data.key}__test`,
        idempotency_key: `test-${data.key}-${messageId}`,
        queued_at: new Date().toISOString(),
      },
    })

    if (error) {
      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: `${data.key}__test`,
        recipient_email: data.recipient,
        status: 'failed',
        error_message: error.message,
      })
      throw new Error('Не удалось поставить тест в очередь: ' + error.message)
    }
    return { ok: true, messageId }
  })
