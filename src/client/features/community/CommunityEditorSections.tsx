import { Field, ImageField, EditorSection, RowActions } from "./EditorFields";
import { moveCommunityItem, type CommunityContent } from "./model";
import styles from "../../pages/Community.module.css";

export function AboutEditor({ aboutUs, onChange }: { aboutUs: CommunityContent["aboutUs"]; onChange: (value: CommunityContent["aboutUs"]) => void }) {
  return (
    <EditorSection title="关于同好会" number="01 / ABOUT">
      <Field
        label="社团简介"
        value={aboutUs}
        onChange={(value) => onChange(value)}
        multiline
      />
    </EditorSection>
  );
}

export function MembersEditor({ members, onChange, onUploadingChange }: { members: CommunityContent["members"]; onChange: (value: CommunityContent["members"]) => void; onUploadingChange: (uploading: boolean) => void }) {
  return (
    <EditorSection
      title="成员介绍"
      number="02 / MEMBERS"
      onAdd={() =>
        onChange([
          ...members,
          { name: "", desc: "", url: "", image: "" },
        ])
      }
    >
      {!members.length && (
        <p className={styles.hint}>
          还没有成员介绍，点击“添加”开始录入。
        </p>
      )}
      {members.map((member, index) => (
        <div className={styles.editorRow} key={index}>
          <RowActions
            index={index}
            length={members.length}
            onMove={(offset) =>
              onChange(moveCommunityItem(members, index, offset))
            }
            onRemove={() =>
              onChange(members.filter((_, i) => i !== index),
              )
            }
          />
          <div className={styles.fields}>
            <Field
              label="昵称"
              required
              value={member.name}
              onChange={(value) =>
                onChange(members.map((item, i) =>
                  i === index ? { ...item, name: value } : item,
                ),
                )
              }
            />
            <Field
              label="头衔 / 描述"
              value={member.desc}
              onChange={(value) =>
                onChange(members.map((item, i) =>
                  i === index ? { ...item, desc: value } : item,
                ),
                )
              }
            />
            <Field
              label="个人主页链接"
              value={member.url}
              onChange={(value) =>
                onChange(members.map((item, i) =>
                  i === index ? { ...item, url: value } : item,
                ),
                )
              }
            />
            <ImageField
              label="成员头像"
              onUploadingChange={onUploadingChange}
              value={member.image || ""}
              onChange={(value) =>
                onChange(members.map((item, i) =>
                  i === index ? { ...item, image: value } : item,
                ),
                )
              }
            />
          </div>
        </div>
      ))}
    </EditorSection>
  );
}

export function EventsEditor({ events, onChange, onUploadingChange }: { events: CommunityContent["events"]; onChange: (value: CommunityContent["events"]) => void; onUploadingChange: (uploading: boolean) => void }) {
  return (
    <EditorSection
      title="近期活动"
      number="03 / EVENTS"
      onAdd={() =>
        onChange([
          ...events,
          {
            title: "",
            date: "",
            location: "",
            desc: "",
            image: "",
            url: "",
          },
        ])
      }
    >
      {!events.length && (
        <p className={styles.hint}>
          还没有活动，点击“添加”发布下一次见面。
        </p>
      )}
      {events.map((event, index) => (
        <div className={styles.editorRow} key={index}>
          <RowActions
            index={index}
            length={events.length}
            onMove={(offset) =>
              onChange(moveCommunityItem(events, index, offset))
            }
            onRemove={() =>
              onChange(events.filter((_, i) => i !== index),
              )
            }
          />
          <div className={styles.fields}>
            {(["title", "date", "location", "url"] as const).map(
              (key, fieldIndex) => (
                <Field
                  key={key}
                  label={
                    ["活动名称", "日期 / 时间", "地点", "活动详情链接"][
                    fieldIndex
                    ]
                  }
                  required={key === "title"}
                  value={event[key] || ""}
                  onChange={(value) =>
                    onChange(events.map((item, i) =>
                      i === index ? { ...item, [key]: value } : item,
                    ),
                    )
                  }
                />
              ),
            )}
            <Field
              label="活动简介"
              value={event.desc}
              multiline
              onChange={(value) =>
                onChange(events.map((item, i) =>
                  i === index ? { ...item, desc: value } : item,
                ),
                )
              }
            />
            <ImageField
              label="活动图片"
              onUploadingChange={onUploadingChange}
              value={event.image || ""}
              onChange={(value) =>
                onChange(events.map((item, i) =>
                  i === index ? { ...item, image: value } : item,
                ),
                )
              }
            />
          </div>
        </div>
      ))}
    </EditorSection>
  );
}

