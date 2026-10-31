import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import styles from "./ChangePassword.module.css";

export function ChangePassword() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/login", { replace: true });
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  return (
    <details className={styles.panel}>
      <summary>
        <span>修改登录密码</span>
        <span className={styles.icon} aria-hidden="true">
          +
        </span>
      </summary>
      <form onSubmit={handleChangePassword}>
        <p className={styles.hint}>
          新密码需为 10—128 个字符。修改后需要重新登录。
        </p>
        <fieldset className={styles.fields} disabled={busy}>
          <label>
            当前密码
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            新密码
            <input
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
        </fieldset>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button className={styles.button} disabled={busy} type="submit">
          {busy ? "正在更新密码…" : "更新密码并重新登录"}
        </button>
      </form>
    </details>
  );
}
