/* Все окна приложения в одном месте: открываются из любого экрана через useApp(). */
import { useApp } from './ctx';
import { LeadDrawer, StudentDrawer, LessonDrawer, GroupDrawer, TeacherDrawer } from './drawers';
import { NewLeadModal, MessageModal, BookTrialModal, LoseModal, ConvertModal, PaymentModal, NewLessonModal, MoveLessonModal, CancelLessonModal, StudentLeftModal } from './modals';

export function Overlays() {
  const { drawer: d, modal: m } = useApp();
  return (
    <>
      {d?.type === 'lead' && <LeadDrawer key={d.id} id={d.id} />}
      {d?.type === 'student' && <StudentDrawer key={d.id} id={d.id} />}
      {d?.type === 'lesson' && <LessonDrawer key={d.id} id={d.id} />}
      {d?.type === 'group' && <GroupDrawer key={d.id} id={d.id} />}
      {d?.type === 'teacher' && <TeacherDrawer key={d.id} id={d.id} />}
      {m?.type === 'newLead' && <NewLeadModal />}
      {m?.type === 'message' && <MessageModal to={m.to} template={m.template} />}
      {m?.type === 'bookTrial' && <BookTrialModal leadId={m.leadId} />}
      {m?.type === 'lose' && <LoseModal leadId={m.leadId} />}
      {m?.type === 'convert' && <ConvertModal leadId={m.leadId} />}
      {m?.type === 'payment' && <PaymentModal studentId={m.studentId} />}
      {m?.type === 'newLesson' && <NewLessonModal start={m.start} teacherId={m.teacherId} leadId={m.leadId} />}
      {m?.type === 'moveLesson' && <MoveLessonModal lessonId={m.lessonId} />}
      {m?.type === 'cancelLesson' && <CancelLessonModal lessonId={m.lessonId} />}
      {m?.type === 'studentLeft' && <StudentLeftModal studentId={m.studentId} />}
    </>
  );
}
