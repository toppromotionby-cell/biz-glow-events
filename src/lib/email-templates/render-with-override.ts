// Email rendering with admin-editable overrides.
// Looks up an override row in `email_templates` and applies Mustache-style
// substitution + HTML sanitization. Falls back to the React Email component
// from the registry when no enabled override exists.
import * as React from 'react'
import { render } from '@react-email/components'
import DOMPurify from 'isomorphic-dompurify'
import { TEMPLATES, AUTH_TEMPLATE_META } from './registry'

export interface RenderResult {
  subject: string
  html: string
  text: string
  source: 'override' | 'default'
}

function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return ''
  const s = String(input)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Replace `{{var}}` placeholders with HTML-escaped values from `data`.
 * Unknown placeholders are removed (replaced with empty string).
 */
export function applyPlaceholders(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g, (_, key: string) => {
    const path = key.split('.')
    let value: unknown = data
    for (const part of path) {
      if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[part]
      } else {
        value = undefined
        break
      }
    }
    return escapeHtml(value)
  })
}

const SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    'html', 'head', 'body', 'meta', 'title', 'style',
    'div', 'span', 'p', 'br', 'hr', 'a', 'img',
    'strong', 'b', 'em', 'i', 'u', 'small', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'blockquote', 'pre', 'code',
    'center', 'font',
  ] as string[],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'style', 'class', 'id',
    'width', 'height', 'border', 'align', 'valign',
    'cellpadding', 'cellspacing', 'bgcolor', 'color', 'face', 'size',
    'target', 'rel', 'name', 'role',
  ] as string[],
  ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|cid:|#|\/)/i,
  WHOLE_DOCUMENT: true,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'] as string[],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onsubmit'] as string[],
}

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_OPTS) as unknown as string
}

interface OverrideRow {
  template_key: string
  subject: string
  preheader: string | null
  html_body: string
  enabled: boolean
}

/**
 * Render a template, preferring an admin-editable override when enabled.
 * Falls back to the registered React component otherwise.
 *
 * `loadOverride` is injected so the helper stays decoupled from supabase imports.
 */
export async function renderWithOverride(
  templateKey: string,
  data: Record<string, unknown>,
  loadOverride: (key: string) => Promise<OverrideRow | null>,
): Promise<RenderResult> {
  const override = await loadOverride(templateKey)
  if (override && override.enabled && override.html_body.trim().length > 0) {
    const subject = applyPlaceholders(override.subject || '', data)
    const preheader = override.preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(
          applyPlaceholders(override.preheader, data),
        )}</div>`
      : ''
    const bodyWithVars = applyPlaceholders(override.html_body, data)
    const safe = sanitizeEmailHtml(bodyWithVars.includes('<body')
      ? bodyWithVars.replace(/<body([^>]*)>/i, (m) => `${m}${preheader}`)
      : `<!doctype html><html><body>${preheader}${bodyWithVars}</body></html>`)
    return {
      subject: subject || resolveDefaultSubject(templateKey, data),
      html: safe,
      text: stripHtml(safe),
      source: 'override',
    }
  }

  return renderDefault(templateKey, data)
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveDefaultSubject(templateKey: string, data: Record<string, unknown>): string {
  const entry = TEMPLATES[templateKey]
  if (entry) {
    return typeof entry.subject === 'function' ? entry.subject(data) : entry.subject
  }
  const auth = AUTH_TEMPLATE_META[templateKey]
  return auth?.defaultSubject ?? 'Notification'
}

export async function renderDefault(
  templateKey: string,
  data: Record<string, unknown>,
  authComponent?: React.ComponentType<any>,
  authSubject?: string,
): Promise<RenderResult> {
  const entry = TEMPLATES[templateKey]
  if (entry) {
    const element = React.createElement(entry.component, data)
    const html = await render(element)
    const text = await render(element, { plainText: true })
    const subject = typeof entry.subject === 'function' ? entry.subject(data) : entry.subject
    return { subject, html, text, source: 'default' }
  }
  if (authComponent) {
    const element = React.createElement(authComponent, data)
    const html = await render(element)
    const text = await render(element, { plainText: true })
    return {
      subject: authSubject ?? AUTH_TEMPLATE_META[templateKey]?.defaultSubject ?? 'Notification',
      html,
      text,
      source: 'default',
    }
  }
  throw new Error(`Unknown template: ${templateKey}`)
}
