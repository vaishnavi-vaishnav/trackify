import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { createProject, updateProject } from "../../services/projects";

const EMPTY = { name: "", description: "", status: "active" };

/**
 * Create or edit a project. One component for both so the fields, validation
 * and copy cannot drift apart between the two flows; passing a `project` puts
 * it in edit mode.
 */
export function ProjectFormModal({ open, onClose, project = null, onSaved }) {
  const editing = Boolean(project);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Reset whenever the dialog opens, so a cancelled edit never leaks its
  // half-typed values into the next one.
  useEffect(() => {
    if (!open) return;
    setForm(
      project
        ? {
            name: project.name,
            description: project.description ?? "",
            status: project.status,
          }
        : EMPTY,
    );
    setError(null);
  }, [open, project]);

  const save = async () => {
    if (!form.name.trim()) {
      setError("A project name is required.");
      return;
    }

    setSaving(true);
    try {
      const saved = editing
        ? await updateProject(project.id, form)
        : await createProject(form);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save this project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={editing ? `Edit ${project.name}` : "New project"}
      description={
        editing
          ? "Update the project's name, description or status."
          : "Give the project a name — you can assign leads once it exists."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            {editing ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => {
            setForm((f) => ({ ...f, name: e.target.value }));
            if (error) setError(null);
          }}
          placeholder="e.g. CWC"
          error={error}
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="What is this project for?"
        />
        {editing && (
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            hint="Archived projects stay in reports but are hidden from pickers"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        )}
      </div>
    </Modal>
  );
}
