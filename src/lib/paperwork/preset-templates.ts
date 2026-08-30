// Встроенные («заводские») шаблоны документов. Используются в каталоге
// шаблонов: их можно применить сразу или сохранить копию в библиотеку.
import { normalizeBlock, type PwBlock, type PwCategory, type PwDocType } from "@/lib/paperwork/model";
import { currentPeriod } from "@/lib/paperwork/hr/model";
import {
  PAYROLL_HEADER,
  STAFFING_HEADER,
  timesheetHeader,
} from "@/lib/paperwork/hr/tables";

import { LOAN_PRESETS } from "@/lib/paperwork/loan-presets";
import { ATTORNEY_PRESETS } from "@/lib/paperwork/attorney-presets";
import { WORKACT_PRESETS } from "@/lib/paperwork/workact-preset";
import { ORDER_PRESETS } from "@/lib/paperwork/order-presets";
import { PROTOCOL_PRESETS } from "@/lib/paperwork/protocol-presets";
import { STATEMENT_PRESETS } from "@/lib/paperwork/statement-presets";

export type { PwPreset } from "@/lib/paperwork/preset-types";
import type { PwPreset } from "@/lib/paperwork/preset-types";


const B = {
  h: (text: string, align: "left" | "center" = "center") => normalizeBlock({ type: "heading", text, align }),
  p: (text: string, indent = true) =>
    normalizeBlock({ type: "paragraph", text, align: "justify", indent }),
  rec: (text: string) => normalizeBlock({ type: "recipient", text, align: "right" }),
  list: (items: string[], ordered = false) => normalizeBlock({ type: "list", items, ordered }),
  table: (header: string[], rows: string[][]) => normalizeBlock({ type: "table", header, rows }),
  sign: (title = "{{Должность подписанта}}", name = "{{ФИО директора}}", withStamp = true) =>
    normalizeBlock({ type: "signature", signerTitle: title, signerName: name, withStamp }),
  gap: (size = 16) => normalizeBlock({ type: "spacer", size }),
  note: (text: string) => normalizeBlock({ type: "note", text }),
};

