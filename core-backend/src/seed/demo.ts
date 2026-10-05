/**
 * Demo data for course registration: program + curriculum, terms, the spring
 * timetable, four named demo students and 80 background students.
 *
 *   npm run seed:demo            # only if not seeded yet
 *   npm run seed:demo -- --reset # wipe registration data and demo accounts, then seed
 *
 * Demo accounts (password DEMO_PASSWORD, default "student123"):
 *   bat@stud.must.edu.mn     2nd year, good standing — prerequisites still in progress
 *   saraa@stud.must.edu.mn   3rd year, failed Database Systems — blocked from the team project
 *   tuvshin@stud.must.edu.mn on the academic warning list, retaking failed courses
 *   nomin@stud.must.edu.mn   final year — the planner should end in this spring
 *   anu@stud.must.edu.mn     1st year — a whole 8-semester plan (or 7, with summers)
 */
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import {
  AuditLog,
  Course,
  CourseOffering,
  CoursePrerequisite,
  CourseSelection,
  CurriculumCourse,
  Grade,
  Instructor,
  Program,
  RequirementCategory,
  Section,
  SectionEnrollment,
  SectionMeeting,
  sequelize,
  Student,
  Term,
  User,
  syncModels,
} from '../models';
import { ruleService } from '../services/rule.service';
import { CATEGORIES, COURSES, PROGRAM, SUMMER_AFTER_6, TYPICAL_PATH } from './catalog.data';
import { INSTRUCTORS, ROOMS, SPRING_TIMETABLE } from './timetable.data';
import { bandForScore, NON_PARTICIPATION } from '../domain/academics/grading';
import { isMainTerm, parseTermCode, termLabel, termSeq, TermType } from '../domain/academics/terms';
import { findConflicts, Meeting, meetingsOverlap, PERIODS, WeekParity } from '../domain/scheduling/timeslot';
import type { SectionType } from '../domain/academics/types';
import type { TermPhase } from '../models/term.model';

const DEMO_DOMAIN = '@stud.must.edu.mn';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'student123';
const REGISTRATION_TERM = '2027-spring';

const TERMS: Array<{ code: string; phase: TermPhase }> = [
  { code: '2023-autumn', phase: 'closed' },
  { code: '2024-spring', phase: 'closed' },
  { code: '2024-autumn', phase: 'closed' },
  { code: '2025-spring', phase: 'closed' },
  { code: '2025-autumn', phase: 'closed' },
  { code: '2026-spring', phase: 'closed' },
  { code: '2026-summer', phase: 'closed' },
  { code: '2026-autumn', phase: 'in_progress' },
  { code: REGISTRATION_TERM, phase: 'selection' },
];

const TERM_ADJ: Record<TermType, string> = { winter: 'өвлийн', spring: 'хаврын', summer: 'зуны', autumn: 'намрын' };

/** Main-semester number k (1-based) for a student admitted in autumn of `year`. */
function semesterTerm(admissionYear: number, k: number): string {
  return k % 2 === 1 ? `${admissionYear + (k - 1) / 2}-autumn` : `${admissionYear + k / 2}-spring`;
}

/** Deterministic pseudo-random score 62–98 so reseeding gives the same transcripts. */
function scoreFor(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 62 + (Math.abs(h) % 37);
}

// ----------------------------------------------------------------- reset ----

async function reset(): Promise<void> {
  const demoUsers = await User.findAll({ where: { email: { [Op.like]: `%${DEMO_DOMAIN}` } }, attributes: ['id'] });
  const ids = demoUsers.map((u) => u.id);
  const models = [
    SectionEnrollment,
    CourseSelection,
      Grade,
    SectionMeeting,
    Section,
    CourseOffering,
    Student,
    CurriculumCourse,
    CoursePrerequisite,
    RequirementCategory,
    Program,
    Course,
    Instructor,
    Term,
  ];
  for (const model of models) {
    await (model as typeof Term).destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
  }
  if (ids.length) {
    await AuditLog.destroy({ where: { userId: { [Op.in]: ids } } });
    await User.destroy({ where: { id: { [Op.in]: ids } } });
  }
  console.log(`[seed] reset registration data and ${ids.length} demo accounts`);
}

