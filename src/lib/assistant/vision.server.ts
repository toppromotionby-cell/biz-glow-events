// Разбор скриншотов бота админки переехал в общий слой botkit — оба бота видят одинаково.
export {
  VISION_MIME,
  VISION_MAX_BYTES,
  acceptsAttachment,
  analyzeAttachments,
  visionMessages,
  type Attachment,
  type VisionOutcome,
  type VisionResult,
} from "@/lib/botkit/vision.server";
