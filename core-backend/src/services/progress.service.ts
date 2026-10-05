/**
 * The program's curriculum and the graduation planner with the student's
 * wishes (graduate in 3 / 3.5 / 4 years, summers, load, light semesters,
 * interests).
 */
import { termService } from './term.service';
import { ruleService } from './rule.service';
import { AcademicContext, loadAcademicContext, termDto } from './academicContext.service';
import { auditDegree } from '../domain/academics/degreeAudit';
import { PlanIssue, PlannerInput, PlannerLimits, PlanPreferences, planGraduation } from '../domain/academics/planner';
import { isMainTerm, nextTerm, parseTermCode, semesterNumber, TermRef, termCode, termLabel } from '../domain/academics/terms';
import { INTERESTS } from '../domain/registration/interests';
import { RuleDefinition } from '../domain/rule-engine';

const STANDARD_SEMESTERS = 8;
const TARGET_CHOICES = [6, 7, 8, 9, 10];

function courseBrief(ac: AcademicContext, id: number) {
  const course = ac.courses.get(id)!;
  const cur = ac.curriculum.get(id);
  return {
    id,
    code: course.code,
    name: course.name,
    credits: course.credits,
    isInternship: course.isInternship,
    category: cur?.categoryCode ?? null,
    isRequired: Boolean(cur && !cur.isElective),
    recommendedSemester: cur?.recommendedSemester ?? null,
  };
}

/** The legal load limits come from the rules, so a registrar's change applies to plans too. */
function plannerLimits(rules: RuleDefinition[], dual: boolean): PlannerLimits {
  const max = (code: string, fallback: number) => {
    const rule = rules.find((r) => r.code === code && r.enabled);
    return typeof rule?.params.max === 'number' ? rule.params.max : fallback;
  };
  return { hardMax: dual ? max('MAX_CREDITS_DUAL', 30) : max('MAX_CREDITS_MAIN', 21), summerMax: max('MAX_CREDITS_SUMMER', 6) };
}

const named = (code: string | null) => (code ? { code, name: termLabel(parseTermCode(code)) } : null);

/** Main semesters from the registration term on: [{ semester, term }]. */
function semesterTerms(start: TermRef, startSemester: number, until: number) {
  const out: Array<{ semester: number; term: { code: string; name: { mn: string; en: string } } }> = [];
  let t = start;
  let semester = startSemester;
  while (semester <= until && out.length < 20) {
    if (isMainTerm(t.type)) {
      out.push({ semester, term: named(termCode(t))! });
      semester += 1;
    }
    t = nextTerm(t);
  }
  return out;
}

async function plannerInput(studentId: number, prefs: PlanPreferences) {
  const term = await termService.current();
  const ac = await loadAcademicContext(studentId, term);
  const rules = await ruleService.forPhase('selection');
  // Without the current selection the plan starts the registration term from scratch.
  const audit = prefs.keepSelection
    ? ac.audit
    : auditDegree({ totalCredits: ac.program.totalCredits, categories: ac.categories, curriculum: ac.curriculumEntries, courses: ac.courses, attempts: ac.attempts, planned: [] });
  const input: PlannerInput = {
    courses: ac.courses,
    categories: ac.categories,
    curriculum: ac.curriculumEntries,
    audit,
    planned: ac.selected,
    startTerm: { year: term.year, type: term.type },
    startSemester: ac.snapshot.semester,
    prefs,
    limits: plannerLimits(rules, ac.snapshot.isDualProgram),
    openPool: [...ac.courses.values()].filter((c) => !ac.curriculum.has(c.id) && c.termsOffered.length > 0).map((c) => c.id),
    standardSemesters: STANDARD_SEMESTERS,
  };
  return { term, ac, input };
}

function issueDto(ac: AcademicContext, issue: PlanIssue) {
  const brief = (id: number) => ({ code: ac.courses.get(id)?.code ?? `#${id}`, name: ac.courses.get(id)?.name ?? null });
  switch (issue.code) {
    case 'chain':
      return { code: issue.code, chain: issue.chain.map((x) => ({ ...brief(x.courseId), term: named(x.term) })) };
    case 'overload':
      return { code: issue.code, term: named(issue.term), courses: issue.courseIds.map(brief) };
    case 'unschedulable':
      return { code: issue.code, reason: issue.reason, courses: issue.courseIds.map(brief) };
    case 'preferred_load':
      return { code: issue.code, terms: issue.terms.map(named) };
    default:
      return issue;
  }
}

/**
 * The semesters already behind the student and the one underway, so the plan
 * shows every year from the first. Past semesters list the courses that
 * count (passed); a failed attempt is left out — the course reappears in the
 * plan as a retake. No grades are returned.
 */
function historyOf(ac: AcademicContext) {
  const byTerm = new Map<number, typeof ac.grades>();
  for (const g of ac.grades) {
    if (!g.term || g.term.seq >= ac.term.seq) continue;
    byTerm.set(g.termId, [...(byTerm.get(g.termId) ?? []), g]);
  }
  return [...byTerm.values()]
    .sort((a, b) => a[0].term!.seq - b[0].term!.seq)
    .map((rows) => {
      const term = rows[0].term!;
      const ref: TermRef = { year: term.year, type: term.type };
      const current = rows.some((r) => r.status === 'in_progress');
      const ids = rows.filter((r) => (current ? r.status === 'in_progress' : r.passed)).map((r) => r.courseId);
      const list = ids.map((id) => ac.courses.get(id)!).filter(Boolean);
      return {
        code: term.code,
        type: term.type,
        name: termLabel(ref),
        semester: isMainTerm(term.type) ? semesterNumber(ac.student.admissionYear, ref) : null,
        credits: list.reduce((sum, c) => sum + c.credits, 0),
        loadCredits: list.filter((c) => !c.isInternship || !isMainTerm(term.type)).reduce((sum, c) => sum + c.credits, 0),
        status: current ? ('current' as const) : ('past' as const),
        courses: ids.map((id) => ({ ...courseBrief(ac, id), reason: 'required' as const, interests: [] as string[], forced: false })),
      };
    });
}

