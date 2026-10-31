import { useEffect, useState } from "react";
import type { User, UserRole } from "../../../shared/types";
import { api, errorText } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export type UserEditor =
  | { kind: "create" }
  | { kind: "edit"; user: User }
  | { kind: "password"; user: User }
  | { kind: "delete"; user: User };
export interface UserDraft {
  username: string;
  displayName: string;
  role: UserRole;
  password: string;
  enabled: boolean;
}
const emptyDraft: UserDraft = {
  username: "", displayName: "", role: "host", password: "", enabled: true,
};

export function useUsers() {
  const auth = useAuth();
  const allowed = auth.user?.role === "super_admin";
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<UserEditor | null>(null);
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);

  useEffect(() => {
    let active = true;
    setUsers([]);
    setEditor(null);
    setDraft(emptyDraft);
    setLoaded(false);
    setError("");
    setStatus("");
    if (auth.loading) return;
    if (!allowed) {
      setLoaded(true);
      return;
    }
    api<{ users: User[] }>("/api/admin/users")
      .then(result => { if (active) setUsers(result.users); })
      .catch(error => { if (active) setError(errorText(error)); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [auth.loading, auth.user?.id, allowed]);

  function closeEditor() {
    setEditor(null);
    setDraft(emptyDraft);
  }
  function open(next: UserEditor) {
    setEditor(next);
    setDraft(next.kind === "edit" ? { ...next.user, password: "" } : emptyDraft);
    setError("");
    setStatus("");
  }
  async function save() {
    if (!allowed || busy || !editor || editor.kind === "delete") return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      if (editor.kind === "password") {
        await api(
          `/api/admin/users/${encodeURIComponent(editor.user.id)}/reset-password`,
          { method: "POST", body: { password: draft.password } },
        );
        setStatus(`已重置 ${editor.user.displayName || editor.user.username} 的密码。`);
        if (editor.user.id === auth.user?.id) await auth.refresh();
      } else {
        const editing = editor.kind === "edit" ? editor.user : null;
        const { username, displayName, password, role, enabled } = draft;
        const result = await api<{ user: User }>(
          editing ? `/api/admin/users/${encodeURIComponent(editing.id)}` : "/api/admin/users",
          {
            method: editing ? "PATCH" : "POST",
            body: editing
              ? { displayName, role, enabled }
              : { username, displayName, password, role, enabled },
          },
        );
        setUsers(current => current.some(item => item.id === result.user.id)
          ? current.map(item => item.id === result.user.id ? result.user : item)
          : [...current, result.user]);
        setStatus(editing ? "账号信息已更新。" : "账号已创建。");
        if (editing?.id === auth.user?.id) await auth.refresh();
      }
      closeEditor();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!allowed || busy || editor?.kind !== "delete") return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await api(`/api/admin/users/${encodeURIComponent(editor.user.id)}`, { method: "DELETE" });
      setUsers(current => current.filter(user => user.id !== editor.user.id));
      setStatus("账号已删除。");
      closeEditor();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return {
    viewer: auth.user, allowed, users, loaded: !auth.loading && loaded, error: error || auth.error, status, busy,
    editor, draft, setDraft, closeEditor, save, remove,
    openCreate: () => open({ kind: "create" }),
    openEdit: (user: User) => open({ kind: "edit", user }),
    openPassword: (user: User) => open({ kind: "password", user }),
    openDelete: (user: User) => open({ kind: "delete", user }),
  };
}
