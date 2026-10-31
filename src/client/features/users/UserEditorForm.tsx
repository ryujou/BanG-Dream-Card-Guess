import type { FormEvent } from "react";
import type { UserRole } from "../../../shared/types";
import type { UserDraft, UserEditor } from "./useUsers";
import styles from "../../pages/Admin.module.css";

export function UserEditorForm({ editor, draft, busy, onChange, onSave, closeEditor }: {
  editor: Exclude<UserEditor, { kind: "delete" }>;
  draft: UserDraft;
  busy: boolean;
  onChange: (draft: UserDraft) => void;
  onSave: () => Promise<void>;
  closeEditor: () => void;
}) {
  const creating = editor.kind === "create";
  const editing = editor.kind === "edit" ? editor.user : null;
  const resetting = editor.kind === "password" ? editor.user : null;
  const { username, displayName, role, password, enabled } = draft;
  function save(event: FormEvent) { event.preventDefault(); void onSave(); }
  return (
    <section className={styles.editor}>
      <header>
        <div>
          <p className={styles.eyebrow}>
            {resetting
              ? "PASSWORD"
              : editing
                ? "EDIT ACCOUNT"
                : "NEW ACCOUNT"}
          </p>
          <h2>
            {resetting
              ? `重置 ${resetting.displayName || resetting.username} 的密码`
              : editing
                ? "编辑账号"
                : "创建账号"}
          </h2>
        </div>
        <button
          className={styles.textButton}
          onClick={closeEditor}
          disabled={busy}
        >
          取消
        </button>
      </header>
      <form onSubmit={save}>
        <fieldset disabled={busy} className={styles.fields}>
          {!resetting && (
            <>
              <label>
                登录用户名
                <input
                  required
                  minLength={3}
                  maxLength={32}
                  pattern={"[A-Za-z0-9_\\-]+"}
                  value={username}
                  readOnly={!!editing}
                  autoComplete="off"
                  onChange={(event) => onChange({ ...draft, username: event.target.value })}
                />
                <small>
                  {editing
                    ? "用户名创建后不可修改。"
                    : "3—32 位字母、数字、下划线或连字符。"}
                </small>
              </label>
              <label>
                显示名称
                <input
                  required
                  maxLength={40}
                  value={displayName}
                  onChange={(event) =>
                    onChange({ ...draft, displayName: event.target.value })
                  }
                />
              </label>
              <label>
                角色
                <select
                  value={role}
                  onChange={(event) =>
                    onChange({ ...draft, role: event.target.value as UserRole })
                  }
                >
                  <option value="host">主持人</option>
                  <option value="super_admin">管理员</option>
                </select>
              </label>
              <label>
                账号状态
                <select
                  value={enabled ? "enabled" : "disabled"}
                  onChange={(event) =>
                    onChange({ ...draft, enabled: event.target.value === "enabled" })
                  }
                >
                  <option value="enabled">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
            </>
          )}
          {(creating || resetting) && (
            <label>
              {resetting ? "新密码" : "初始密码"}
              <input
                required
                minLength={10}
                maxLength={128}
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(event) => onChange({ ...draft, password: event.target.value })}
              />
              <small>10—128 个字符。</small>
            </label>
          )}
        </fieldset>
        <p className={styles.hint}>
          主持人管理自己的房间；管理员还可管理账号、社区内容和全站设置。
        </p>
        <button className={styles.button} type="submit" disabled={busy}>
          {busy
            ? "正在保存…"
            : resetting
              ? "确认重置密码"
              : "保存账号 ↗"}
        </button>
      </form>
    </section>
  );
}
