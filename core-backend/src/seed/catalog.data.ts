/**
 * Demo curriculum: "Программ хангамж" (Software Engineering), МХТС.
 *
 * Illustrative data shaped by ШУТИС тушаал №199: course numbers follow
 * хүснэгт 8.1 (100–199 general, 200–299 professional, 300–349 specialization,
 * 350–359 project, 360–379 internship / thesis), every block has required and
 * elective parts, internships run in summer (8.12) and the pre-diploma
 * internship in a main semester (8.14). 125 credits over 8 semesters. Electives carry
 * interest tags for the planner; some general courses also run in summer.
 */
import type { SectionType } from '../domain/academics/types';
import type { TermType } from '../domain/academics/terms';
import type { CategoryGroup } from '../domain/academics/types';

export const PROGRAM = {
  code: 'SE',
  name: 'Программ хангамж',
  nameEn: 'Software Engineering',
  school: 'Мэдээлэл, холбооны технологийн сургууль',
  totalCredits: 125,
};

export interface CategorySeed {
  code: string;
  name: string;
  nameEn: string;
  group: CategoryGroup;
  isElective: boolean;
  minCredits: number;
}

export const CATEGORIES: CategorySeed[] = [
  { code: 'GEN_REQ', name: 'Ерөнхий суурь — заавал', nameEn: 'General foundation — required', group: 'general', isElective: false, minCredits: 33 },
  { code: 'GEN_ELEC', name: 'Ерөнхий суурь — сонгон', nameEn: 'General foundation — elective', group: 'general', isElective: true, minCredits: 6 },
  { code: 'PROF_REQ', name: 'Мэргэжлийн суурь — заавал', nameEn: 'Professional foundation — required', group: 'professional', isElective: false, minCredits: 30 },
  { code: 'PROF_ELEC', name: 'Мэргэжлийн суурь — сонгон', nameEn: 'Professional foundation — elective', group: 'professional', isElective: true, minCredits: 9 },
  { code: 'SPEC_REQ', name: 'Мэргэших — заавал', nameEn: 'Specialization — required', group: 'specialization', isElective: false, minCredits: 35 },
  { code: 'SPEC_ELEC', name: 'Мэргэших — сонгон', nameEn: 'Specialization — elective', group: 'specialization', isElective: true, minCredits: 9 },
  { code: 'OPEN', name: 'Нээлттэй сонгон', nameEn: 'Open electives', group: 'open', isElective: true, minCredits: 3 },
];

export interface CourseSeed {
  code: string;
  name: string;
  nameEn: string;
  credits: number;
  department: string;
  components: SectionType[];
  terms: TermType[];
  isInternship?: boolean;
  /** Curriculum block; null = not in this program (counts as open elective). */
  category: string | null;
  semester: number | null;
  /** Prerequisite groups by code: [['A'], ['B', 'C']] = A and (B or C). */
  prereqs?: string[][];
  /** Interest tags (see domain/registration/interests). */
  tags?: string[];
}

const MATH = 'Математикийн тэнхим';
const PHYS = 'Физикийн тэнхим';
const LANG = 'Гадаад хэлний тэнхим';
const SOC = 'Нийгмийн ухааны тэнхим';
const PE = 'Биеийн тамирын тэнхим';
const CS = 'Компьютерын ухааны тэнхим';
const SE = 'Программ хангамжийн тэнхим';

const LS: SectionType[] = ['lecture', 'seminar'];
const LL: SectionType[] = ['lecture', 'lab'];
const S: SectionType[] = ['seminar'];
const AUT: TermType[] = ['autumn'];
const SPR: TermType[] = ['spring'];
const BOTH: TermType[] = ['autumn', 'spring'];
// General courses also run in the summer term (≤ 6 credits, 9.6) — for retakes or to finish sooner.
const ALL: TermType[] = ['autumn', 'spring', 'summer'];
const SPR_SUM: TermType[] = ['spring', 'summer'];

