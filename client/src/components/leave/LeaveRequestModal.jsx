import { useEffect, useId, useState } from "react";
import { CalendarPlus, Info } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { createLeaveRequest } from "../../services/leave";
import {
  dayCount,
  formatRange,
  toISODate,
  workingDayCount,
} from "../../lib/format";
import { leaveTypes } from "../../lib/status";
import { cn } from "../../lib/utils";

const EMPTY = {
  leaveType: "leave",
  startDate: "",
  endDate: "",
  reason: "",
  projectId: "",
};

/** Shift an ISO date by whole days, staying in local time. */
function shift(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/** The next weekday on or after `iso`. */
function nextWeekday(iso) {
  let cursor = iso;
  for (let i = 0; i < 7; i += 1) {
    const [y, m, d] = cursor.split("-").map(Number);
    const day = new Date(y, m - 1, d).getDay();
    if (day !== 0 && day !== 6) return cursor;
    cursor = shift(cursor, 1);
  }
  return iso;
}

/**
 * Quick ranges for the cases people actually pick, so the common request is
 * two clicks instead of two date pickers.
 */
function presets() {
  const today = toISODate();
  const tomorrow = nextWeekday(shift(today, 1));
  const nextMondayOffset = ((8 - new Date().getDay()) % 7) || 7;
  const nextMonday = shift(today, nextMondayOffset);

  return [
    { label: "Tomorrow", start: tomorrow, end: tomorrow },
    { label: "Next 3 days", start: tomorrow, end: shift(tomorrow, 2) },
    { label: "Next week", start: nextMonday, end: shift(nextMonday, 4) },
  ];
}

/**
 * Raise a request — a day at home, a flyback, or time off.
 *
 * A dialog rather than a permanent form: raising one is an occasional,
 * deliberate act, and keeping it out of the page lets the list of existing
 * requests use the full width — which is what people come here to read.
 */
export function LeaveRequestModal({ open, onClose, projects = [], approverLabel, onCreated }) {
  const formId = useId();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setErrors({});
  }, [open]);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // A single-day request is the common case, so the end date follows the
      // start until the person sets it themselves.
      if (name === "startDate" && (!prev.endDate || prev.endDate < value)) {
        next.endDate = value;
      }
      return next;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const applyPreset = (preset) => {
    setForm((prev) => ({ ...prev, startDate: preset.start, endDate: preset.end }));
    setErrors((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();

    const next = {};
    if (!form.startDate) next.startDate = "Pick a start date.";
    if (!form.endDate) next.endDate = "Pick an end date.";
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      next.endDate = "The end date can't be before the start date.";
    }
    if (!form.reason.trim()) next.reason = "Tell your approver why.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    try {
      await createLeaveRequest({
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
        projectId: form.projectId ? Number(form.projectId) : null,
      });
      toast.success("Request submitted.");
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Unable to submit this request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const working = workingDayCount(form.startDate, form.endDate);
  const calendar = dayCount(form.startDate, form.endDate);
  const today = toISODate();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New request"
      description={
        approverLabel
          ? `This goes to ${approverLabel} for approval.`
          : "This goes to your approver for a decision."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={submitting}
            leftIcon={CalendarPlus}
            className="sm:min-w-[10rem]"
          >
            Submit request
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        <Select
          label="Type"
          name="leaveType"
          value={form.leaveType}
          onChange={change}
          required
          hint={
            form.leaveType === "wfh"
              ? "Approved days are recorded as working from home, not as leave"
              : form.leaveType === "flyback"
                ? "Flyback days are reported separately from ordinary leave"
              : undefined
          }
        >
          {leaveTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft">Quick pick</p>
          <div className="flex flex-wrap gap-2">
            {presets().map((preset) => {
              const active =
                form.startDate === preset.start && form.endDate === preset.end;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  aria-pressed={active}
                  className={cn(
                    "h-8 rounded-lg border px-3 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-line-strong bg-surface text-ink-soft hover:border-primary hover:text-primary",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="From"
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={change}
            error={errors.startDate}
            required
          />
          <Input
            label="To"
            name="endDate"
            type="date"
            min={form.startDate || undefined}
            value={form.endDate}
            onChange={change}
            error={errors.endDate}
            required
          />
        </div>

        {working > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg bg-primary-soft px-3.5 py-2.5">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-[13px] leading-relaxed text-primary-strong">
              <span className="font-semibold">
                {working} working day{working === 1 ? "" : "s"}
              </span>{" "}
              — {formatRange(form.startDate, form.endDate)}
              {calendar !== working && (
                <span className="text-primary/80">
                  {" "}
                  ({calendar} calendar days; weekends aren't counted)
                </span>
              )}
              {form.startDate < today && (
                <span className="block text-primary/80">
                  These dates are in the past.
                </span>
              )}
            </p>
          </div>
        )}

        {/* <Select
          label="Project"
          name="projectId"
          value={form.projectId}
          onChange={change}
          hint="Optional — which project this affects"
        >
          <option value="">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select> */}

        <Textarea
          label="Reason"
          name="reason"
          value={form.reason}
          onChange={change}
          error={errors.reason}
          placeholder="A short note for your approver — e.g. family wedding, medical appointment."
          required
        />
      </form>
    </Modal>
  );
}
