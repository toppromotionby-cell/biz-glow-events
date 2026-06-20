/**
 * Email style regression suite.
 *
 * Renders every registered template (transactional, order-status, auth) to
 * static HTML via @react-email/render and asserts:
 *   1. Единый тёмный каркас (фон #0a0a0a, surface #141414, бренд-акценты).
 *   2. Совместимость с почтовыми клиентами (Gmail / Outlook / Apple Mail /
 *      Yandex / Mail.ru): только inline-стили, без CSS-переменных, без
 *      внешних stylesheet, <script>, position:fixed и т.п.
 *   3. Подпись и контакты event-hub.by во всех письмах.
 *
 * Запускается частью обычного `bun run test` — любая регрессия стиля
 * ловится до публикации.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/components'
import React from 'react'

import { TEMPLATES } from './registry'
import SignupEmail from './signup'
import MagicLinkEmail from './magic-link'
import RecoveryEmail from './recovery'
import InviteEmail from './invite'
import EmailChangeEmail from './email-change'
import ReauthenticationEmail from './reauthentication'
import { EMAIL_TOKENS } from './_shared'

interface Case {
  key: string
  element: React.ReactElement
}

const SITE = { siteName: 'event-hub.by', siteUrl: 'https://event-hub.by' }
const URL = 'https://event-hub.by/auth/callback?token=test'

function buildCases(): Case[] {
  const cases: Case[] = []
  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    const Comp = tpl.component
    cases.push({ key, element: React.createElement(Comp, tpl.previewData ?? {}) })
  }
  cases.push({
    key: 'auth:signup',
    element: React.createElement(SignupEmail, { ...SITE, recipient: 'user@example.com', confirmationUrl: URL }),
  })
  cases.push({
    key: 'auth:magic-link',
    element: React.createElement(MagicLinkEmail, { siteName: SITE.siteName, confirmationUrl: URL }),
  })
  cases.push({
    key: 'auth:recovery',
    element: React.createElement(RecoveryEmail, { siteName: SITE.siteName, confirmationUrl: URL }),
  })
  cases.push({
    key: 'auth:invite',
    element: React.createElement(InviteEmail, { ...SITE, confirmationUrl: URL }),
  })
  cases.push({
    key: 'auth:email-change',
    element: React.createElement(EmailChangeEmail, {
      siteName: SITE.siteName,
      oldEmail: 'old@example.com',
      email: 'new@example.com',
      newEmail: 'new@example.com',
      confirmationUrl: URL,
    }),
  })
  cases.push({
    key: 'auth:reauthentication',
    element: React.createElement(ReauthenticationEmail, { token: '123456' }),
  })
  return cases
}

const cases = buildCases()

async function renderHtml(c: Case) {
  return render(c.element)
}

describe('Email templates — единый тёмный стиль', () => {
  it.each(cases.map((c) => [c.key, c]))('%s содержит тёмные брендовые токены', async (_key, c) => {
    const html = (await renderHtml(c as Case)).toLowerCase()

    // Тёмные базовые цвета каркаса.
    expect(html, 'фон body должен быть тёмный').toContain(EMAIL_TOKENS.BG.toLowerCase())
    expect(html, 'surface-карточка должна присутствовать').toContain(EMAIL_TOKENS.SURFACE.toLowerCase())
    expect(html, 'основной текстовый цвет — светлый').toContain(EMAIL_TOKENS.TEXT.toLowerCase())

    // Запрещённые остатки прежней светлой темы.
    expect(html, 'не должно остаться сплошного белого фона').not.toMatch(
      /background(?:-color)?\s*:\s*#fff(?:fff)?\b/,
    )
    expect(html, 'не должно остаться фиолетового акцента старого admin-варианта').not.toContain('#a78bfa')
  })

  it.each(cases.map((c) => [c.key, c]))(
    '%s содержит подпись/контакты event-hub.by',
    async (_key, c) => {
      const html = await renderHtml(c as Case)
      expect(html).toContain('event-hub.by')
      // Footer обязателен → телефон/телеграм рендерятся EmailFooter.
      expect(html).toMatch(/\+375\s?44\s?709-?91-?22/)
    },
  )
})

describe('Email templates — совместимость с почтовыми клиентами', () => {
  it.each(cases.map((c) => [c.key, c]))(
    '%s не использует конструкций, ломающих Gmail/Outlook',
    async (_key, c) => {
      const html = await renderHtml(c as Case)

      // Outlook/Gmail не поддерживают CSS-переменные → токены должны быть
      // развёрнуты в значения на этапе рендера.
      expect(html, 'CSS-переменные var(--…) не поддерживаются Outlook').not.toMatch(/var\(--/)

      // Никаких внешних таблиц стилей или скриптов.
      expect(html).not.toMatch(/<link[^>]+stylesheet/i)
      expect(html).not.toMatch(/<script\b/i)

      // position:fixed/sticky и iframe также режутся почтовиками.
      expect(html).not.toMatch(/position\s*:\s*(fixed|sticky)/i)
      expect(html).not.toMatch(/<iframe\b/i)

      // Размер письма для Gmail (clip-предупреждение ~102KB).
      expect(html.length).toBeLessThan(100 * 1024)
    },
  )
})

describe('Email templates — снапшоты HTML (регресс)', () => {
  // Один общий снапшот: любое изменение каркаса/токенов будет видно в diff.
  it('структура всех шаблонов стабильна', async () => {
    const rendered: Record<string, string> = {}
    for (const c of cases) {
      rendered[c.key] = await renderHtml(c)
    }
    expect(rendered).toMatchSnapshot()
  })
})
