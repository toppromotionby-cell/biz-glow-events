// Admin: editor for all site-sent email templates (transactional / auth / order status).
// Lets staff override subject/preheader/HTML body per template, with live preview
// (debounced iframe srcDoc) and test-send.
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminKeys } from "@/lib/query-keys";
import { invalidateEntity } from "@/lib/admin/invalidate";
import { useAutoSaveDraft, readDraft, clearDraft } from "@/lib/admin/use-autosave-draft";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { SaveStatus } from "@/components/admin/SaveStatus";
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import {
  listEmailTemplates,
  getEmailTemplate,
  saveEmailTemplate,
  resetEmailTemplate,
  previewEmailTemplate,
  sendTestEmail,
} from '@/lib/email-templates.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmailSendersPanel } from '@/components/admin/EmailSendersPanel'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Mail, RotateCcw, Save, Send, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/settings/emails')({
  head: () => ({ meta: [{ title: 'Шаблоны писем — Админ' }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: EmailTemplatesAdmin,
})

const CATEGORY_LABEL: Record<string, string> = {
  all: 'Все',
  transactional: 'Сайт',
  auth: 'Auth',
  'order-status': 'Статусы заказа',
}
const CATEGORY_BADGE: Record<string, string> = {
  transactional: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  auth: 'bg-purple-500/15 text-purple-600 dark:text-purple-300',
  'order-status': 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
}

function EmailTemplatesAdmin() {
  const qc = useQueryClient()
  const listFn = useServerFn(listEmailTemplates)
  const getFn = useServerFn(getEmailTemplate)
  const saveFn = useServerFn(saveEmailTemplate)
  const resetFn = useServerFn(resetEmailTemplate)
  const previewFn = useServerFn(previewEmailTemplate)
  const testFn = useServerFn(sendTestEmail)

  const [category, setCategory] = useState<string>('all')

  const [view, setView] = useState('templates')
  const [selected, setSelected] = useState<string | null>(null)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftPreheader, setDraftPreheader] = useState('')
  const [draftHtml, setDraftHtml] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [testOpen, setTestOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  const listQuery = useQuery({ queryKey: adminKeys.emailTemplates, queryFn: () => listFn() })

  const filtered = useMemo(() => {
    const items = listQuery.data ?? []
    if (category === 'all') return items
    return items.filter((t) => t.category === category)
  }, [listQuery.data, category])

  useEffect(() => {
    if (!selected && filtered.length > 0) setSelected(filtered[0].key)
  }, [filtered, selected])

  const detailQuery = useQuery({
    queryKey: adminKeys.emailTemplate(selected),
    enabled: !!selected,
    queryFn: () => getFn({ data: { key: selected! } }),
  })

  // Sync editor with loaded data. Черновик из localStorage имеет приоритет:
  // шаблоны писем сохраняются кнопкой, поэтому правки не должны теряться.
  const draftKey = `email-template:${selected ?? 'none'}`
  const [serverSnapshot, setServerSnapshot] = useState('')
  useEffect(() => {
    const d = detailQuery.data
    if (!d) return
    const server = {
      subject: d.override?.subject ?? d.defaultSubject ?? '',
      preheader: d.override?.preheader ?? '',
      html: d.override?.html_body ?? d.defaultHtml ?? '',
      enabled: d.override?.enabled ?? true,
    }
    const draft = readDraft<typeof server>(draftKey)
    const next = draft ?? server
    setServerSnapshot(JSON.stringify(server))
    setDraftSubject(next.subject)
    setDraftPreheader(next.preheader)
    setDraftHtml(next.html)
    setEnabled(next.enabled)
    if (draft) toast.info('Восстановлен несохранённый черновик шаблона')
  }, [detailQuery.data, draftKey])

  const current = useMemo(
    () => ({ subject: draftSubject, preheader: draftPreheader, html: draftHtml, enabled }),
    [draftSubject, draftPreheader, draftHtml, enabled],
  )
  const dirty = !!serverSnapshot && JSON.stringify(current) !== serverSnapshot
  const { savedAt: draftSavedAt } = useAutoSaveDraft(draftKey, current, { enabled: dirty })
  const { guardDialog } = useUnsavedGuard(dirty)

  // Debounced live preview
  useEffect(() => {
    if (!selected) return
    const t = setTimeout(async () => {
      try {
        const r = await previewFn({
          data: { key: selected, subject: draftSubject, preheader: draftPreheader, html_body: draftHtml },
        })
        setPreviewHtml(r.html)
        setPreviewSubject(r.subject)
      } catch (e: any) {
        setPreviewHtml(`<pre style="padding:16px;color:#dc2626">Ошибка превью: ${e?.message ?? e}</pre>`)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [selected, draftSubject, draftPreheader, draftHtml, previewFn])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return
      await saveFn({
        data: {
          key: selected,
          subject: draftSubject,
          preheader: draftPreheader,
          html_body: draftHtml,
          enabled,
        },
      })
    },
    onSuccess: () => {
      toast.success('Шаблон сохранён')
      clearDraft(draftKey)
      setServerSnapshot(JSON.stringify(current))
      invalidateEntity(qc, 'emails')
      qc.invalidateQueries({ queryKey: adminKeys.emailTemplate(selected) })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Не удалось сохранить'),
  })


  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return
      await resetFn({ data: { key: selected } })
    },
    onSuccess: () => {
      toast.success('Сброшено к шаблону по умолчанию')
      clearDraft(draftKey)
      invalidateEntity(qc, 'emails')
      qc.invalidateQueries({ queryKey: adminKeys.emailTemplate(selected) })
    },

    onError: (e: any) => toast.error(e?.message ?? 'Не удалось сбросить'),
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return
      await testFn({
        data: {
          key: selected,
          recipient: testEmail,
          subject: draftSubject,
          preheader: draftPreheader,
          html_body: draftHtml,
        },
      })
    },
    onSuccess: () => {
      toast.success('Тест отправлен — проверь ящик через 10–30 сек')
      setTestOpen(false)
    },
    onError: (e: any) => toast.error(e?.message ?? 'Не удалось отправить тест'),
  })

  const currentMeta = listQuery.data?.find((t) => t.key === selected)

  return (
    <div className="space-y-4">
      {guardDialog}
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="admin-h1 flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" /> Шаблоны писем
        </h1>
        <Badge variant="outline" className="ml-2">{listQuery.data?.length ?? 0} шаблонов</Badge>
      </header>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
          <TabsTrigger value="senders">Отправители</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'senders' && <EmailSendersPanel />}

      <div className={view === 'senders' ? 'hidden' : 'space-y-4'}>
      <Tabs value={category} onValueChange={setCategory}>
        <TabsList>
          {Object.keys(CATEGORY_LABEL).map((k) => (
            <TabsTrigger key={k} value={k}>{CATEGORY_LABEL[k]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Список шаблонов */}
        <aside className="rounded-lg border border-border/60 bg-card/40 p-2 max-h-[70vh] overflow-y-auto">
          {listQuery.isLoading && <div className="p-3 text-sm text-muted-foreground">Загрузка…</div>}
          {filtered.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelected(t.key)}
              className={cn(
                'w-full text-left p-2.5 rounded-md hover:bg-muted/60 transition flex flex-col gap-1 mb-1',
                selected === t.key && 'bg-muted',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{t.displayName}</span>
                {t.override && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-semibold">
                    редакт.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', CATEGORY_BADGE[t.category])}>
                  {CATEGORY_LABEL[t.category]}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">{t.key}</span>
              </div>
            </button>
          ))}
        </aside>

        {/* Редактор */}
        {selected && detailQuery.data ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold">{currentMeta?.displayName}</h2>
                <p className="text-xs text-muted-foreground">
                  Ключ: <code>{selected}</code> · Категория: {CATEGORY_LABEL[currentMeta?.category ?? 'transactional']}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
                  <Label htmlFor="enabled" className="text-sm">Включён</Label>
                </div>
                <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                  <Send className="h-4 w-4 mr-1.5" /> Тест
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Сбросить шаблон к версии по умолчанию?')) resetMutation.mutate()
                  }}
                  disabled={!detailQuery.data.override}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Сбросить
                </Button>
                <SaveStatus
                  state={saveMutation.isPending ? 'saving' : dirty ? 'dirty' : 'idle'}
                  draftSavedAt={draftSavedAt}
                />
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dirty}>
                  <Save className="h-4 w-4 mr-1.5" /> Сохранить
                </Button>

              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="subj">Тема письма</Label>
                <Input id="subj" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prehdr">Preheader (превью в инбоксе)</Label>
                <Input id="prehdr" value={draftPreheader} onChange={(e) => setDraftPreheader(e.target.value)} maxLength={200} />
              </div>
            </div>

            <div className="grid-fields">
              <div className="space-y-1.5">
                <Label htmlFor="html">HTML тело письма</Label>
                <Textarea
                  id="html"
                  value={draftHtml}
                  onChange={(e) => setDraftHtml(e.target.value)}
                  className="font-mono text-xs min-h-[420px] resize-y leading-relaxed"
                  spellCheck={false}
                />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  HTML санитизируется сервером: <code>&lt;script&gt;</code>, <code>&lt;iframe&gt;</code> и обработчики событий запрещены.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Превью · тема: <span className="font-normal italic">{previewSubject || '—'}</span>
                </Label>
                <div className="rounded-md border border-border/60 bg-white overflow-hidden h-[420px]">
                  <iframe title="email-preview" srcDoc={previewHtml} className="w-full h-full" sandbox="" />
                </div>
              </div>
            </div>

            {Object.keys(currentMeta?.variables ?? {}).length > 0 && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="text-xs font-semibold mb-2">Доступные переменные (клик — скопировать <code>{'{{key}}'}</code>)</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(currentMeta!.variables).map(([key, desc]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${key}}}`)
                        toast.success(`Скопировано: {{${key}}}`)
                      }}
                      className="text-[11px] bg-background hover:bg-accent border border-border rounded px-2 py-1 transition"
                      title={desc}
                    >
                      <code>{`{{${key}}}`}</code>
                      <span className="text-muted-foreground ml-1.5">— {desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
            Выберите шаблон слева
          </div>
        )}
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить тест</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="test-email">Email получателя</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Тестовое письмо использует текущие черновые значения (без сохранения) и помечается префиксом «[ТЕСТ]».
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestOpen(false)}>Отмена</Button>
            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !testEmail.includes('@')}
            >
              <Send className="h-4 w-4 mr-1.5" /> Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
