import { Card } from "../components/ui/Card";
import { IconCircle } from "../components/ui/IconCircle";
import { BlockedIcon } from "../components/icons";
import type { AccountStatus } from "../types";

interface BlockedScreenProps {
  accountStatus: AccountStatus;
  blockedAt: Date;
}

const REASON_COPY: Record<AccountStatus, { title: string; message: string; reason: string }> = {
  blocked: {
    title: "Access Restricted",
    message: "Your account has been restricted by your administrator. Please contact your manager or IT support.",
    reason: "account_blocked",
  },
  locked: {
    title: "Account Locked",
    message: "Your account has been locked by your administrator. Please contact your manager or IT support.",
    reason: "account_locked",
  },
  archived: {
    title: "Account Archived",
    message: "Your account has been archived. You can no longer sign in or track time; your history is read-only.",
    reason: "account_archived",
  },
  session_deleted: {
    title: "Session Ended",
    message: "Your session was revoked by your administrator. Please sign in again or contact IT support.",
    reason: "session_deleted",
  },
  active: {
    title: "Access Restricted",
    message: "Your account has been restricted by your administrator. Please contact your manager or IT support.",
    reason: "account_blocked",
  },
};

export function BlockedScreen({ accountStatus, blockedAt }: BlockedScreenProps) {
  const copy = REASON_COPY[accountStatus];
  return (
    <Card>
      <div className="px-5 py-7 text-center">
        <IconCircle tone="danger" size={48}>
          <BlockedIcon className="h-6 w-6" />
        </IconCircle>
        <div className="mb-2 text-sm font-semibold text-danger">{copy.title}</div>
        <div className="mb-4 text-xs leading-relaxed text-muted">{copy.message}</div>
        <div className="rounded-md border border-danger-border bg-danger-dim px-3 py-2.5 font-mono text-[11px] text-danger">
          REASON: {copy.reason}
          <br />
          SESSION: revoked by admin
          <br />
          TIME: {blockedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
        </div>
      </div>
    </Card>
  );
}