export function PhotosEditor({ photos, onChange, onUploadingChange }: { photos: CommunityContent["photos"]; onChange: (value: CommunityContent["photos"]) => void; onUploadingChange: (uploading: boolean) => void }) {
  return (
    <EditorSection
      title="活动相册"
      number="04 / PHOTOS"
      onAdd={() =>
        onChange([...photos, { url: "", title: "", desc: "" }])
      }
    >
      {!photos.length && (
        <p className={styles.hint}>还没有活动返图。</p>
      )}
      {photos.map((photo, index) => (
        <div className={styles.editorRow} key={index}>
          <RowActions
            index={index}
            length={photos.length}
            onMove={(offset) =>
              onChange(moveCommunityItem(photos, index, offset))
            }
            onRemove={() =>
              onChange(photos.filter((_, i) => i !== index),
              )
            }
          />
          <div className={styles.fields}>
            <ImageField
              label="照片"
              onUploadingChange={onUploadingChange}
              value={photo.url}
              onChange={(value) =>
                onChange(photos.map((item, i) =>
                  i === index ? { ...item, url: value, thumbnail: "" } : item,
                ),
                )
              }
            />
            <div>
              <Field
                label="所属相册"
                value={photo.album || ""}
                onChange={(value) =>
                  onChange(photos.map((item, i) =>
                    i === index ? { ...item, album: value } : item,
                  ))
                }
              />
              <Field
                label="照片标题"
                value={photo.title || ""}
                onChange={(value) =>
                  onChange(photos.map((item, i) =>
                    i === index ? { ...item, title: value } : item,
                  ),
                  )
                }
              />
              <Field
                label="照片文案"
                value={photo.desc || ""}
                multiline
                onChange={(value) =>
                  onChange(photos.map((item, i) =>
                    i === index ? { ...item, desc: value } : item,
                  ),
                  )
                }
              />
            </div>
          </div>
        </div>
      ))}
    </EditorSection>
  );
}

export function SocialEditor({ socialLinks, onChange }: { socialLinks: CommunityContent["socialLinks"]; onChange: (value: CommunityContent["socialLinks"]) => void }) {
  return (
    <EditorSection
      title="社交平台"
      number="05 / SOCIAL"
      onAdd={() =>
        onChange([
          ...socialLinks,
          { title: "", url: "" },
        ])
      }
    >
      {!socialLinks.length && (
        <p className={styles.hint}>还没有社交平台链接。</p>
      )}
      {socialLinks.map((link, index) => (
        <div className={styles.editorRow} key={index}>
          <RowActions
            index={index}
            length={socialLinks.length}
            onMove={(offset) =>
              onChange(moveCommunityItem(socialLinks, index, offset),
              )
            }
            onRemove={() =>
              onChange(socialLinks.filter((_, i) => i !== index),
              )
            }
          />
          <div className={styles.fields}>
            <Field
              label="平台名称"
              required
              value={link.title}
              onChange={(value) =>
                onChange(socialLinks.map((item, i) =>
                  i === index ? { ...item, title: value } : item,
                ),
                )
              }
            />
            <Field
              label="平台链接"
              required
              value={link.url}
              onChange={(value) =>
                onChange(socialLinks.map((item, i) =>
                  i === index ? { ...item, url: value } : item,
                ),
                )
              }
            />
          </div>
        </div>
      ))}
    </EditorSection>
  );
}

export function VideosEditor({ bilibili, onChange, onUploadingChange }: { bilibili: CommunityContent["bilibili"]; onChange: (value: CommunityContent["bilibili"]) => void; onUploadingChange: (uploading: boolean) => void }) {
  return (
    <EditorSection
      title="Bilibili 视频"
      number="06 / VIDEOS"
      onAdd={() =>
        onChange([
          ...(bilibili || []),
          { bvid: "", title: "", cover: "" },
        ])
      }
    >
      {!bilibili?.length && (
        <p className={styles.hint}>还没有活动视频。</p>
      )}
      {bilibili?.map((video, index) => (
        <div className={styles.editorRow} key={index}>
          <RowActions
            index={index}
            length={bilibili.length}
            onMove={(offset) =>
              onChange(moveCommunityItem(bilibili, index, offset))
            }
            onRemove={() =>
              onChange(bilibili.filter((_, i) => i !== index),
              )
            }
          />
          <div className={styles.fields}>
            <div>
              <Field
                label="视频 BV 号"
                required
                value={video.bvid}
                placeholder="BV…"
                onChange={(value) =>
                  onChange(bilibili.map((item, i) =>
                    i === index ? { ...item, bvid: value } : item,
                  ),
                  )
                }
              />
              <Field
                label="视频标题"
                value={video.title || ""}
                onChange={(value) =>
                  onChange(bilibili.map((item, i) =>
                    i === index ? { ...item, title: value } : item,
                  ),
                  )
                }
              />
            </div>
            <ImageField
              label="视频封面"
              onUploadingChange={onUploadingChange}
              value={video.cover || ""}
              onChange={(value) =>
                onChange(bilibili.map((item, i) =>
                  i === index ? { ...item, cover: value } : item,
                ),
                )
              }
            />
          </div>
        </div>
      ))}
    </EditorSection>
  );
}
