import { useEffect, useId, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { EmployeeForm } from "./EmployeeForm";
import { useNotifications } from "../../context/NotificationContext";
import {
  createEmployee,
  getEmployee,
  getNextEmployeeId,
  updateEmployee,
} from "../../services/admin";
import { getLeadOptions } from "../../services/leads";
import { fullName } from "../../lib/format";

const ROLE_NOUN = { employee: "Employee", lead: "Lead", admin: "Admin" };

/**
 * Add or edit a person without leaving the directory.
 *
 * Everything the form needs — the next free employee id, the list of leads,
 * and (when editing) the person themselves — is fetched when the dialog opens
 * rather than with the page, so the directory itself stays a single request.
 */
export function PersonFormModal({ open, onClose, employeeId = null, onSaved }) {
  const editing = Boolean(employeeId);
  const formId = useId();
  const { addNotification } = useNotifications();

  const [initialValues, setInitialValues] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setInitialValues(null);

    const work = editing
      ? Promise.all([getEmployee(employeeId), getLeadOptions()]).then(
          ([res, leadList]) => {
            const person = res.data;
            return {
              leads: leadList.filter((lead) => lead.id !== person.id),
              values: {
                employeeId: person.employee_id,
                firstName: person.first_name,
                lastName: person.last_name,
                email: person.email,
                phone: person.phone ?? "",
                department: person.department ?? "",
                designation: person.designation ?? "",
                joiningDate: person.joining_date
                  ? String(person.joining_date).slice(0, 10)
                  : "",
                role: person.role,
                leadId: person.lead_id ?? "",
              },
            };
          },
        )
      : Promise.all([getNextEmployeeId(), getLeadOptions()]).then(
          ([nextId, leadList]) => ({
            leads: leadList,
            values: { employeeId: nextId },
          }),
        );

    work
      .then(({ leads: leadList, values }) => {
        if (cancelled) return;
        setLeads(leadList);
        setInitialValues(values);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, editing, employeeId]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const res = editing
        ? await updateEmployee(employeeId, values)
        : await createEmployee(values);

      const name = fullName(values.firstName, values.lastName);
      toast.success(res.message || (editing ? "Changes saved." : "Person created."));
      addNotification({
        type: "success",
        title: editing
          ? "Person updated"
          : `${ROLE_NOUN[values.role] ?? "Person"} created`,
        body: editing
          ? `${name}'s details were saved.`
          : `${name} (${values.employeeId}) can now activate their account.`,
      });

      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          (editing ? "Unable to save changes." : "Unable to create this person."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={editing ? "Edit person" : "Add a person"}
      description={
        editing
          ? "Update their details, role and reporting line — changes apply immediately."
          : "Create an employee, lead or admin. They set their own password from the activation link."
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
            disabled={loading || Boolean(loadError)}
            leftIcon={Save}
            className="sm:min-w-[10rem]"
          >
            {editing ? "Save changes" : "Create person"}
          </Button>
        </>
      }
    >
      {loadError ? (
        <p className="text-sm text-danger">
          {loadError.response?.data?.message ||
            "Couldn't open the form. Please close this and try again."}
        </p>
      ) : loading || !initialValues ? (
        <div className="grid gap-5 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <EmployeeForm
          key={initialValues.employeeId}
          embedded
          formId={formId}
          initialValues={initialValues}
          leads={leads}
          onSubmit={handleSubmit}
          submitting={submitting}
          readOnlyEmployeeId
        />
      )}
    </Modal>
  );
}
