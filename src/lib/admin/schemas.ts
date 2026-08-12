// Zod-схемы для админ-форм раздела «Наполнение».
// Не используем .default() — input/output типы совпадают, форма всегда передаёт значения.
import { z } from "zod";

const slug = z
  .string()
  .min(1, "Slug обязателен")
  .max(80, "Не более 80 символов")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Только латиница, цифры и дефис");

const seoTitle = z.string().max(60, "Не более 60 символов").optional().or(z.literal(""));
const seoDescription = z.string().max(160, "Не более 160 символов").optional().or(z.literal(""));

export const blogPostSchema = z.object({
  title: z.string().min(1, "Заголовок обязателен").max(200),
  slug,
  excerpt: z.string().max(500).optional().or(z.literal("")),
  body: z.string().optional().or(z.literal("")),
  cover_url: z.string().url("Некорректный URL").optional().or(z.literal("")),
  tags: z.array(z.string()),
  published: z.boolean(),
  published_at: z.string().nullable().optional(),
  seo_title: seoTitle,
  seo_description: seoDescription,
});
export type BlogPostInput = z.infer<typeof blogPostSchema>;

export const testimonialSchema = z.object({
  client_name: z.string().min(1, "Имя клиента обязательно").max(120),
  client_company: z.string().max(120).optional().or(z.literal("")),
  client_role: z.string().max(120).optional().or(z.literal("")),
  client_photo_url: z.string().url("Некорректный URL").optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().min(1, "Текст обязателен").max(2000),
  event_date: z.string().nullable().optional(),
  published: z.boolean(),
  featured: z.boolean(),
  sort_order: z.coerce.number().int(),
});
export type TestimonialInput = z.infer<typeof testimonialSchema>;

export const caseSchema = z.object({
  title: z.string().min(1, "Заголовок обязателен").max(200),
  slug,
  client: z.string().max(160).optional().or(z.literal("")),
  event_type: z.string().max(120).optional().or(z.literal("")),
  event_date: z.string().nullable().optional(),
  location: z.string().max(160).optional().or(z.literal("")),
  guests_count: z.coerce.number().int().min(0).nullable().optional(),
  summary: z.string().max(500).optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  cover_url: z.string().optional().or(z.literal("")),
  seo_title: seoTitle,
  seo_description: seoDescription,
  published: z.boolean(),
  featured: z.boolean(),
});
export type CaseInput = z.infer<typeof caseSchema>;

export const promoCodeSchema = z.object({
  code: z
    .string()
    .min(3, "Минимум 3 символа")
    .max(32, "Не более 32 символов")
    .regex(/^[A-Z0-9-]+$/, "Только латиница в верхнем регистре, цифры и дефис"),
  description: z.string().max(300).optional().or(z.literal("")),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.coerce.number().min(0, "Не меньше 0"),
  min_order_total: z.coerce.number().min(0, "Не меньше 0"),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  max_uses: z.coerce.number().int().min(1, "Минимум 1").nullable().optional(),
  active: z.boolean(),
}).refine(
  (v) => v.discount_type !== "percent" || v.discount_value <= 100,
  { path: ["discount_value"], message: "Процент не может быть больше 100" },
).refine(
  (v) => !v.valid_from || !v.valid_to || v.valid_from <= v.valid_to,
  { path: ["valid_to"], message: "Дата окончания раньше даты начала" },
);
export type PromoCodeInput = z.infer<typeof promoCodeSchema>;

// Карточка каталога (zones / tech_equipment / services / production_items).
export const catalogItemSchema = z.object({
  title: z.string().trim().min(2, "Минимум 2 символа").max(160, "Не более 160 символов"),
  slug: z
    .string()
    .trim()
    .min(2, "Минимум 2 символа")
    .max(120, "Не более 120 символов")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Только строчная латиница, цифры и дефис"),
  seo_title: seoTitle,
  seo_description: seoDescription,
});
export type CatalogItemInput = z.infer<typeof catalogItemSchema>;