// --------------------------------------------------------------- catalog ----

async function seedCatalog() {
  const program = await Program.create(PROGRAM);
  const categories = await RequirementCategory.bulkCreate(
    CATEGORIES.map((c, i) => ({ ...c, programId: program.id, sortOrder: i + 1 })),
    { returning: true }
  );
  const categoryId = new Map(categories.map((c) => [c.code, c.id]));

  const courses = await Course.bulkCreate(
    COURSES.map((c) => ({
      code: c.code,
      name: c.name,
      nameEn: c.nameEn,
      credits: c.credits,
      department: c.department,
      isInternship: c.isInternship ?? false,
      components: c.components,
      termsOffered: c.terms,
      tags: c.tags ?? [],
      description: null,
    })),
    { returning: true }
  );
  const courseId = new Map(courses.map((c) => [c.code, c.id]));

  await CoursePrerequisite.bulkCreate(
    COURSES.flatMap((c) =>
      (c.prereqs ?? []).flatMap((group, g) =>
        group.map((code) => {
          const prerequisiteId = courseId.get(code);
          if (!prerequisiteId) throw new Error(`unknown prerequisite ${code} for ${c.code}`);
          return { courseId: courseId.get(c.code)!, prerequisiteId, groupNo: g + 1 };
        })
      )
    )
  );

  await CurriculumCourse.bulkCreate(
    COURSES.filter((c) => c.category).map((c) => ({
      programId: program.id,
      courseId: courseId.get(c.code)!,
      categoryId: categoryId.get(c.category!)!,
      recommendedSemester: c.semester,
    }))
  );

  const sum = CATEGORIES.reduce((s, c) => s + c.minCredits, 0);
  if (sum !== PROGRAM.totalCredits) throw new Error(`category minimums (${sum}) ≠ program total (${PROGRAM.totalCredits})`);
  return { program, courseId };
}

// ------------------------------------------------------------- timetable ----

function parseSlot(slot: string): Meeting {
  const match = /^(\d)\.(\d)([oe]?)$/.exec(slot);
  if (!match) throw new Error(`bad slot ${slot}`);
  const period = PERIODS[Number(match[2]) - 1];
  const weekParity: WeekParity = match[3] === 'o' ? 'odd' : match[3] === 'e' ? 'even' : 'all';
  return { dayOfWeek: Number(match[1]), startMinute: period.start, endMinute: period.end, weekParity };
}

async function seedTimetable(termId: number, courseId: Map<string, number>) {
  const instructors = await Instructor.bulkCreate(
    INSTRUCTORS.map(({ name, title, department }) => ({ name, title, department })),
    { returning: true }
  );
  const instructorId = new Map(INSTRUCTORS.map((x, i) => [x.key, instructors[i].id]));

  // Offer every spring course — what Хичээл сонголт 1 shows.
  const springCourses = COURSES.filter((c) => c.terms.includes('spring'));
  await CourseOffering.bulkCreate(springCourses.map((c) => ({ termId, courseId: courseId.get(c.code)! })));

  const roomUse = new Map<string, Meeting[]>(); // room → meetings
  const teacherUse: Array<{ id: number; label: string; meetings: Meeting[] }> = [];
  const prefix: Record<SectionType, string> = { lecture: 'L', seminar: 'S', lab: 'Lab' };
  let sections = 0;

  for (const course of springCourses) {
    const plan = SPRING_TIMETABLE[course.code];
    if (!plan) {
      if (course.components.length) throw new Error(`no timetable for ${course.code}`);
      continue;
    }
    for (const type of course.components) {
      const specs = plan[type];
      if (!specs?.length) throw new Error(`${course.code} needs ${type} sections`);
      for (const [i, [teacher, slot, capacity]] of specs.entries()) {
        const meeting = parseSlot(slot);
        const pool = course.code.startsWith('PE') ? ROOMS.gym : ROOMS[type];
        const room = pool.find((r) => !(roomUse.get(r) ?? []).some((m) => meetingsOverlap(m, meeting)));
        if (!room) throw new Error(`no free ${type} room for ${course.code} at ${slot}`);
        roomUse.set(room, [...(roomUse.get(room) ?? []), meeting]);

        const section = await Section.create({
          termId,
          courseId: courseId.get(course.code)!,
          type,
          code: `${prefix[type]}${i + 1}`,
          instructorId: instructorId.get(teacher) ?? null,
          capacity,
        });
        await SectionMeeting.create({ sectionId: section.id, ...meeting, room });
        teacherUse.push({ id: sections, label: `${teacher} ${course.code} ${slot}`, meetings: [meeting] });
        sections += 1;
      }
    }
  }

  // A teacher cannot be in two places at once.
  const byTeacher = new Map<string, typeof teacherUse>();
  for (const use of teacherUse) {
    const key = use.label.split(' ')[0];
    byTeacher.set(key, [...(byTeacher.get(key) ?? []), use]);
  }
  for (const [teacher, uses] of byTeacher) {
    const clashes = findConflicts(uses);
    if (clashes.length) throw new Error(`${teacher} double-booked: ${clashes.map(([a, b]) => `${a.label} × ${b.label}`).join('; ')}`);
  }
  return sections;
}

