'use client';

import { Button, Modal } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { RuleIssues } from './rule-issues';
import type { RuleOutcome } from '@/lib/api';

export interface OutcomeDialogState {
  kind: 'blocked';
  title: string;
  body: string;
  outcomes: RuleOutcome[];
}

/** Explains why an action was refused: the rules that were not met and where they come from. */
export function OutcomeDialog({ state, onClose }: { state: OutcomeDialogState | null; onClose: () => void }) {
  const t = useTranslations();
  return (
    <Modal isOpen={state !== null} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop isDismissable>
        <Modal.Container size="md" scroll="inside">
          <Modal.Dialog>
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>{state?.title}</Modal.Heading>
              <p className="text-sm text-muted">{state?.body}</p>
            </Modal.Header>
            <Modal.Body>{state && <RuleIssues outcomes={state.outcomes} />}</Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                {t('common.close')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
