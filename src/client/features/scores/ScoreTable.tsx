import type { ScoreItem } from "../../../shared/types";
import styles from "../../pages/Scores.module.css";
const difficultyNames: Record<string, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
  endless: "无尽",
};

export function ScoreTable({ entries, tab, canDelete, onDelete }: { entries: ScoreItem[]; tab: "leaderboard" | "recent"; canDelete: boolean; onDelete: (score: ScoreItem) => void }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{tab === "leaderboard" ? "排名" : "序号"}</th>
            <th>玩家</th>
            <th>得分</th>
            <th>时长</th>
            <th>挑战时间</th>
            {canDelete && <th>操作</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((score, index) => (
            <tr key={score.id}>
              <td>
                <span
                  className={
                    index === 0 && tab === "leaderboard"
                      ? styles.firstRank
                      : styles.rank
                  }
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </td>
              <td>
                <strong>{score.username}</strong>
                {score.level && (
                  <small>
                    曲目 {score.level}
                    {score.difficulty &&
                      ` · ${difficultyNames[score.difficulty] || score.difficulty}`}
                  </small>
                )}
              </td>
              <td className={styles.score}>
                {score.score.toLocaleString("zh-CN")}
              </td>
              <td>{score.duration.toFixed(1)} s</td>
              <td className={styles.time}>
                {new Date(score.at).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              {canDelete && (
                <td>
                  <button
                    className={styles.delete}
                    onClick={() => onDelete(score)}
                  >
                    删除
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