export const PW_PRESETS: PwPreset[] = [
  {
    id: "letter-standard",
    name: "Письмо стандартное",
    description: "Деловое письмо на фирменном бланке с обращением и подписью.",
    category: "letters",
    doc_type: "letter",
    blocks: [
      B.rec("{{Должность получателя}}\n{{Организация получателя}}\n{{ФИО получателя}}"),
      B.h("Информационное письмо"),
      B.p("Уважаемый(ая) {{ФИО получателя}}!", false),
      B.p("Настоящим письмом {{Компания}} сообщает: {{Текст письма}}."),
      B.p("По всем вопросам вы можете связаться с нами по телефону {{Телефон}} или по адресу {{Email}}.", false),
      B.gap(18),
      B.sign(),
    ],
  },
  {
    id: "letter-official",
    name: "Письмо официальное",
    description: "Официальное обращение с исходящим номером и перечнем приложений.",
    category: "letters",
    doc_type: "letter",
    blocks: [
      B.rec("{{Организация получателя}}\n{{Должность получателя}}\n{{ФИО получателя}}"),
      B.h("О {{Тема письма}}"),
      B.p("Уважаемый(ая) {{ФИО получателя}}!", false),
      B.p("{{Компания}} (УНП {{УНП}}) в лице {{Должность подписанта}} {{ФИО директора}} направляет настоящее письмо по вопросу {{Тема письма}}."),
      B.p("{{Текст письма}}"),
      B.h("Приложения", "left"),
      B.list(["{{Приложение 1}}", "{{Приложение 2}}"], true),
      B.gap(18),
      B.sign(),
    ],
  },
  {
    id: "letter-head",
    name: "Письмо руководителя",
    description: "Короткое письмо от первого лица компании.",
    category: "letters",
    doc_type: "letter",
    blocks: [
      B.rec("{{ФИО получателя}}"),
      B.p("Уважаемый(ая) {{ФИО получателя}}!", false),
      B.p("{{Текст письма}}"),
      B.p("С уважением,", false),
      B.gap(14),
      B.sign(),
    ],
  },
  {
    id: "order-appointment",
    name: "Приказ о назначении",
    description: "Приказ по личному составу с констатирующей и распорядительной частью.",
    category: "orders",
    doc_type: "order",
    blocks: [
      B.h("ПРИКАЗ № {{Номер документа}}"),
      B.p("г. {{Город}}                                                {{Дата}}", false),
      B.h("О назначении {{ФИО сотрудника}}", "left"),
      B.p("В связи с {{Основание приказа}}"),
      B.h("ПРИКАЗЫВАЮ:", "left"),
      B.list(
        [
          "Назначить {{ФИО сотрудника}} на должность {{Должность сотрудника}} с {{Дата назначения}}.",
          "Установить должностной оклад в размере {{Оклад}}.",
          "Контроль за исполнением настоящего приказа оставляю за собой.",
        ],
        true,
      ),
      B.gap(18),
      B.sign(),
      B.gap(12),
      B.p("С приказом ознакомлен(а): ______________ / {{ФИО сотрудника}}", false),
    ],
  },
  {
    id: "order-general",
    name: "Приказ по основной деятельности",
    description: "Универсальный приказ с пунктами распоряжения.",
    category: "orders",
    doc_type: "order",
    blocks: [
      B.h("ПРИКАЗ № {{Номер документа}}"),
      B.p("г. {{Город}}                                                {{Дата}}", false),
      B.h("{{Тема приказа}}", "left"),
      B.p("{{Основание приказа}}"),
      B.h("ПРИКАЗЫВАЮ:", "left"),
      B.list(["{{Пункт 1}}", "{{Пункт 2}}", "Контроль за исполнением возложить на {{Ответственный}}."], true),
      B.gap(18),
      B.sign(),
    ],
  },
  {
    id: "attorney-employee",
    name: "Доверенность сотруднику",
    description: "Доверенность на представление интересов и получение ТМЦ.",
    category: "attorney",
    doc_type: "attorney",
    blocks: [
      B.h("ДОВЕРЕННОСТЬ № {{Номер документа}}"),
      B.p("г. {{Город}}                                                {{Дата}}", false),
      B.p("{{Компания}}, УНП {{УНП}}, адрес: {{Адрес}}, в лице {{Должность подписанта}} {{ФИО директора}}, действующего на основании {{Основание}}, настоящей доверенностью уполномочивает {{ФИО сотрудника}} (паспорт {{Паспорт сотрудника}}) совершать следующие действия:"),
      B.list(["{{Полномочие 1}}", "{{Полномочие 2}}"], true),
      B.p("Доверенность выдана сроком до {{Срок действия}} без права передоверия.", false),
      B.gap(14),
      B.p("Подпись {{ФИО сотрудника}} ______________ удостоверяю.", false),
      B.gap(14),
      B.sign(),
    ],
  },
  {
    id: "certificate-work",
    name: "Справка с места работы",
    description: "Справка о работе и заработной плате сотрудника.",
    category: "certificates",
    doc_type: "certificate",
    blocks: [
      B.h("СПРАВКА № {{Номер документа}}"),
      B.p("Дана {{ФИО сотрудника}} в том, что он(а) действительно работает в {{Компания}} в должности {{Должность сотрудника}} с {{Дата приёма}} по настоящее время."),
      B.table(
        ["Показатель", "Значение"],
        [
          ["Должность", "{{Должность сотрудника}}"],
          ["Дата приёма на работу", "{{Дата приёма}}"],
          ["Среднемесячная заработная плата", "{{Оклад}}"],
        ],
      ),
      B.p("Справка выдана для предъявления по месту требования.", false),
      B.gap(16),
      B.sign(),
    ],
  },
  {
    id: "notice-general",
    name: "Уведомление",
    description: "Уведомление контрагента об изменении условий.",
    category: "notices",
    doc_type: "notice",
    blocks: [
      B.rec("{{Организация получателя}}\n{{ФИО получателя}}"),
      B.h("УВЕДОМЛЕНИЕ № {{Номер документа}}"),
      B.p("{{Компания}} уведомляет вас о том, что с {{Дата изменения}} {{Суть уведомления}}."),
      B.p("Просим учесть указанные изменения в дальнейшей работе.", false),
      B.note("Настоящее уведомление направлено в порядке, предусмотренном договором {{Номер договора}}."),
      B.gap(16),
      B.sign(),
    ],
  },
  {
    id: "memo-internal",
    name: "Служебная записка",
    description: "Внутренний документ на имя руководителя.",
    category: "internal",
    doc_type: "memo",
    blocks: [
      B.rec("{{Должность получателя}}\n{{ФИО получателя}}\nот {{Должность сотрудника}} {{ФИО сотрудника}}"),
      B.h("СЛУЖЕБНАЯ ЗАПИСКА"),
      B.p("{{Текст записки}}"),
      B.p("Прошу рассмотреть и принять решение.", false),
      B.gap(14),
      B.sign("{{Должность сотрудника}}", "{{ФИО сотрудника}}", false),
    ],
  },
  {
    id: "hr-staffing",
    name: "Штатное расписание",
    description: "Альбомный лист: должности, коды ОКРБ, штатные единицы, оклады и фонд оплаты труда.",
    category: "hr",
    doc_type: "staffing",
    blocks: [
      B.p("УТВЕРЖДАЮ\n{{Должность подписанта}} {{Компания}}\n____________ {{ФИО директора}}\n«___» ____________ 20___ г.", false),
      B.h("ШТАТНОЕ РАСПИСАНИЕ"),
      B.p("{{Компания}}, УНП {{УНП}}. Вводится в действие с {{Дата ввода}}.", false),
      B.table(STAFFING_HEADER, [["1", "{{Должность}}", "", "1", "0", "0", "", "", "", "0", "0", ""]]),
      B.note("Заполните таблицу кнопкой «Заполнить из реестра» и нажмите «Пересчитать» — суммы и итог посчитаются автоматически."),
      B.gap(14),
      B.sign("Главный бухгалтер", "{{ФИО бухгалтера}}", false),
    ],
  },
  {
    id: "hr-timesheet",
    name: "Табель учёта рабочего времени",
    description: "Альбомный табель: дни месяца, обозначения неявок и итоги по часам и дням.",
    category: "hr",
    doc_type: "timesheet",
    blocks: [
      B.h("ТАБЕЛЬ УЧЁТА ИСПОЛЬЗОВАНИЯ РАБОЧЕГО ВРЕМЕНИ"),
      B.p("{{Компания}}, УНП {{УНП}} · за {{Период}}", false),
      B.table(timesheetHeader(currentPeriod()), []),
      B.note("Обозначения: В — выходной, О — трудовой отпуск, А — отпуск без сохранения з/платы, Б — временная нетрудоспособность, К — командировка, Г — гос. обязанности."),
      B.gap(14),
      B.sign("Ответственный за ведение табеля", "{{ФИО сотрудника}}", false),
    ],
  },
  {
    id: "hr-payroll",
    name: "Зарплатная ведомость",
    description: "Расчёт зарплаты: оклад, ставка, дни и часы, подоходный налог, 1% ФСЗН, аванс и сумма на руки.",
    category: "hr",
    doc_type: "payroll",
    blocks: [
      B.h("РАСЧЁТНО-ПЛАТЁЖНАЯ ВЕДОМОСТЬ"),
      B.p("{{Компания}}, УНП {{УНП}} · за {{Период}}", false),
      B.table(PAYROLL_HEADER, []),
      B.note("Дни и часы подтягиваются из табеля за тот же период. Налог — 13% с учётом стандартного вычета, взнос в ФСЗН — 1%."),
      B.gap(14),
      B.sign("Главный бухгалтер", "{{ФИО бухгалтера}}", false),
      B.sign("{{Должность подписанта}}", "{{ФИО директора}}", true),
    ],
  },
  {
    id: "custom-blank",
    name: "Пустой документ",
    description: "Чистый бланк компании — заголовок и один абзац.",
    category: "custom",
    doc_type: "custom",
    blocks: [B.h("{{Название документа}}"), B.p("{{Текст документа}}")],
  },
  ...LOAN_PRESETS,
  ...ATTORNEY_PRESETS,
  ...WORKACT_PRESETS,
  ...ORDER_PRESETS,
];

export function presetById(id: string): PwPreset | null {
  return PW_PRESETS.find((p) => p.id === id) ?? null;
}
