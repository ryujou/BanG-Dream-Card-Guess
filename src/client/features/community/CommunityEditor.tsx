import { useState, type FormEvent } from "react";
import type { Community } from "../../../shared/types";
import { api } from "../../lib/api";
import { communityError, normalizeCommunity, type CommunityContent } from "./model";
import { AboutEditor, MembersEditor, EventsEditor, PhotosEditor, SocialEditor, VideosEditor } from "./CommunityEditorSections";
import styles from "../../pages/Community.module.css";

export function CommunityEditor({ initial }: { initial: CommunityContent }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  function change<K extends keyof CommunityContent>(key: K, value: CommunityContent[K]) {
    setData(current => ({ ...current, [key]: value }));
    setStatus("有修改尚未保存");
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setStatus("");
    try {
      const result = await api<Community>("/api/community", { method: "PUT", body: data });
      setData(normalizeCommunity(result)); setStatus("已保存，社区页面已更新。");
    } catch (error) { setError(communityError(error)); }
    finally { setSaving(false); }
  }
  return <>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <form onSubmit={save}>
      <fieldset className={styles.formFields} disabled={saving || uploading}>
        <AboutEditor aboutUs={data.aboutUs} onChange={value => change("aboutUs", value)} />
        <MembersEditor members={data.members} onChange={value => change("members", value)} onUploadingChange={setUploading} />
        <EventsEditor events={data.events} onChange={value => change("events", value)} onUploadingChange={setUploading} />
        <PhotosEditor photos={data.photos} onChange={value => change("photos", value)} onUploadingChange={setUploading} />
        <SocialEditor socialLinks={data.socialLinks} onChange={value => change("socialLinks", value)} />
        <VideosEditor bilibili={data.bilibili} onChange={value => change("bilibili", value)} onUploadingChange={setUploading} />
      </fieldset>
      <div className={styles.saveBar}>
        <p role="status">
          {uploading ? "正在上传图片，请稍候。" : status || "修改后请保存，让大家看见最新内容。"}
        </p>
        <button className={styles.button} type="submit" disabled={saving || uploading}>
          {saving ? "正在保存…" : "保存全部修改 ↗"}
        </button>
      </div>
    </form>
  </>;
}
