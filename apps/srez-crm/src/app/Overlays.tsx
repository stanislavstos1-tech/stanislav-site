/* Все окна приложения в одном месте: открываются из любого экрана через useApp(). */
import { useApp } from './ctx';
import { LeadDrawer, StudentDrawer, LessonDrawer } from './drawers';
import { NewLeadModal, MessageModal, BookCallModal, LoseModal, ConvertModal, PayModal, ReturnHwModal, StudentLeftModal } from './modals';

export function Overlays() {
  const { drawer: d, modal: m } = useApp();
  return (
    <>
      {d?.type === 'lead' && <LeadDrawer key={d.id} id={d.id} />}
      {d?.type === 'student' && <StudentDrawer key={d.id} id={d.id} />}
      {d?.type === 'lesson' && <LessonDrawer key={d.id} id={d.id} />}
      {m?.type === 'newLead' && <NewLeadModal />}
      {m?.type === 'message' && <MessageModal to={m.to} template={m.template} />}
      {m?.type === 'bookCall' && <BookCallModal leadId={m.leadId} />}
      {m?.type === 'lose' && <LoseModal leadId={m.leadId} />}
      {m?.type === 'convert' && <ConvertModal leadId={m.leadId} />}
      {m?.type === 'pay' && <PayModal studentId={m.studentId} />}
      {m?.type === 'returnHw' && <ReturnHwModal homeworkId={m.homeworkId} />}
      {m?.type === 'studentLeft' && <StudentLeftModal studentId={m.studentId} />}
    </>
  );
}