// -------------------------------------------------------------- students ----

interface GradeLine {
  code: string;
  score?: number;
  letter?: string; // WF
  inProgress?: boolean;
}

async function createStudent(opts: {
  email: string;
  name: string;
  code: string;
  admissionYear: number;
  passwordHash: string;
  programId: number;
  termId: Map<string, number>;
  courseId: Map<string, number>;
  grades: Record<string, GradeLine[]>;
  selection?: string[];
}) {
  const user = await User.create({ email: opts.email, passwordHash: opts.passwordHash, name: opts.name, role: 'user' });
  const student = await Student.create({
    userId: user.id,
    studentCode: opts.code,
    programId: opts.programId,
    admissionYear: opts.admissionYear,
  });

  const rows = Object.entries(opts.grades).flatMap(([term, lines]) =>
    lines.map((line) => {
      const id = opts.courseId.get(line.code);
      if (!id) throw new Error(`unknown course ${line.code}`);
      const base = { studentId: student.id, courseId: id, termId: opts.termId.get(term)! };
      if (line.inProgress) return { ...base, score: null, letter: null, gradePoint: null, passed: false, status: 'in_progress' as const };
      if (line.letter === NON_PARTICIPATION.letter) {
        return { ...base, score: line.score ?? 0, letter: 'WF', gradePoint: NON_PARTICIPATION.point, passed: false, status: 'completed' as const };
      }
      const band = bandForScore(line.score!);
      return { ...base, score: line.score!, letter: band.letter, gradePoint: band.point, passed: band.point >= 1, status: 'completed' as const };
    })
  );
  await Grade.bulkCreate(rows);

  const regTerm = opts.termId.get(REGISTRATION_TERM)!;
  if (opts.selection?.length) {
    await CourseSelection.bulkCreate(opts.selection.map((code) => ({ studentId: student.id, termId: regTerm, courseId: opts.courseId.get(code)! })));
  }
  return student;
}

/** Transcript following the typical path: semesters 1..completed done, `inProgress` running in autumn 2026. */
function typicalGrades(admissionYear: number, completed: number, seed: string): Record<string, GradeLine[]> {
  const grades: Record<string, GradeLine[]> = {};
  for (let k = 1; k <= completed + 1; k += 1) {
    const term = semesterTerm(admissionYear, k);
    grades[term] = TYPICAL_PATH[k].map((code) => (k <= completed ? { code, score: scoreFor(`${seed}:${code}`) } : { code, inProgress: true }));
    if (k === 6 && k <= completed) grades[`${admissionYear + 3}-summer`] = SUMMER_AFTER_6.map((code) => ({ code, score: scoreFor(`${seed}:${code}`) }));
  }
  return grades;
}

