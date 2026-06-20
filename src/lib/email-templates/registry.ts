import type { ComponentType } from 'react'
import { template as adminOrderTemplate } from './admin-order'
import { template as adminLeadTemplate } from './admin-lead'
import { template as clientInviteTemplate } from './client-invite'
import { template as orderConfirmedTemplate } from './order-confirmed'
import { template as orderPaidTemplate } from './order-paid'
import { template as orderCompletedTemplate } from './order-completed'
import { template as orderCancelledTemplate } from './order-cancelled'

export type TemplateCategory = 'transactional' | 'auth' | 'order-status'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
  /** Human descriptions of available variables for the admin UI. */
  variables?: Record<string, string>
  /** Used for grouping in the admin templates page. */
  category?: TemplateCategory
}

export const COMMON_VARS = {
  clientName: 'Имя клиента',
  orderId: 'ID заказа',
  total: 'Сумма заказа (число)',
  eventDate: 'Дата мероприятия',
  manageUrl: 'Ссылка на личный кабинет',
}

/**
 * Template registry — maps template names to their React Email components.
 *
 * Includes transactional templates (admin/client) and order-status notifications.
 * Auth templates (signup/recovery/etc.) live in separate files and are
 * exposed for the admin editor via AUTH_TEMPLATE_META below.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-order': {
    ...adminOrderTemplate,
    category: 'transactional',
    variables: {
      orderId: 'ID заказа',
      clientName: 'Имя клиента',
      clientPhone: 'Телефон клиента',
      clientEmail: 'Email клиента',
      clientCompany: 'Компания',
      total: 'Сумма (число)',
      eventDate: 'Дата мероприятия',
      source: 'Источник заказа',
      notes: 'Комментарий клиента',
    },
  },
  'admin-lead': {
    ...adminLeadTemplate,
    category: 'transactional',
    variables: {
      leadId: 'ID заявки',
      clientName: 'Имя клиента',
      clientPhone: 'Телефон клиента',
      clientEmail: 'Email клиента',
      source: 'Источник заявки',
      notes: 'Комментарий клиента',
    },
  },
  'client-invite': {
    ...clientInviteTemplate,
    category: 'transactional',
    variables: {
      recipientName: 'Имя получателя',
      personalMessage: 'Персональное сообщение',
    },
  },
  'order-confirmed': {
    ...orderConfirmedTemplate,
    category: 'order-status',
    variables: COMMON_VARS,
  },
  'order-paid': {
    ...orderPaidTemplate,
    category: 'order-status',
    variables: { clientName: 'Имя клиента', orderId: 'ID заказа', total: 'Сумма' },
  },
  'order-completed': {
    ...orderCompletedTemplate,
    category: 'order-status',
    variables: { clientName: 'Имя клиента', orderId: 'ID заказа', reviewUrl: 'Ссылка для отзыва' },
  },
  'order-cancelled': {
    ...orderCancelledTemplate,
    category: 'order-status',
    variables: { clientName: 'Имя клиента', orderId: 'ID заказа', reason: 'Причина отмены' },
  },
}

/**
 * Auth templates: not in TEMPLATES because they're rendered by the auth
 * webhook with fixed props. This metadata drives the admin editor.
 */
export const AUTH_TEMPLATE_META: Record<
  string,
  { displayName: string; defaultSubject: string; variables: Record<string, string> }
> = {
  signup: {
    displayName: 'Auth: подтверждение регистрации',
    defaultSubject: 'Confirm your email',
    variables: {
      siteName: 'Название сайта',
      siteUrl: 'URL сайта',
      recipient: 'Email получателя',
      confirmationUrl: 'Ссылка подтверждения',
    },
  },
  magiclink: {
    displayName: 'Auth: magic link',
    defaultSubject: 'Your login link',
    variables: {
      siteName: 'Название сайта',
      confirmationUrl: 'Ссылка для входа',
      email: 'Email получателя',
    },
  },
  recovery: {
    displayName: 'Auth: восстановление пароля',
    defaultSubject: 'Reset your password',
    variables: {
      siteName: 'Название сайта',
      confirmationUrl: 'Ссылка сброса пароля',
      email: 'Email получателя',
    },
  },
  invite: {
    displayName: 'Auth: приглашение',
    defaultSubject: "You've been invited",
    variables: {
      siteName: 'Название сайта',
      confirmationUrl: 'Ссылка приглашения',
      email: 'Email получателя',
    },
  },
  email_change: {
    displayName: 'Auth: смена email',
    defaultSubject: 'Confirm your new email',
    variables: {
      siteName: 'Название сайта',
      confirmationUrl: 'Ссылка подтверждения',
      oldEmail: 'Старый email',
      newEmail: 'Новый email',
    },
  },
  reauthentication: {
    displayName: 'Auth: повторная аутентификация',
    defaultSubject: 'Your verification code',
    variables: {
      siteName: 'Название сайта',
      token: 'Код подтверждения',
    },
  },
}
