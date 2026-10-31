import { Link } from "react-router-dom";
import type { UserRole } from "../../shared/types";
import { useUsers } from "../features/users/useUsers";
import { UserEditorForm } from "../features/users/UserEditorForm";
import styles from "./Admin.module.css";

const roleLabel = (role: UserRole) => role === "super_admin" ? "管理员" : "主持人";

export function AdminUsersPage() {
  const { viewer, allowed, users, loaded, error, status, busy, editor, draft, setDraft, closeEditor, save, remove, openCreate, openEdit, openPassword, openDelete } = useUsers();
  const deleting = editor?.kind === "delete" ? editor.user : null;
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>ADMINISTRATION / PEOPLE</p>
          <h1>
            账号管理<span>。</span>
          </h1>
          <p>为主持人分配账号，管理后台访问权限。</p>
        </div>
        {allowed && (
          <button className={styles.button} onClick={openCreate} disabled={busy || !loaded}>
            创建账号 +
          </button>
        )}
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className={styles.status} role="status">
          {status}
        </p>
      )}
      {!loaded ? (
        <p className={styles.empty}>正在加载账号…</p>
      ) : !allowed ? (
        <section className={styles.empty}>
          <h2>此页面仅限管理员</h2>
          {!viewer ? (
            <Link className={styles.button} to="/login?next=/admin/users">
              登录 ↗
            </Link>
          ) : (
            <Link to="/host" className={styles.button}>
              返回主持控制台 ↗
            </Link>
          )}
        </section>
      ) : (
        <>
          {editor && editor.kind !== "delete" && (
            <UserEditorForm editor={editor} draft={draft} busy={busy} onChange={setDraft} onSave={save} closeEditor={closeEditor} />
          )}
          {deleting && (
            <section className={styles.confirm} aria-label="确认删除账号">
              <h2>删除 {deleting.displayName || deleting.username}？</h2>
              <p>删除后，此账号将无法继续登录。</p>
              <div>
                <button
                  className={styles.danger}
                  disabled={busy}
                  onClick={remove}
                >
                  {busy ? "正在删除…" : "确认删除"}
                </button>
                <button
                  className={styles.secondary}
                  disabled={busy}
                  onClick={closeEditor}
                >
                  取消
                </button>
              </div>
            </section>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>账号</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.displayName || user.username}
                        {user.id === viewer?.id && (
                          <span className={styles.self}>你</span>
                        )}
                      </strong>
                      <small>@{user.username}</small>
                    </td>
                    <td>{roleLabel(user.role)}</td>
                    <td>
                      <span
                        className={
                          user.enabled ? styles.enabled : styles.disabled
                        }
                      >
                        {user.enabled ? "启用中" : "已停用"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button disabled={busy} onClick={() => openEdit(user)}>编辑</button>
                        <button
                          disabled={busy} onClick={() => openPassword(user)}
                        >
                          改密
                        </button>
                        <button
                          disabled={busy || user.id === viewer?.id}
                          onClick={() => openDelete(user)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!users.length && !error && <p className={styles.empty}>暂无账号。</p>}
        </>
      )}
    </main>
  );
}
