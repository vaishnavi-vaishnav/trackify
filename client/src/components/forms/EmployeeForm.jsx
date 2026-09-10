import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { fullName } from "../../lib/format";

const EMPTY_VALUES = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  department: "",
  designation: "",
  joiningDate: "",
  role: "employee",
  leadId: "",
};

const ROLE_OPTIONS = [
  { value: "employee", label: "Employee — reports to a lead" },
  { value: "lead", label: "Lead — approves their team's leave" },
  { value: "admin", label: "Admin — full access" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,}$/;

function validate(values) {
  const errors = {};
  if (!values.employeeId.trim()) {
    errors.employeeId = "Employee ID is required.";
  } else if (values.employeeId.trim().length < 3) {
    errors.employeeId = "Use at least 3 characters.";
  }
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (values.phone.trim() && !PHONE_RE.test(values.phone.trim())) {
    errors.phone = "Enter a valid phone number.";
  }
  return errors;
}

/**
 * Shared add/edit person form. Owns field state and inline validation; the
 * parent supplies `initialValues`, an `onSubmit(values)` handler, the list of
 * `leads` to choose from, and the submit label / busy state.
 *
 * Two presentations from one component: a standalone page (its own card and
 * action row) and an embedded one for a dialog, where the buttons belong to
 * the dialog's footer. In the embedded case the caller passes `formId` and
 * points a footer `<button type="submit" form={formId}>` at it, so the form
 * still submits on Enter even though the button sits outside it.
 */
export function EmployeeForm({
  initialValues,
  onSubmit,
  leads = [],
  submitLabel = "Save changes",
  submitting = false,
  onCancel,
  readOnlyEmployeeId = false,
  embedded = false,
  formId,
}) {
  const [values, setValues] = useState({ ...EMPTY_VALUES, ...initialValues });
  const [errors, setErrors] = useState({});

  // Only employees report to a lead, so the picker disappears for the other
  // roles rather than offering a choice the server would reject.
  const showLeadPicker = values.role === "employee";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: value,
      // Switching away from "employee" drops any lead already chosen.
      ...(name === "role" && value !== "employee" ? { leadId: "" } : {}),
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    onSubmit({
      ...values,
      // The API takes a numeric id or an explicit null meaning "no lead".
      leadId: showLeadPicker && values.leadId ? Number(values.leadId) : null,
      joiningDate: values.joiningDate || null,
    });
  };

  const form = (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Employee ID"
          name="employeeId"
          value={values.employeeId}
          onChange={handleChange}
          placeholder="e.g. 00000001"
          error={errors.employeeId}
          hint={readOnlyEmployeeId ? "Generated automatically" : undefined}
          required
          disabled={readOnlyEmployeeId}
        />
        <Select
          label="Role"
          name="role"
          value={values.role}
          onChange={handleChange}
          required
          hint="Decides what this person can see and do"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Input
          label="First name"
          name="firstName"
          value={values.firstName}
          onChange={handleChange}
          placeholder="e.g. Alex"
          error={errors.firstName}
          required
        />
        <Input
          label="Last name"
          name="lastName"
          value={values.lastName}
          onChange={handleChange}
          placeholder="e.g. Morgan"
          error={errors.lastName}
          required
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={values.email}
          onChange={handleChange}
          placeholder="alex.morgan@company.com"
          error={errors.email}
          required
        />
        <Input
          label="Phone"
          name="phone"
          type="tel"
          value={values.phone}
          onChange={handleChange}
          placeholder="+1 555 000 1234"
          error={errors.phone}
          hint="Optional"
        />
        <Input
          label="Department"
          name="department"
          value={values.department}
          onChange={handleChange}
          placeholder="e.g. Engineering"
        />
        <Input
          label="Designation"
          name="designation"
          value={values.designation}
          onChange={handleChange}
          placeholder="e.g. Senior Developer"
        />
        <Input
          label="Joining date"
          name="joiningDate"
          type="date"
          value={values.joiningDate ?? ""}
          onChange={handleChange}
          hint="Optional"
        />

        {showLeadPicker && (
          <Select
            label="Reports to"
            name="leadId"
            value={values.leadId ?? ""}
            onChange={handleChange}
            hint={
              leads.length
                ? "Their leave requests go to this lead for approval"
                : "No leads exist yet — create one first, then assign this employee"
            }
          >
            <option value="">No lead assigned</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {fullName(lead.first_name, lead.last_name)} ({lead.employee_id})
              </option>
            ))}
          </Select>
        )}
      </div>

      {!embedded && (
        <div className="mt-7 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} leftIcon={ArrowLeft}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            loading={submitting}
            leftIcon={Save}
            className="sm:min-w-[10rem]"
          >
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );

  if (embedded) return form;

  return <Card className="max-w-3xl p-6 sm:p-7">{form}</Card>;
}
