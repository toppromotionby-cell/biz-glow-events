// Атмосферные обложки плиток DJ Hub: разделы библиотеки и форматы мероприятий.
import type { DjFormatKey, DjSectionKey } from "@/lib/dj/sections";

import music from "@/assets/dj/tiles/music.jpg.asset.json";
import jingles from "@/assets/dj/tiles/jingles.jpg.asset.json";
import host from "@/assets/dj/tiles/host.jpg.asset.json";
import samples from "@/assets/dj/tiles/samples.jpg.asset.json";
import inout from "@/assets/dj/tiles/inout.jpg.asset.json";
import welcome from "@/assets/dj/tiles/welcome.jpg.asset.json";
import family from "@/assets/dj/tiles/family.jpg.asset.json";
import show from "@/assets/dj/tiles/show.jpg.asset.json";
import club from "@/assets/dj/tiles/club.jpg.asset.json";
import software from "@/assets/dj/tiles/software.jpg.asset.json";

import wedding from "@/assets/dj/tiles/wedding.jpg.asset.json";
import birthday from "@/assets/dj/tiles/birthday.jpg.asset.json";
import corporate from "@/assets/dj/tiles/corporate.jpg.asset.json";
import newyear from "@/assets/dj/tiles/newyear.jpg.asset.json";
import march8 from "@/assets/dj/tiles/march8.jpg.asset.json";
import feb23 from "@/assets/dj/tiles/feb23.jpg.asset.json";
import graduation from "@/assets/dj/tiles/graduation.jpg.asset.json";
import kids from "@/assets/dj/tiles/kids.jpg.asset.json";
import themed from "@/assets/dj/tiles/themed.jpg.asset.json";
import openair from "@/assets/dj/tiles/openair.jpg.asset.json";

const SECTION_ART: Partial<Record<DjSectionKey, string>> = {
  music: music.url,
  jingles: jingles.url,
  host: host.url,
  samples: samples.url,
  inout: inout.url,
  welcome: welcome.url,
  family: family.url,
  show: show.url,
  club: club.url,
  software: software.url,
};

const FORMAT_ART: Partial<Record<DjFormatKey, string>> = {
  wedding: wedding.url,
  birthday: birthday.url,
  corporate: corporate.url,
  newyear: newyear.url,
  march8: march8.url,
  feb23: feb23.url,
  graduation: graduation.url,
  kids: kids.url,
  themed: themed.url,
  openair: openair.url,
};

/** Обложка раздела библиотеки; null — показываем градиент. */
export function sectionArt(key: DjSectionKey): string | null {
  return SECTION_ART[key] ?? null;
}

/** Обложка формата мероприятия; null — показываем градиент. */
export function formatArt(key: DjFormatKey): string | null {
  return FORMAT_ART[key] ?? null;
}