const GIVEN = [
  'Анударь', 'Билгүүн', 'Ганзориг', 'Дөлгөөн', 'Есүй', 'Жаргалсайхан', 'Золбоо', 'Итгэл', 'Мөнх-Очир', 'Номуун',
  'Оргил', 'Пүрэвсүрэн', 'Раднаа', 'Сүх-Очир', 'Тэмүүжин', 'Уянга', 'Хонгорзул', 'Цэлмэг', 'Чингүүн', 'Энхжин',
  'Ариунзаяа', 'Батмөнх', 'Гэрэлт-Од', 'Мишээл', 'Наранбаатар', 'Одгэрэл', 'Сарнай', 'Төгөлдөр', 'Хүслэн', 'Эрдэнэбат',
];
const INITIALS = 'АБГДЭЖЗИЛМНОПРСТУХЦЧ';

async function seedStudents(programId: number, termId: Map<string, number>, courseId: Map<string, number>) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const common = { passwordHash, programId, termId, courseId };

  await createStudent({
    ...common,
    email: `bat${DEMO_DOMAIN}`,
    name: 'Б.Бат-Эрдэнэ',
    code: 'B251940101',
    admissionYear: 2025,
    grades: {
      '2025-autumn': [
        { code: 'MATH101', score: 88 }, { code: 'MATH103', score: 91 }, { code: 'PHYS101', score: 84 }, { code: 'ENG101', score: 92 },
        { code: 'HIST101', score: 85 }, { code: 'PE101', score: 96 }, { code: 'CS201', score: 93 },
      ],
      '2026-spring': [
        { code: 'MATH102', score: 79 }, { code: 'MATH104', score: 86 }, { code: 'ENG102', score: 90 }, { code: 'PE102', score: 97 },
        { code: 'CS202', score: 89 }, { code: 'ECON101', score: 82 },
      ],
      '2026-autumn': ['MATH105', 'ENG103', 'PHIL101', 'CS203', 'CS205', 'CS209'].map((code) => ({ code, inProgress: true })),
    },
  });

  await createStudent({
    ...common,
    email: `saraa${DEMO_DOMAIN}`,
    name: 'Д.Сараа',
    code: 'B241940102',
    admissionYear: 2024,
    grades: {
      '2024-autumn': [
        { code: 'MATH101', score: 76 }, { code: 'MATH103', score: 81 }, { code: 'PHYS101', score: 70 }, { code: 'ENG101', score: 85 },
        { code: 'HIST101', score: 78 }, { code: 'PE101', score: 90 }, { code: 'CS201', score: 83 },
      ],
      '2025-spring': [
        { code: 'MATH102', score: 72 }, { code: 'MATH104', score: 68 }, { code: 'ENG102', score: 80 }, { code: 'PE102', score: 92 },
        { code: 'CS202', score: 79 }, { code: 'MON101', score: 88 },
      ],
      '2025-autumn': [
        { code: 'MATH105', score: 66 }, { code: 'ENG103', score: 77 }, { code: 'PHIL101', score: 82 }, { code: 'CS203', score: 74 },
        { code: 'CS205', score: 71 }, { code: 'CS209', score: 90 },
      ],
      '2026-spring': [
        { code: 'CS204', score: 75 }, { code: 'CS206', score: 69 }, { code: 'CS207', score: 52 }, { code: 'PSY101', score: 84 },
        { code: 'CS210', score: 87 },
      ],
      '2026-autumn': ['CS208', 'SE201', 'SE304', 'CS212', 'ART101'].map((code) => ({ code, inProgress: true })),
    },
  });

  await createStudent({
    ...common,
    email: `tuvshin${DEMO_DOMAIN}`,
    name: 'Г.Түвшин',
    code: 'B251940103',
    admissionYear: 2025,
    grades: {
      '2025-autumn': [
        { code: 'MATH101', score: 61 }, { code: 'MATH103', score: 55 }, { code: 'PHYS101', score: 64 }, { code: 'ENG101', score: 70 },
        { code: 'HIST101', score: 62 }, { code: 'PE101', score: 80 }, { code: 'CS201', score: 60 },
      ],
      '2026-spring': [
        { code: 'MATH102', score: 40 }, { code: 'MATH104', score: 45 }, { code: 'ENG102', score: 58 }, { code: 'PE102', letter: 'WF' },
        { code: 'CS202', score: 50 },
      ],
      '2026-autumn': ['MATH103', 'ENG102', 'PE102', 'PHIL101'].map((code) => ({ code, inProgress: true })),
    },
  });

  await createStudent({
    ...common,
    email: `nomin${DEMO_DOMAIN}`,
    name: 'Э.Номин',
    code: 'B231940104',
    admissionYear: 2023,
    grades: typicalGrades(2023, 6, 'nomin'),
  });

  await createStudent({
    ...common,
    email: `anu${DEMO_DOMAIN}`,
    name: 'Ц.Анударь',
    code: 'B261940105',
    admissionYear: 2026,
    grades: typicalGrades(2026, 0, 'anu'),
  });

  // Background students: 20 per cohort, each with a selection for the registration term.
  let n = 0;
  for (const [admissionYear, semester] of [[2026, 2], [2025, 4], [2024, 6], [2023, 8]] as const) {
    for (let i = 0; i < 20; i += 1, n += 1) {
      const yy = String(admissionYear).slice(2);
      await createStudent({
        ...common,
        email: `b${yy}${String(i + 1).padStart(2, '0')}${DEMO_DOMAIN}`,
        name: `${INITIALS[n % INITIALS.length]}.${GIVEN[(n * 7) % GIVEN.length]}`,
        code: `B${yy}1940${String(200 + n).padStart(3, '0')}`,
        admissionYear,
        grades: typicalGrades(admissionYear, semester - 2, `bg${n}`),
        selection: TYPICAL_PATH[semester],
      });
    }
  }
  return 5 + n;
}