export const COURSES: CourseSeed[] = [
  // General foundation — required (33)
  { code: 'MATH101', name: 'Математик I', nameEn: 'Calculus I', credits: 3, department: MATH, components: LS, terms: AUT, category: 'GEN_REQ', semester: 1 },
  { code: 'MATH102', name: 'Математик II', nameEn: 'Calculus II', credits: 3, department: MATH, components: LS, terms: SPR, category: 'GEN_REQ', semester: 2, prereqs: [['MATH101']] },
  { code: 'MATH103', name: 'Шугаман алгебр', nameEn: 'Linear Algebra', credits: 3, department: MATH, components: LS, terms: BOTH, category: 'GEN_REQ', semester: 1 },
  { code: 'MATH104', name: 'Дискрет математик', nameEn: 'Discrete Mathematics', credits: 3, department: MATH, components: LS, terms: SPR, category: 'GEN_REQ', semester: 2 },
  { code: 'MATH105', name: 'Магадлал, статистик', nameEn: 'Probability and Statistics', credits: 3, department: MATH, components: LS, terms: AUT, category: 'GEN_REQ', semester: 3, prereqs: [['MATH102']] },
  { code: 'PHYS101', name: 'Физик I', nameEn: 'Physics I', credits: 3, department: PHYS, components: LL, terms: AUT, category: 'GEN_REQ', semester: 1 },
  { code: 'ENG101', name: 'Англи хэл I', nameEn: 'English I', credits: 3, department: LANG, components: S, terms: BOTH, category: 'GEN_REQ', semester: 1 },
  { code: 'ENG102', name: 'Англи хэл II', nameEn: 'English II', credits: 3, department: LANG, components: S, terms: ALL, category: 'GEN_REQ', semester: 2, prereqs: [['ENG101']] },
  { code: 'ENG103', name: 'Англи хэл III', nameEn: 'English III', credits: 3, department: LANG, components: S, terms: ALL, category: 'GEN_REQ', semester: 3, prereqs: [['ENG102']] },
  { code: 'HIST101', name: 'Монголын түүх', nameEn: 'History of Mongolia', credits: 2, department: SOC, components: LS, terms: ALL, category: 'GEN_REQ', semester: 1 },
  { code: 'PHIL101', name: 'Философи', nameEn: 'Philosophy', credits: 2, department: SOC, components: LS, terms: ALL, category: 'GEN_REQ', semester: 3 },
  { code: 'PE101', name: 'Биеийн тамир I', nameEn: 'Physical Education I', credits: 1, department: PE, components: S, terms: BOTH, category: 'GEN_REQ', semester: 1 },
  { code: 'PE102', name: 'Биеийн тамир II', nameEn: 'Physical Education II', credits: 1, department: PE, components: S, terms: BOTH, category: 'GEN_REQ', semester: 2, prereqs: [['PE101']] },

  // General foundation — elective (6)
  { code: 'ECON101', name: 'Эдийн засгийн онол', nameEn: 'Principles of Economics', credits: 3, department: SOC, components: LS, terms: ALL, category: 'GEN_ELEC', semester: 2, tags: ['business'] },
  { code: 'PSY101', name: 'Сэтгэл судлал', nameEn: 'Psychology', credits: 3, department: SOC, components: LS, terms: SPR_SUM, category: 'GEN_ELEC', semester: 4, tags: ['design_people'] },
  { code: 'MGT101', name: 'Менежментийн үндэс', nameEn: 'Principles of Management', credits: 3, department: SOC, components: LS, terms: ALL, category: 'GEN_ELEC', semester: 4, tags: ['business'] },
  { code: 'LAW101', name: 'Хууль зүйн үндэс', nameEn: 'Introduction to Law', credits: 3, department: SOC, components: LS, terms: SPR_SUM, category: 'GEN_ELEC', semester: 4, tags: ['business'] },
  { code: 'MON101', name: 'Монгол бичиг', nameEn: 'Mongolian Script', credits: 3, department: SOC, components: S, terms: ALL, category: 'GEN_ELEC', semester: 2, tags: ['design_people'] },

  // Professional foundation — required (30)
  { code: 'CS201', name: 'Програмчлалын үндэс', nameEn: 'Programming Fundamentals', credits: 3, department: CS, components: LL, terms: AUT, category: 'PROF_REQ', semester: 1 },
  { code: 'CS202', name: 'Объект хандалтат програмчлал', nameEn: 'Object-Oriented Programming', credits: 3, department: CS, components: LL, terms: SPR, category: 'PROF_REQ', semester: 2, prereqs: [['CS201']] },
  { code: 'CS203', name: 'Өгөгдлийн бүтэц', nameEn: 'Data Structures', credits: 3, department: CS, components: LL, terms: AUT, category: 'PROF_REQ', semester: 3, prereqs: [['CS202'], ['MATH104']] },
  { code: 'CS204', name: 'Алгоритмын шинжилгээ', nameEn: 'Analysis of Algorithms', credits: 3, department: CS, components: LS, terms: SPR, category: 'PROF_REQ', semester: 4, prereqs: [['CS203']] },
  { code: 'CS205', name: 'Компьютерын архитектур', nameEn: 'Computer Architecture', credits: 3, department: CS, components: LL, terms: AUT, category: 'PROF_REQ', semester: 3, prereqs: [['CS201']] },
  { code: 'CS206', name: 'Үйлдлийн систем', nameEn: 'Operating Systems', credits: 3, department: CS, components: LL, terms: SPR, category: 'PROF_REQ', semester: 4, prereqs: [['CS205']] },
  { code: 'CS207', name: 'Өгөгдлийн сангийн систем', nameEn: 'Database Systems', credits: 3, department: CS, components: LL, terms: SPR, category: 'PROF_REQ', semester: 4, prereqs: [['CS203']] },
  { code: 'CS208', name: 'Компьютерын сүлжээ', nameEn: 'Computer Networks', credits: 3, department: CS, components: LL, terms: AUT, category: 'PROF_REQ', semester: 5, prereqs: [['CS206']] },
  { code: 'CS209', name: 'Веб програмчлал', nameEn: 'Web Programming', credits: 3, department: CS, components: LL, terms: AUT, category: 'PROF_REQ', semester: 3, prereqs: [['CS202']] },
  { code: 'SE201', name: 'Програм хангамжийн инженерчлэл', nameEn: 'Software Engineering', credits: 3, department: SE, components: LS, terms: AUT, category: 'PROF_REQ', semester: 5, prereqs: [['CS202']] },

  // Professional foundation — elective (9)
  { code: 'CS210', name: 'Мобайл програмчлал', nameEn: 'Mobile Programming', credits: 3, department: CS, components: LL, terms: SPR, category: 'PROF_ELEC', semester: 6, prereqs: [['CS202']], tags: ['web_mobile'] },
  { code: 'CS211', name: 'Компьютер график', nameEn: 'Computer Graphics', credits: 3, department: CS, components: LL, terms: SPR, category: 'PROF_ELEC', semester: 4, prereqs: [['CS203'], ['MATH103']], tags: ['games_graphics'] },
  { code: 'CS212', name: 'Python програмчлал', nameEn: 'Programming in Python', credits: 3, department: CS, components: LL, terms: ALL, category: 'PROF_ELEC', semester: 4, prereqs: [['CS201']], tags: ['ai_data'] },
  { code: 'CS213', name: 'Тооцооллын онол', nameEn: 'Theory of Computation', credits: 3, department: CS, components: LS, terms: AUT, category: 'PROF_ELEC', semester: 5, prereqs: [['MATH104']], tags: ['ai_data'] },

  // Specialization — required (35)
  { code: 'SE301', name: 'Шаардлагын инженерчлэл', nameEn: 'Requirements Engineering', credits: 3, department: SE, components: LS, terms: SPR, category: 'SPEC_REQ', semester: 6, prereqs: [['SE201']] },
  { code: 'SE302', name: 'Програм хангамжийн архитектур', nameEn: 'Software Architecture and Design', credits: 3, department: SE, components: LL, terms: SPR, category: 'SPEC_REQ', semester: 6, prereqs: [['SE201']] },
  { code: 'SE303', name: 'Програм хангамжийн тест ба чанар', nameEn: 'Software Testing and Quality', credits: 3, department: SE, components: LL, terms: AUT, category: 'SPEC_REQ', semester: 7, prereqs: [['SE302']] },
  { code: 'SE304', name: 'Хэрэглэгчийн интерфейс ба UX', nameEn: 'User Interface and UX Design', credits: 3, department: SE, components: LL, terms: AUT, category: 'SPEC_REQ', semester: 5, prereqs: [['CS209']] },
  { code: 'SE305', name: 'Үүлэн тооцоолол ба DevOps', nameEn: 'Cloud Computing and DevOps', credits: 3, department: SE, components: LL, terms: AUT, category: 'SPEC_REQ', semester: 7, prereqs: [['CS208']] },
  { code: 'SE306', name: 'Мэдээллийн аюулгүй байдал', nameEn: 'Information Security', credits: 3, department: SE, components: LL, terms: SPR, category: 'SPEC_REQ', semester: 6, prereqs: [['CS208']] },
  { code: 'SE307', name: 'Програм хангамжийн төслийн менежмент', nameEn: 'Software Project Management', credits: 3, department: SE, components: LS, terms: AUT, category: 'SPEC_REQ', semester: 7, prereqs: [['SE301']] },
  { code: 'SE350', name: 'Програм хангамжийн баг төсөл', nameEn: 'Software Team Project', credits: 3, department: SE, components: S, terms: SPR, category: 'SPEC_REQ', semester: 6, prereqs: [['SE201'], ['CS207']] },
  { code: 'SE360', name: 'Үйлдвэрлэлийн дадлага', nameEn: 'Industrial Internship', credits: 3, department: SE, components: [], terms: ['summer'], isInternship: true, category: 'SPEC_REQ', semester: 6, prereqs: [['SE201']] },
  { code: 'SE370', name: 'Дипломын өмнөх дадлага', nameEn: 'Pre-diploma Internship', credits: 2, department: SE, components: [], terms: BOTH, isInternship: true, category: 'SPEC_REQ', semester: 8, prereqs: [['SE360']] },
  { code: 'SE371', name: 'Бакалаврын дипломын төсөл', nameEn: 'Bachelor Thesis Project', credits: 6, department: SE, components: S, terms: BOTH, category: 'SPEC_REQ', semester: 8, prereqs: [['SE350'], ['SE303']] },

  // Specialization — elective (9)
  { code: 'SE310', name: 'Машин сургалт', nameEn: 'Machine Learning', credits: 3, department: SE, components: LL, terms: AUT, category: 'SPEC_ELEC', semester: 7, prereqs: [['MATH105'], ['CS204']], tags: ['ai_data'] },
  { code: 'SE311', name: 'Хиймэл оюун ухаан', nameEn: 'Artificial Intelligence', credits: 3, department: SE, components: LL, terms: SPR, category: 'SPEC_ELEC', semester: 8, prereqs: [['CS204']], tags: ['ai_data'] },
  { code: 'SE312', name: 'Аж ахуйн нэгжийн мэдээллийн систем', nameEn: 'Enterprise Information Systems', credits: 3, department: SE, components: LS, terms: SPR, category: 'SPEC_ELEC', semester: 8, prereqs: [['CS207']], tags: ['business', 'web_mobile'] },
  { code: 'SE313', name: 'Өгөгдлийн шинжилгээ', nameEn: 'Data Analytics', credits: 3, department: SE, components: LL, terms: AUT, category: 'SPEC_ELEC', semester: 7, prereqs: [['CS207'], ['MATH105']], tags: ['ai_data', 'business'] },
  { code: 'SE314', name: 'Блокчэйн технологи', nameEn: 'Blockchain Technology', credits: 3, department: SE, components: LL, terms: AUT, category: 'SPEC_ELEC', semester: 7, prereqs: [['CS208']], tags: ['systems_security'] },
  { code: 'SE315', name: 'Тоглоом хөгжүүлэлт', nameEn: 'Game Development', credits: 3, department: SE, components: LL, terms: SPR, category: 'SPEC_ELEC', semester: 8, prereqs: [['CS211', 'SE302']], tags: ['games_graphics'] },
  { code: 'SE316', name: 'Микросервис архитектур', nameEn: 'Microservice Architecture', credits: 3, department: SE, components: LL, terms: SPR, category: 'SPEC_ELEC', semester: 8, prereqs: [['SE302'], ['CS208']], tags: ['web_mobile', 'systems_security'] },

  // Other programs' courses — count as open electives
  { code: 'ART101', name: 'Дизайны үндэс', nameEn: 'Design Fundamentals', credits: 3, department: 'Дизайны тэнхим', components: LS, terms: ALL, category: null, semester: null, tags: ['design_people'] },
  { code: 'BUS201', name: 'Инновац ба энтрепренёршип', nameEn: 'Innovation and Entrepreneurship', credits: 3, department: 'Бизнесийн удирдлагын тэнхим', components: LS, terms: SPR_SUM, category: null, semester: null, tags: ['business'] },
];

/** A typical path through the program (used for demo transcripts and selections). */
export const TYPICAL_PATH: Record<number, string[]> = {
  1: ['MATH101', 'MATH103', 'PHYS101', 'ENG101', 'HIST101', 'PE101', 'CS201'],
  2: ['MATH102', 'MATH104', 'ENG102', 'PE102', 'CS202', 'ECON101'],
  3: ['MATH105', 'ENG103', 'PHIL101', 'CS203', 'CS205', 'CS209'],
  4: ['CS204', 'CS206', 'CS207', 'MGT101', 'CS212'],
  5: ['CS208', 'SE201', 'SE304', 'CS213', 'ART101'],
  6: ['SE301', 'SE302', 'SE306', 'SE350', 'CS210'],
  7: ['SE303', 'SE305', 'SE307', 'SE310', 'SE313'],
  8: ['SE370', 'SE371', 'SE311'],
};
/** Taken in the summer after semester 6. */
export const SUMMER_AFTER_6 = ['SE360'];
