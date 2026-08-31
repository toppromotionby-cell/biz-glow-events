// Карточки решений бота-помощника переехали в общий слой botkit,
// чтобы оба бота (админка и планер) выглядели одинаково.
export {
  BUTTON_LABELS,
  CARD_APPROVE,
  CARD_DROP,
  CARD_EDIT,
  cardButtons,
  renderCard,
  renderDecided,
  stripFakeButtons,
  type AssistantCard,
  type AssistantPlanStep,
  type CardButton,
} from "@/lib/botkit/cards";
