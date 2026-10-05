/**
 * Interest areas a student can name when planning ("what would you like to
 * study?"). Courses carry these keys in `courses.tags`; the planner prefers
 * electives that match.
 */
import type { LocalizedText } from '../rule-engine/types';

export const INTERESTS: ReadonlyArray<{ key: string; name: LocalizedText }> = [
  { key: 'ai_data', name: { mn: 'Хиймэл оюун, өгөгдөл', en: 'AI & data' } },
  { key: 'web_mobile', name: { mn: 'Веб, мобайл', en: 'Web & mobile' } },
  { key: 'systems_security', name: { mn: 'Систем, аюулгүй байдал', en: 'Systems & security' } },
  { key: 'games_graphics', name: { mn: 'Тоглоом, график', en: 'Games & graphics' } },
  { key: 'business', name: { mn: 'Бизнес, менежмент', en: 'Business & management' } },
  { key: 'design_people', name: { mn: 'Дизайн, хүн судлал', en: 'Design & people' } },
];

export const INTEREST_KEYS = INTERESTS.map((i) => i.key);
