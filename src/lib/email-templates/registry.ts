import type { ComponentType } from 'react'
import { template as adminOrderTemplate } from './admin-order'
import { template as adminLeadTemplate } from './admin-lead'
import { template as clientInviteTemplate } from './client-invite'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-order': adminOrderTemplate,
  'admin-lead': adminLeadTemplate,
  'client-invite': clientInviteTemplate,
}
