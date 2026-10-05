/**
 * Demo timetable for the registration term (spring). Each course offers a
 * lecture stream (sometimes two teachers) and several seminar/lab groups at
 * different times — the "prepared options" students build their week from
 * in Хичээл сонголт 2.
 *
 * Slot notation: "D.P" = weekday (1 Mon … 5 Fri) and period (1–7, see
 * PERIODS); a trailing "o"/"e" means odd/even weeks only. Rooms are assigned
 * by the seeder; the seeder also refuses a timetable in which a teacher is
 * in two places at once.
 */

export interface InstructorSeed {
  key: string;
  name: string;
  title: string;
  department: string;
}

export const INSTRUCTORS: InstructorSeed[] = [
  { key: 'narantuya', name: 'Д.Нарантуяа', title: 'Дэд профессор', department: 'Математикийн тэнхим' },
  { key: 'ganbat', name: 'Г.Ганбат', title: 'Ахлах багш', department: 'Математикийн тэнхим' },
  { key: 'sarangerel', name: 'Э.Сарангэрэл', title: 'Ахлах багш', department: 'Гадаад хэлний тэнхим' },
  { key: 'khulan', name: 'М.Хулан', title: 'Багш', department: 'Гадаад хэлний тэнхим' },
  { key: 'anujin', name: 'Б.Анужин', title: 'Багш', department: 'Гадаад хэлний тэнхим' },
  { key: 'tumurbaatar', name: 'Ж.Төмөрбаатар', title: 'Ахлах багш', department: 'Биеийн тамирын тэнхим' },
  { key: 'batsetseg', name: 'Н.Батцэцэг', title: 'Дэд профессор', department: 'Нийгмийн ухааны тэнхим' },
  { key: 'enkhjargal', name: 'О.Энхжаргал', title: 'Ахлах багш', department: 'Нийгмийн ухааны тэнхим' },
  { key: 'munkhzul', name: 'Г.Мөнхзул', title: 'Багш', department: 'Нийгмийн ухааны тэнхим' },
  { key: 'batbold', name: 'Б.Батболд', title: 'Профессор', department: 'Компьютерын ухааны тэнхим' },
  { key: 'munkhbayar', name: 'С.Мөнхбаяр', title: 'Дэд профессор', department: 'Программ хангамжийн тэнхим' },
  { key: 'ariunaa', name: 'Т.Ариунаа', title: 'Ахлах багш', department: 'Компьютерын ухааны тэнхим' },
  { key: 'enkhbayar', name: 'Л.Энхбаяр', title: 'Багш', department: 'Компьютерын ухааны тэнхим' },
  { key: 'sukhbat', name: 'А.Сүхбат', title: 'Ахлах багш', department: 'Программ хангамжийн тэнхим' },
  { key: 'ganzorig', name: 'Х.Ганзориг', title: 'Дэд профессор', department: 'Компьютерын ухааны тэнхим' },
  { key: 'nyamsuren', name: 'Р.Нямсүрэн', title: 'Багш', department: 'Программ хангамжийн тэнхим' },
  { key: 'bilguun', name: 'Ч.Билгүүн', title: 'Багш', department: 'Программ хангамжийн тэнхим' },
  { key: 'oyunerdene', name: 'П.Оюун-Эрдэнэ', title: 'Ахлах багш', department: 'Программ хангамжийн тэнхим' },
  { key: 'temuulen', name: 'Д.Тэмүүлэн', title: 'Багш', department: 'Программ хангамжийн тэнхим' },
  { key: 'solongo', name: 'У.Солонго', title: 'Ахлах багш', department: 'Дизайны тэнхим' },
  { key: 'bayarsaikhan', name: 'Ё.Баярсайхан', title: 'Дэд профессор', department: 'Бизнесийн удирдлагын тэнхим' },
];

/** [teacher, slot, capacity] */
export type SectionSpec = [string, string, number];

export interface CourseTimetable {
  lecture?: SectionSpec[];
  seminar?: SectionSpec[];
  lab?: SectionSpec[];
}