export const DEFAULT_PLAN_PREFERENCES: PlanPreferences = {
  targetSemesters: null,
  allowSummer: false,
  maxLoad: 18,
  lightSemesters: [],
  interests: [],
  // Course selection happens in the university's own system, so plans start from scratch.
  keepSelection: false,
};

export const progressService = {
  /** The program's curriculum blocks and the courses in each — no grades, no statuses. */
  async getCurriculum(studentId: number) {
    const term = await termService.current();
    const ac = await loadAcademicContext(studentId, term);
    const brief = (id: number) => {
      const c = ac.courses.get(id)!;
      return { id, code: c.code, name: c.name, credits: c.credits, isInternship: c.isInternship, recommendedSemester: ac.curriculum.get(id)?.recommendedSemester ?? null };
    };
    // Open electives come from other programs' courses.
    const openPool = [...ac.courses.values()].filter((c) => !ac.curriculum.has(c.id) && c.termsOffered.length > 0).map((c) => c.id);
    return {
      program: { code: ac.program.code, name: { mn: ac.program.name, en: ac.program.nameEn }, totalCredits: ac.program.totalCredits },
      blocks: ac.categories.map((cat) => ({
        code: cat.code,
        name: cat.name,
        group: cat.group,
        isElective: cat.isElective,
        minCredits: cat.minCredits,
        courses: (cat.group === 'open' ? openPool : ac.curriculumEntries.filter((e) => e.categoryId === cat.id).map((e) => e.courseId))
          .map(brief)
          .sort((a, b) => (a.recommendedSemester ?? 99) - (b.recommendedSemester ?? 99) || a.code.localeCompare(b.code)),
      })),
    };
  },

  /**
   * What the student can choose from: each graduation target with whether it
   * is reachable (without / with summer terms) and, if not, why.
   */
  async getPlanOptions(studentId: number) {
    const { term, ac, input } = await plannerInput(studentId, DEFAULT_PLAN_PREFERENCES);
    const current = ac.snapshot.semester;
    const run = (targetSemesters: number, allowSummer: boolean) =>
      planGraduation({ ...input, prefs: { ...input.prefs, targetSemesters, allowSummer, maxLoad: input.limits.hardMax } });

    const targets = TARGET_CHOICES.filter((n) => n >= current).map((n) => {
      const plain = run(n, false);
      const summer = plain.feasible ? plain : run(n, true);
      const blocking = plain.issues.find((i) => i.code === 'chain' || i.code === 'credits' || i.code === 'overload');
      return {
        semesters: n,
        years: n / 2,
        term: named(plain.targetTerm),
        feasible: plain.feasible,
        feasibleWithSummer: summer.feasible,
        reason: plain.feasible ? null : blocking?.code ?? 'other',
      };
    });

    const electives = [...ac.courses.values()].filter((c) => !ac.curriculum.get(c.id) || ac.curriculum.get(c.id)!.isElective);
    return {
      term: termDto(term),
      currentSemester: current,
      standardSemesters: STANDARD_SEMESTERS,
      limits: input.limits,
      targets,
      semesters: semesterTerms(input.startTerm, current, Math.max(...TARGET_CHOICES)),
      interests: INTERESTS.map((i) => ({ ...i, courses: electives.filter((c) => c.tags.includes(i.key)).map((c) => c.code) })),
      defaults: { ...DEFAULT_PLAN_PREFERENCES, targetSemesters: Math.max(STANDARD_SEMESTERS, current) },
    };
  },

  async getPlan(studentId: number, prefs: PlanPreferences) {
    const { term, ac, input } = await plannerInput(studentId, prefs);
    const started = Date.now();
    const plan = planGraduation(input);
    const tookMs = Date.now() - started;

    return {
      term: termDto(term),
      preferences: prefs,
      limits: input.limits,
      feasible: plan.feasible,
      targetTerm: named(plan.targetTerm),
      graduationTerm: named(plan.graduationTerm),
      earliestTerm: named(plan.earliestTerm),
      terms: plan.terms.map((t) => ({
        code: t.code,
        type: t.type,
        name: termLabel(parseTermCode(t.code)),
        semester: t.semester,
        credits: t.credits,
        loadCredits: t.loadCredits,
        fixed: t.fixed,
        light: t.light,
        overPreferred: t.overPreferred,
        isRegistrationTerm: t.code === term.code,
        courses: t.courses.map((c) => ({ ...courseBrief(ac, c.courseId), reason: c.reason, interests: c.interests, forced: c.forced })),
      })),
      history: historyOf(ac),
      issues: plan.issues.map((i) => issueDto(ac, i)),
      remainingCredits: input.audit.totals.projectedRemaining,
      tookMs,
    };
  },
};
