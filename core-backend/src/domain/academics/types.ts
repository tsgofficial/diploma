/**
 * Plain academic records the audit and planner work on. Services map
 * Sequelize rows into these shapes, so the algorithms stay database-free.
 */
import type { LocalizedText } from '../rule-engine/types';
import type { TermType } from './terms';

export type { LocalizedText };

export type SectionType = 'lecture' | 'seminar' | 'lab';

export interface CatalogCourse {
  id: number;
  code: string;
  name: LocalizedText;
  credits: number;
  /** Internships (дадлага) are not counted in the semester load (9.6). */
  isInternship: boolean;
  termsOffered: TermType[];
  /** Section types a student must pick in Хичээл сонголт 2 (8.8). */
  components: SectionType[];
  /**
   * Prerequisites as groups of course ids: every group must be satisfied, a
   * group is satisfied by passing ANY course in it ([[A], [B, C]] = A and (B or C)).
   */
  prerequisiteGroups: number[][];
  /** Interest tags (e.g. "ai_data") used to recommend electives. */
  tags: string[];
}

export type CategoryGroup = 'general' | 'professional' | 'specialization' | 'open';

/** One block of the curriculum (хүснэгт 8.1), e.g. "Мэргэжлийн суурь — сонгон, 9 кредит". */
export interface RequirementCategory {
  id: number;
  code: string;
  name: LocalizedText;
  group: CategoryGroup;
  isElective: boolean;
  minCredits: number;
  sortOrder: number;
}

export interface CurriculumEntry {
  courseId: number;
  categoryId: number;
  /** Semester of the recommended study plan (Оюутанд санал болгох төлөвлөгөө), 1–8. */
  recommendedSemester: number | null;
}

export type AttemptStatus = 'completed' | 'in_progress' | 'withdrawn';

export interface Attempt {
  courseId: number;
  termCode: string;
  termSeq: number;
  letter: string | null;
  point: number | null;
  passed: boolean;
  status: AttemptStatus;
}
