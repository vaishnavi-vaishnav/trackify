import { useState } from "react";
import { Check, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { Textarea } from "../ui/Textarea";
import { StatusBadge } from "../ui/StatusBadge";
import { formatRange, fullName, workingDayCount } from "../../lib/format";
import { leaveTypes } from "../../lib/status";

const typeLabel = (value) =>
  leaveTypes.find((t) => t.value === value)?.label ?? value;

/**
 * One leave request, with approve / reject actions when the viewer is its
 * approver.
 *
 * Rejection opens a dialog because the API requires a reason — collecting it
 * up front avoids a round trip that can only fail.
 */
export function LeaveRequestCard({
  request,
  canDecide = false,
  onApprove,
  onReject,
  onCancel,
  busy = false,
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(null);

  const name = fullName(
    request.employee_first_name,
    request.employee_last_name,
  );
  // Weekends are not counted, matching what approval actually writes into
  // attendance — the card must not promise a different number.
  const days = workingDayCount(request.start_date, request.end_date);
  const pending = request.status === "pending";

  const submitRejection = async () => {
    if (!reason.trim()) {
      setReasonError("Let them know why so they can plan around it.");
      return;
    }
    await onReject(request, reason.trim());
    setRejecting(false);
    setReason("");
    setReasonError(null);
  };

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{name}</p>
              <p className="text-xs tabular text-muted">
                {request.employee_id}
                {request.employee_department
                  ? ` · ${request.employee_department}`
                  : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="primary">{typeLabel(request.leave_type)}</Badge>
                <StatusBadge status={request.status} />
                {request.project_name && (
                  <Badge tone="neutral">{request.project_name}</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm font-medium text-ink">
              {formatRange(request.start_date, request.end_date)}
            </p>
            <p className="text-xs text-muted">
              {days} working {days === 1 ? "day" : "days"}
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
          {request.reason}
        </p>

        {request.status === "rejected" && request.rejection_reason && (
          <p className="mt-3 text-[13px] text-danger">
            <span className="font-medium">Rejected:</span>{" "}
            {request.rejection_reason}
          </p>
        )}
        {request.status === "approved" && request.approval_notes && (
          <p className="mt-3 text-[13px] text-success">
            <span className="font-medium">Note:</span> {request.approval_notes}
          </p>
        )}
        {request.decided_by_first_name && (
          <p className="mt-2 text-xs text-faint">
            Decided by{" "}
            {fullName(
              request.decided_by_first_name,
              request.decided_by_last_name,
            )}
          </p>
        )}

        {(canDecide && pending) || onCancel ? (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            {onCancel && pending && (
              <Button variant="outline" size="sm" onClick={() => onCancel(request)}>
                Withdraw
              </Button>
            )}
            {canDecide && pending && (
              <>
                <Button
                  variant="dangerSubtle"
                  size="sm"
                  leftIcon={X}
                  onClick={() => setRejecting(true)}
                  disabled={busy}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  leftIcon={Check}
                  loading={busy}
                  onClick={() => onApprove(request)}
                >
                  Approve
                </Button>
              </>
            )}
          </div>
        ) : null}
      </Card>

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        size="md"
        title={`Reject ${name}'s leave?`}
        description={formatRange(request.start_date, request.end_date)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={submitRejection}>
              Reject request
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason for rejection"
          required
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError) setReasonError(null);
          }}
          error={reasonError}
          placeholder="e.g. We need cover for the release that week."
        />
      </Modal>
    </>
  );
}
