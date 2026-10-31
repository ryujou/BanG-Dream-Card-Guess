import { useState, type ChangeEvent, type ReactNode } from "react";
import { api } from "../../lib/api";
import { communityError, safeCommunityLink } from "./model";
import styles from "../../pages/Community.module.css";
const safeLink = (value: string) => safeCommunityLink(value, location.origin);

export function Field({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={styles.field}>
      <span>
        {label}
        {required && " *"}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          rows={3}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

export function ImageField({
  label,
  value,
  onChange,
  onUploadingChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("图片不能超过 5 MB。");
      event.target.value = "";
      return;
    }
    setBusy(true);
    onUploadingChange?.(true);
    setError("");
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("无法读取这张图片。"));
        reader.readAsDataURL(file);
      });
      const result = await api<{ url: string }>("/api/uploads", {
        method: "POST",
        body: { image },
      });
      onChange(result.url);
    } catch (error) {
      setError(communityError(error));
    } finally {
      setBusy(false);
      onUploadingChange?.(false);
      event.target.value = "";
    }
  }
  return (
    <div className={styles.imageField} role="group" aria-label={label}>
      <Field
        label={label}
        value={value}
        onChange={onChange}
        placeholder="图片链接或上传本地图片"
      />
      <div className={styles.uploadRow}>
        {value && safeLink(value) && <img src={safeLink(value)} alt={label} />}
        <label className={styles.uploadButton}>
          {busy ? "上传中…" : "上传图片"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={upload}
          />
        </label>
        {error && (
          <span className={styles.error} role="alert">
            {error}
          </span>
        )}
      </div>
      <p className={styles.hint}>PNG / JPEG / WebP，最大 5 MB。</p>
    </div>
  );
}

export function EditorSection({
  title,
  number,
  children,
  onAdd,
}: {
  title: string;
  number: string;
  children: ReactNode;
  onAdd?: () => void;
}) {
  return (
    <section className={styles.editorSection} aria-label={title}>
      <div className={styles.editorHeading}>
        <div>
          <span className={styles.eyebrow}>{number}</span>
          <h2>{title}</h2>
        </div>
        {onAdd && (
          <button type="button" className={styles.secondary} onClick={onAdd}>
            + 添加
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function RowActions({
  index,
  length,
  onMove,
  onRemove,
}: {
  index: number;
  length: number;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.rowActions}>
      <span>第 {index + 1} 项</span>
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>
        ↑ 上移
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === length - 1}
      >
        ↓ 下移
      </button>
      <button type="button" onClick={onRemove}>
        删除
      </button>
    </div>
  );
}