export const SPRING_TIMETABLE: Record<string, CourseTimetable> = {
  // 1st-year cohort (semester 2)
  MATH102: { lecture: [['narantuya', '1.2', 90]], seminar: [['ganbat', '2.1', 30], ['ganbat', '3.3', 30], ['narantuya', '4.4', 30]] },
  MATH104: { lecture: [['ganbat', '2.2', 90]], seminar: [['narantuya', '1.3', 30], ['ganbat', '3.2', 30], ['narantuya', '5.1', 30]] },
  ENG102: { seminar: [['sarangerel', '1.4', 25], ['khulan', '2.3', 25], ['anujin', '4.2', 25], ['sarangerel', '5.3', 25]] },
  PE102: { seminar: [['tumurbaatar', '3.5', 30], ['tumurbaatar', '4.5', 30], ['tumurbaatar', '5.5', 30]] },
  CS202: {
    lecture: [['batbold', '3.1', 60], ['munkhbayar', '4.3', 60]],
    lab: [['ariunaa', '1.5', 24], ['enkhbayar', '2.4', 24], ['sukhbat', '4.1', 24], ['enkhbayar', '5.2o', 24], ['enkhbayar', '5.2e', 24]],
  },
  ECON101: { lecture: [['enkhjargal', '2.5', 80]], seminar: [['enkhjargal', '1.6', 30], ['enkhjargal', '3.6', 30]] },

  // 2nd-year cohort (semester 4) — with a full evening option (periods 6–7) for students who work days
  CS204: { lecture: [['batbold', '1.3', 80], ['ganzorig', '1.6', 40]], seminar: [['ganzorig', '2.2', 25], ['ganzorig', '3.4', 25], ['nyamsuren', '5.2', 25], ['nyamsuren', '2.7', 25]] },
  CS206: { lecture: [['munkhbayar', '2.1', 50], ['sukhbat', '4.4', 50], ['sukhbat', '2.6', 40]], lab: [['ariunaa', '3.2', 20], ['enkhbayar', '4.5e', 12], ['ariunaa', '5.1', 20], ['ariunaa', '3.7', 20]] },
  CS207: { lecture: [['ganzorig', '3.3', 80], ['oyunerdene', '3.6', 40]], lab: [['bilguun', '1.4', 20], ['bilguun', '4.5o', 12], ['oyunerdene', '5.4', 20], ['bilguun', '4.2', 20], ['bilguun', '4.7', 20]] },
  MGT101: { lecture: [['enkhjargal', '2.4', 80], ['enkhjargal', '5.6', 40]], seminar: [['enkhjargal', '1.5', 30], ['batsetseg', '5.3', 30], ['enkhjargal', '5.7', 30]] },
  CS212: { lecture: [['temuulen', '3.5', 60], ['temuulen', '4.6', 40]], lab: [['temuulen', '2.3', 20], ['oyunerdene', '4.2', 20], ['oyunerdene', '1.7', 20]] },
  PSY101: { lecture: [['munkhzul', '3.4', 60]], seminar: [['munkhzul', '1.3', 30], ['munkhzul', '5.4', 30]] },
  LAW101: { lecture: [['batsetseg', '4.5', 60]], seminar: [['batsetseg', '5.5', 30]] },
  CS211: { lecture: [['ariunaa', '4.2', 40]], lab: [['enkhbayar', '3.3', 20], ['ariunaa', '1.6', 20]] },

  // 3rd-year cohort (semester 6)
  SE301: { lecture: [['munkhbayar', '1.1', 60]], seminar: [['nyamsuren', '2.4', 25], ['nyamsuren', '4.3', 25]] },
  SE302: { lecture: [['batbold', '2.3', 60]], lab: [['sukhbat', '1.2', 20], ['sukhbat', '3.1', 20], ['temuulen', '5.3', 20]] },
  SE306: { lecture: [['ganzorig', '4.2', 60]], lab: [['bilguun', '2.5', 20], ['oyunerdene', '3.5', 20]] },
  SE350: { seminar: [['batbold', '4.1', 30], ['munkhbayar', '5.1', 30]] },
  CS210: { lecture: [['enkhbayar', '1.6', 50]], lab: [['enkhbayar', '3.6', 20], ['temuulen', '5.5', 20]] },

  // 4th-year cohort (semester 8) — SE370 is an internship without classes
  SE371: { seminar: [['batbold', '1.5', 30], ['munkhbayar', '3.5', 30]] },
  SE311: { lecture: [['ganzorig', '1.4', 50]], lab: [['bilguun', '3.2', 20], ['ganzorig', '5.3', 20]] },
  SE312: { lecture: [['oyunerdene', '2.2', 40]], seminar: [['oyunerdene', '4.4', 25]] },
  SE315: { lecture: [['temuulen', '4.4', 40]], lab: [['temuulen', '1.2', 20], ['ariunaa', '2.5', 20]] },
  SE316: { lecture: [['sukhbat', '5.2', 40]], lab: [['bilguun', '1.3', 20], ['sukhbat', '2.2', 20]] },

  // Retakes and courses open to every year
  MATH103: { lecture: [['ganbat', '4.3', 60]], seminar: [['narantuya', '2.4', 30], ['ganbat', '5.3', 30]] },
  ENG101: { seminar: [['khulan', '1.1', 25], ['anujin', '3.1', 25]] },
  ENG103: { seminar: [['anujin', '2.2', 25], ['khulan', '4.4', 25]] },
  HIST101: { lecture: [['batsetseg', '1.2', 80]], seminar: [['batsetseg', '3.3', 30], ['batsetseg', '5.2', 30]] },
  PHIL101: { lecture: [['batsetseg', '2.3', 80]], seminar: [['batsetseg', '4.2', 30]] },
  PE101: { seminar: [['tumurbaatar', '1.5', 30], ['tumurbaatar', '2.5', 30]] },
  MON101: { seminar: [['batsetseg', '1.6', 25], ['batsetseg', '4.6', 25]] },
  ART101: { lecture: [['solongo', '2.6', 40]], seminar: [['solongo', '4.6', 25]] },
  BUS201: { lecture: [['bayarsaikhan', '3.6', 40]], seminar: [['bayarsaikhan', '5.6', 25]] },
};

/** Rooms by kind; the seeder hands out the first one free at that time. */
export const ROOMS = {
  lecture: ['1-101', '1-102', '8-201', '8-202', '8-203'],
  seminar: ['8-301', '8-302', '8-303', '8-304', '8-305', '8-306', '2-401', '2-402'],
  lab: ['8-Лаб1', '8-Лаб2', '8-Лаб3', '8-Лаб4', '8-Лаб5'],
  gym: ['Спорт заал'],
};
