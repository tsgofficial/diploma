/**
 * Model registry + associations.
 *
 * Central place to wire relationships and run schema sync. No classes — just
 * the model objects produced by `sequelize.define()`.
 */
import { sequelize } from '../config/database';
import { User } from './user.model';
import { ChatSession } from './chatSession.model';
import { ChatMessage } from './chatMessage.model';
import { AuditLog } from './auditLog.model';
import { Program } from './program.model';
import { RequirementCategory } from './requirementCategory.model';
import { Course } from './course.model';
import { CurriculumCourse } from './curriculumCourse.model';
import { CoursePrerequisite } from './coursePrerequisite.model';
import { Instructor } from './instructor.model';
import { Student } from './student.model';
import { Term } from './term.model';
import { Grade } from './grade.model';
import { CourseOffering } from './courseOffering.model';
import { Section } from './section.model';
import { SectionMeeting } from './sectionMeeting.model';
import { CourseSelection } from './courseSelection.model';
import { SectionEnrollment } from './sectionEnrollment.model';
import { RegistrationRule } from './registrationRule.model';

// A user has many sessions; a session has many messages.
User.hasMany(ChatSession, { foreignKey: 'userId', as: 'sessions' });
ChatSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

ChatSession.hasMany(ChatMessage, { foreignKey: 'sessionId', as: 'messages' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'sessionId', as: 'session' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ------------------------------------------------- curriculum & catalog ----

Program.hasMany(RequirementCategory, { foreignKey: 'programId', as: 'categories', onDelete: 'CASCADE' });
RequirementCategory.belongsTo(Program, { foreignKey: 'programId', as: 'program' });

Program.hasMany(CurriculumCourse, { foreignKey: 'programId', as: 'curriculum', onDelete: 'CASCADE' });
CurriculumCourse.belongsTo(Program, { foreignKey: 'programId', as: 'program' });
CurriculumCourse.belongsTo(Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });
CurriculumCourse.belongsTo(RequirementCategory, { foreignKey: 'categoryId', as: 'category', onDelete: 'CASCADE' });

Course.hasMany(CoursePrerequisite, { foreignKey: 'courseId', as: 'prerequisites', onDelete: 'CASCADE' });
CoursePrerequisite.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
CoursePrerequisite.belongsTo(Course, { foreignKey: 'prerequisiteId', as: 'prerequisite', onDelete: 'CASCADE' });

// ------------------------------------------------------------ students ----

User.hasOne(Student, { foreignKey: 'userId', as: 'student', onDelete: 'CASCADE' });
Student.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Student.belongsTo(Program, { foreignKey: 'programId', as: 'program' });

Student.hasMany(Grade, { foreignKey: 'studentId', as: 'grades', onDelete: 'CASCADE' });
Grade.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Grade.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Grade.belongsTo(Term, { foreignKey: 'termId', as: 'term' });


// ------------------------------------------------- terms & registration ----

Term.hasMany(CourseOffering, { foreignKey: 'termId', as: 'offerings', onDelete: 'CASCADE' });
CourseOffering.belongsTo(Term, { foreignKey: 'termId', as: 'term' });
CourseOffering.belongsTo(Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });

Term.hasMany(Section, { foreignKey: 'termId', as: 'sections', onDelete: 'CASCADE' });
Section.belongsTo(Term, { foreignKey: 'termId', as: 'term' });
Section.belongsTo(Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });
Section.belongsTo(Instructor, { foreignKey: 'instructorId', as: 'instructor', onDelete: 'SET NULL' });
Section.hasMany(SectionMeeting, { foreignKey: 'sectionId', as: 'meetings', onDelete: 'CASCADE' });
SectionMeeting.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });

Student.hasMany(CourseSelection, { foreignKey: 'studentId', as: 'selections', onDelete: 'CASCADE' });
CourseSelection.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
CourseSelection.belongsTo(Term, { foreignKey: 'termId', as: 'term', onDelete: 'CASCADE' });
CourseSelection.belongsTo(Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });

Student.hasMany(SectionEnrollment, { foreignKey: 'studentId', as: 'enrollments', onDelete: 'CASCADE' });
SectionEnrollment.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
SectionEnrollment.belongsTo(Term, { foreignKey: 'termId', as: 'term', onDelete: 'CASCADE' });
SectionEnrollment.belongsTo(Section, { foreignKey: 'sectionId', as: 'section', onDelete: 'CASCADE' });
SectionEnrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });

/**
 * Sync models to the database. For a diploma/dev setup `sync` is fine;
 * switch to Sequelize migrations before production.
 */
export async function syncModels(): Promise<void> {
  // `alter` adds columns introduced after the first release (users.role,
  // chat_messages.citations). Dev-only convenience — migrations for prod.
  await sequelize.sync({ alter: true });
}

export {
  sequelize,
  User,
  ChatSession,
  ChatMessage,
  AuditLog,
  Program,
  RequirementCategory,
  Course,
  CurriculumCourse,
  CoursePrerequisite,
  Instructor,
  Student,
  Term,
  Grade,
  CourseOffering,
  Section,
  SectionMeeting,
  CourseSelection,
  SectionEnrollment,
  RegistrationRule,
};
