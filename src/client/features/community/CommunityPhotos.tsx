import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import { communityThumbnail, safeCommunityLink, type CommunityPhoto } from "./model";
import styles from "../../pages/Community.module.css";

const PAGE_SIZE = 6;

function PhotoImage({ src, title, preview = false }: { src: string; title: string; preview?: boolean }) {
  const [state, setState] = useState("loading");
  return <span className={`${styles.photoImage} ${preview ? styles.photoPreview : ""}`}>
    {state !== "loaded" && <span className={styles.photoStatus} role="status">
      {state === "error" ? "图片暂时无法加载" : "图片加载中…"}
    </span>}
    <img src={safeCommunityLink(src, location.origin)} alt={title} loading={preview ? "eager" : "lazy"}
      decoding="async" onLoad={() => setState("loaded")} onError={() => setState("error")}
      style={{ opacity: state === "loaded" ? 1 : 0 }} />
  </span>;
}

export function CommunityPhotos({ photos }: { photos: CommunityPhoto[] }) {
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [opened, setOpened] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const grouped = photos.some(photo => photo.album?.trim());
  const albums = new Map<string, CommunityPhoto[]>();
  for (const photo of photos) {
    const name = photo.album?.trim() || "活动返图";
    const album = albums.get(name) || [];
    album.push(photo);
    albums.set(name, album);
  }
  const current = grouped ? (albums.get(selectedAlbum || "") || []) : photos;
  const preview = opened === null ? null : current[opened];

  useEffect(() => {
    if (!preview) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [preview]);

  return <>
    {!photos.length ? <p className={styles.empty}>回忆，正在积累中。</p> : grouped && selectedAlbum === null ? (
      <div className={styles.albumGrid} aria-label="活动相册列表">
        {[...albums].map(([name, entries]) => {
          const cover = entries[0];
          const src = cover.thumbnail || communityThumbnail(cover.url);
          return <button className={styles.albumCard} key={name} type="button"
            onClick={() => { setSelectedAlbum(name); setVisible(PAGE_SIZE); }}>
            <PhotoImage key={src} src={src} title={`${name}相册封面`} />
            <span className={styles.albumCaption}><strong>{name}</strong><span>{entries.length} 张照片 ↗</span></span>
          </button>;
        })}
      </div>
    ) : <>
      {grouped && <div className={styles.albumHeading}>
        <button className={styles.secondary} type="button" onClick={() => setSelectedAlbum(null)}><ArrowLeft size={16} aria-hidden="true" /> 返回相册</button>
        <h3>{selectedAlbum}</h3><span>{current.length} 张照片</span>
      </div>}
      {!current.length && <p className={styles.empty}>这个相册还没有照片。</p>}
      <div className={styles.photos} aria-label="相册照片">
        {current.slice(0, visible).map((photo, index) => {
          const title = photo.title || `活动返图 ${index + 1}`;
          const src = photo.thumbnail || communityThumbnail(photo.url);
          return <figure key={`${photo.url}-${index}`}>
            <button type="button" className={styles.photoButton} aria-label={`放大查看：${title}`} onClick={() => setOpened(index)}>
              <PhotoImage key={src} src={src} title={title} />
            </button>
            {(photo.title || photo.desc) && <figcaption><strong>{photo.title}</strong><p>{photo.desc}</p></figcaption>}
          </figure>;
        })}
      </div>
      {visible < current.length && <button type="button" className={`${styles.secondary} ${styles.morePhotos}`} onClick={() => setVisible(count => count + PAGE_SIZE)}>
        加载更多照片（{Math.min(visible, current.length)} / {current.length}）
      </button>}
    </>}
    {preview && <dialog ref={dialog} className={styles.photoDialog} aria-labelledby="photo-preview-title"
      onClose={() => setOpened(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      onKeyDown={event => {
        if (event.key === "ArrowLeft" && opened! > 0) { event.preventDefault(); setOpened(opened! - 1); }
        if (event.key === "ArrowRight" && opened! < current.length - 1) { event.preventDefault(); setOpened(opened! + 1); }
      }}>
      <div className={styles.previewHeading}>
        <h2 id="photo-preview-title">{preview.title || `活动返图 ${opened! + 1}`}</h2>
        <button type="button" className="icon-button" aria-label="关闭图片预览" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button>
      </div>
      <PhotoImage key={preview.url} src={preview.url} title={preview.title || "活动照片预览"} preview />
      {preview.desc && <p className={styles.previewDescription}>{preview.desc}</p>}
      <div className={styles.previewControls}>
        <button type="button" className="icon-button" aria-label="上一张照片" disabled={opened === 0} onClick={() => setOpened(opened! - 1)}><ChevronLeft aria-hidden="true" /></button>
        <span>{opened! + 1} / {current.length}</span>
        <button type="button" className="icon-button" aria-label="下一张照片" disabled={opened === current.length - 1} onClick={() => setOpened(opened! + 1)}><ChevronRight aria-hidden="true" /></button>
      </div>
    </dialog>}
  </>;
}
