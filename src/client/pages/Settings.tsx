import { useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useIsPresent } from "motion/react";
import { ArrowLeft, Check, Download, Upload } from "lucide-react";
import type { GameSettings } from "../../shared/types";
import { useGameSettings } from "../features/game/useGameSettings";
import { useAuth } from "../lib/auth";
import { buildHomeThemeSearch, resolveHomeTheme, themeHref } from "../lib/home-theme";
import styles from "./Game.module.css";

const labels: Record<string, string> = {
  auto: "跟随难度",
  none: "不限制",
  avoid: "避开人脸",
  prefer: "优先人脸",
  only: "只切人脸",
  single: "单人卡面",
  multiple: "多人卡面",
  normal: "特训前",
  trained: "特训后",
  cool: "酷炫 · Cool",
  happy: "快乐 · Happy",
  powerful: "力量 · Powerful",
  pure: "纯真 · Pure",
  cute: "可爱 · Cute",
  mysterious: "神秘 · Mysterious",
};
const numbers = [
  ["roundSeconds", "每题秒数"],
  ["questionsPerPlayer", "每人题数"],
  ["correctPoints", "答对得分"],
  ["wrongPenalty", "答错扣分"],
  ["maxRecrops", "最多重切次数"],
  ["cropSize", "裁剪大小"],
  ["candidateCount", "裁剪候选数"],
  ["autoNextDelay", "自动下一题延迟（毫秒）"],
  ["avoidRecentCards", "避免重复卡面数"],
  ["avoidRecentCharacters", "避免重复角色数"],
];

