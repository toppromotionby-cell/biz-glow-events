// Демо-данные каталогов. Etapa 2 заменит на загрузку из Supabase.
export type CatalogItem = {
  slug: string;
  title: string;
  description: string;
  priceFrom: number; // BYN
  image: string;
  images?: string[];
  video?: string | null;
  tags: string[];
};

export const ZONES: CatalogItem[] = [
  { slug: "vr-arena", title: "VR-арена", description: "Иммерсивная VR-зона на 4 игрока с турнирным режимом.", priceFrom: 1800, image: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&q=70", tags: ["VR", "Интерактив"] },
  { slug: "photo-360", title: "Фотозона 360°", description: "Видео-360 буст с мгновенной отправкой в мессенджеры.", priceFrom: 1200, image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=70", tags: ["Фото", "Соцсети"] },
  { slug: "ar-mirror", title: "AR-зеркало", description: "Магическое зеркало с дополненной реальностью и брендингом.", priceFrom: 900, image: "https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=800&q=70", tags: ["AR", "Брендинг"] },
  { slug: "neon-lounge", title: "Неоновая лаунж-зона", description: "Подсветка, мягкие модули, тематическая аэрография.", priceFrom: 700, image: "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&q=70", tags: ["Декор", "Зона отдыха"] },
];

export const EQUIPMENT: CatalogItem[] = [
  { slug: "led-screen-p3", title: "LED-экран P3", description: "Бесшовные модули, сборка любых размеров под объект.", priceFrom: 350, image: "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?w=800&q=70", tags: ["LED", "Видео"] },
  { slug: "sound-line-array", title: "Линейный массив звука", description: "Комплект на зал до 1000 человек, инженер включён.", priceFrom: 1500, image: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=70", tags: ["Звук"] },
  { slug: "moving-heads", title: "Световые приборы Beam/Wash", description: "12 голов + контроллер. Программирование шоу.", priceFrom: 800, image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=70", tags: ["Свет"] },
  { slug: "projection-mapping", title: "Проекционный маппинг", description: "Лазерные проекторы 20 000 ANSI, контент под объект.", priceFrom: 2500, image: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=70", tags: ["Видео", "Маппинг"] },
];

export const SERVICES: CatalogItem[] = [
  { slug: "event-production", title: "Event-продакшн под ключ", description: "Креатив, площадка, тех, артисты, логистика.", priceFrom: 8000, image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=70", tags: ["Продакшн"] },
  { slug: "btl-promo", title: "BTL и промо-персонал", description: "Промоутеры, супервайзеры, отчётность в онлайне.", priceFrom: 600, image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=70", tags: ["BTL"] },
  { slug: "live-streaming", title: "Онлайн-трансляция", description: "Мультикамера, режиссёрский пульт, RTMP/YouTube.", priceFrom: 1400, image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&q=70", tags: ["Стрим"] },
  { slug: "artist-booking", title: "Букинг артистов", description: "Подбор и сопровождение артистов и ведущих.", priceFrom: 500, image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=70", tags: ["Артисты"] },
];

export const PRODUCTION: CatalogItem[] = [
  { slug: "decor-arch", title: "Арки и фотостены", description: "ЧПУ-резка, печать, монтаж на объекте.", priceFrom: 450, image: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=70", tags: ["Декор"] },
  { slug: "stage-construction", title: "Сценические конструкции", description: "Сцены, подиумы, фермы, рампы под нагрузку.", priceFrom: 2200, image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=70", tags: ["Конструкции"] },
  { slug: "props-custom", title: "Реквизит и арт-объекты", description: "От 3D-печати до крупногабаритных инсталляций.", priceFrom: 350, image: "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?w=800&q=70", tags: ["Реквизит"] },
  { slug: "branding-print", title: "Брендирование и печать", description: "Баннеры, пресс-воллы, наклейки, флаги.", priceFrom: 200, image: "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=800&q=70", tags: ["Печать"] },
];