// ------------------------------------------------------------------ main ----

async function main(): Promise<void> {
  await syncModels();
  if (process.argv.includes('--reset')) await reset();
  else if (await Program.count()) {
    console.log('[seed] registration data already present — run with --reset to rebuild it');
    return;
  }

  const { program, courseId } = await seedCatalog();

  const terms = await Term.bulkCreate(
    TERMS.map(({ code, phase }) => {
      const ref = parseTermCode(code);
      return {
        code,
        type: ref.type,
        year: ref.year,
        seq: termSeq(ref),
        name: `${ref.year} оны ${TERM_ADJ[ref.type]} улирал`,
        nameEn: termLabel(ref).en,
        phase,
        isCurrent: code === REGISTRATION_TERM,
        selectionOpensAt: code === REGISTRATION_TERM ? new Date('2026-09-28T09:00:00+08:00') : null,
        selectionClosesAt: code === REGISTRATION_TERM ? new Date('2026-10-16T18:00:00+08:00') : null,
        scheduleOpensAt: code === REGISTRATION_TERM ? new Date('2027-01-25T09:00:00+08:00') : null,
        scheduleClosesAt: code === REGISTRATION_TERM ? new Date('2027-02-05T18:00:00+08:00') : null,
      };
    }),
    { returning: true }
  );
  const termId = new Map(terms.map((t) => [t.code, t.id]));
  if (!terms.every((t) => isMainTerm(t.type) || t.type === 'summer')) throw new Error('unexpected term type');

  const sections = await seedTimetable(termId.get(REGISTRATION_TERM)!, courseId);
  const students = await seedStudents(program.id, termId, courseId);
  const rules = await ruleService.ensureDefaults();

  console.log(
    `[seed] program ${PROGRAM.code}: ${COURSES.length} courses, ${terms.length} terms, ${sections} sections, ${students} students, ${rules} new rules`
  );
  console.log(`[seed] demo logins (password "${DEMO_PASSWORD}"): bat, saraa, tuvshin, nomin, anu ${DEMO_DOMAIN}`);
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