export function SettingsPage() {
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const themeId = resolveHomeTheme(routeLocation.search);
  const isPresent = useIsPresent();
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const code = params.get("room");
  const isMemorial = themeId === "bluearchive" && !!code;
  const { settings, meta, roomTheme, teams, setTeams, error, notice, busy, change, changeDifficulty, save, importSettings, exportSettings } = useGameSettings(code, user?.id);
  useEffect(() => {
    if (roomTheme && roomTheme !== themeId)
      navigate({ pathname: routeLocation.pathname, search: buildHomeThemeSearch(routeLocation.search, roomTheme), hash: routeLocation.hash }, { replace: true });
  }, [roomTheme, themeId, navigate, routeLocation.pathname, routeLocation.search, routeLocation.hash]);
  if (!loading && !user && isPresent)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(routeLocation.pathname + routeLocation.search)}`}
        replace
      />
    );
  const readOnly = !code && user?.role !== "super_admin";
  function choices(
    key: string,
    title: string,
    options: { value: string | number; label: string }[],
  ) {
    const selected = settings?.[key] as (string | number)[];
    return (
      <div className={styles.filterGroup}>
        <h3>{title}</h3>
        <div className={styles.checks}>
          {options.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                disabled={
                  selected.length === 1 && selected.includes(option.value)
                }
                onChange={(event) =>
                  change(
                    key,
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((value) => value !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <main className="container page">
      <div className="page-heading">
        <Link className="text-link" to={themeHref(code ? `/host?room=${code}` : "/host", themeId)}>
          <ArrowLeft size={17} />
          返回主持台
        </Link>
        <h1>
          {code ? `房间 ${code}` : "默认游戏"}
          <em>设置。</em>
        </h1>
        <p>
          {code
            ? "此处设置仅影响当前房间。"
            : "新建房间和单人局使用这些默认规则。"}
        </p>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {readOnly && (
        <p className="notice">
          默认设置由超级管理员维护，你可以修改自己房间的设置。
        </p>
      )}
      {settings && meta && (
        <form onSubmit={save} className={styles.settingsForm}>
          <fieldset disabled={readOnly || busy}>
            <section>
              <h2>玩法与难度</h2>
              <div className={styles.fields}>
                <label>
                  计分模式
                  <select
                    value={settings.mode}
                    onChange={(e) => change("mode", e.target.value)}
                  >
                    <option value="single">个人计分</option>
                    <option value="versus">双队对抗</option>
                  </select>
                </label>
                <label>
                  难度
                  <select
                    value={settings.difficulty}
                    onChange={(e) => changeDifficulty(e.target.value as GameSettings["difficulty"])}
                  >
                    <option value="easy">简单</option>
                    <option value="normal">普通</option>
                    <option value="hard">困难</option>
                  </select>
                </label>
                {!isMemorial && <label>
                  人脸裁剪
                  <select
                    value={settings.faceCropMode}
                    onChange={(e) => change("faceCropMode", e.target.value)}
                  >
                    {meta.faceCropModes.map((value) => (
                      <option key={value} value={value}>
                        {labels[value]}
                      </option>
                    ))}
                  </select>
                </label>}
                {code &&
                  (["A", "B"] as const).map((team) => (
                    <label key={team}>
                      {team} 队名称
                      <input
                        maxLength={20}
                        value={teams[team].name}
                        onChange={(e) =>
                          setTeams((t) => ({
                            ...t,
                            [team]: { ...t[team], name: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
              </div>
              {!isMemorial && meta.faceBoxImages === 0 && (
                <p className="notice">
                  人脸数据尚未准备好，当前仅能使用不限人数与普通裁剪。
                </p>
              )}
            </section>
            <section>
              <h2>计时与分数</h2>
              <div className={styles.fields}>
                {numbers.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      required
                      min={meta.numericRanges[key][0]}
                      max={meta.numericRanges[key][1]}
                      value={Number(settings[key])}
                      onChange={(e) => change(key, e.target.valueAsNumber)}
                    />
                  </label>
                ))}
              </div>
              <div className={styles.checks}>
                {[
                  ["allowRecrop", "允许重切"],
                  ["showPlayerRecrop", "玩家可重切"],
                  ["showTimer", "显示倒计时"],
                  ["streakBonus", "连击加分"],
                  ["revealAfterJudge", "判定后揭晓"],
                  ["autoNext", "自动下一题"],
                  ["soundEnabled", "游戏提示音"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[key])}
                      onChange={(e) => change(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </section>
            <section>
              <h2>{isMemorial ? "记忆大厅筛选" : "卡池筛选"}</h2>
              {choices(
                "cardBands",
                isMemorial ? "学院" : themeId === "sekai" && code ? "组合" : "乐队",
                meta.bands.map((band) => ({
                  value: band.id,
                  label: band.name,
                })),
              )}
              {meta.rarities.length > 0 && choices(
                "cardRarities",
                "稀有度",
                meta.rarities.map((value) => ({ value, label: `${value} 星` })),
              )}
              {meta.attributes.length > 0 && choices(
                "cardAttributes",
                "属性",
                meta.attributes.map((value) => ({
                  value,
                  label: labels[value],
                })),
              )}
              {choices(
                "cardVariants",
                isMemorial ? "图片类型" : "卡面阶段",
                meta.cardVariants.map((value) => ({
                  value,
                  label: isMemorial ? "记忆大厅" : labels[value],
                })),
              )}
              {meta.faceBoxImages > 0 && choices(
                "cardCharacterLimits",
                "卡面人数",
                meta.cardCharacterLimits.map((value) => ({
                  value,
                  label: labels[value],
                })),
              )}
            </section>
            {!code && (
              <section>
                <h2>秒表挑战</h2>
                <div className={styles.fields}>
                  {[
                    ["stopwatchTargetSeconds", "目标秒数"],
                    ["stopwatchToleranceSeconds", "允许误差（秒）"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        required
                        min={meta.numericRanges[key][0]}
                        max={meta.numericRanges[key][1]}
                        step="0.01"
                        value={Number(settings[key])}
                        onChange={(e) => change(key, e.target.valueAsNumber)}
                      />
                    </label>
                  ))}
                </div>
              </section>
            )}
            <div className="actions">
              <button className="button pink" type="submit">
                {busy ? "正在保存" : "保存设置"} <Check size={18} />
              </button>
              <label className={`button outline ${styles.importButton}`}>
                <Upload size={18} />
                导入 JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  aria-label="导入设置 JSON"
                  onChange={(e) => {
                    void importSettings(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </fieldset>
          <button
            className="text-link"
            type="button"
            onClick={exportSettings}
            style={{ marginTop: 22 }}
          >
            <Download size={17} />
            导出当前设置
          </button>
        </form>
      )}
    </main>
  );
}
