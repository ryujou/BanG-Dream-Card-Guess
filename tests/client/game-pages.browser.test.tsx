import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter } from "react-router-dom";
import { GamePage } from "../../src/client/pages/Game";
import { useGame } from "../../src/client/features/game/useGame";
import { cropImage, fullImage, snapshot } from "./game-fixtures";

vi.mock("../../src/client/features/game/useGame", async original => ({ ...await original<typeof import("../../src/client/features/game/useGame")>(), useGame: vi.fn() }));
vi.mock("../../src/client/features/game/useGameSound", () => ({ useGameSound: vi.fn() }));
const command = vi.fn(), reconnect = vi.fn();
let live = snapshot();
function game(role: "host" | "player" | "self" = "player", entry = "/player?room=ABC123") {
  vi.mocked(useGame).mockReturnValue({ state: live, connected: true, error: "", command, reconnect });
  return <MemoryRouter initialEntries={[entry]}><GamePage role={role} /></MemoryRouter>;
}
beforeEach(() => { live = snapshot(); command.mockClear(); reconnect.mockClear(); });
afterEach(() => vi.restoreAllMocks());

test("a player sees a crop and hidden finished history; only an explicit revealed state displays the answer", async () => {
  live = snapshot({ status: "finished", total: 1, message: "本轮结束", history: [{ result: "wrong", name: "", team: "A", at: 1 }] });
  const view = await render(game());
  await expect.element(page.getByRole("img", { name: "本题卡面局部" })).toHaveAttribute("src", cropImage);
  await expect.element(page.getByText("答案未揭晓")).toBeVisible();
  await expect.element(page.getByText("户山香澄", { exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "揭晓", exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "换个局部" })).not.toBeInTheDocument();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "v" })); expect(command).not.toHaveBeenCalled();
  live = snapshot({ status: "revealed", history: [{ result: "wrong", name: "户山香澄", team: "A", at: 1 }] });
  await view.rerender(game());
  await expect.element(page.getByRole("img", { name: "户山香澄" })).toHaveAttribute("src", fullImage);
  await expect.element(page.getByRole("heading", { name: "户山香澄" })).toBeVisible();
  live = snapshot({ status: "playing" }, { showPlayerRecrop: true, maxRecrops: 0 }); await view.rerender(game());
  await expect.element(page.getByRole("button", { name: "换个局部" })).toBeDisabled();
});

test("host controls send the intended commands, gate judging and reset, and show both teams", async () => {
  live = snapshot({ canUndo: true }, { mode: "versus", showTimer: false });
  const view = await render(game("host", "/host?room=ABC123"));
  await expect.element(page.getByText("主持专用 · 本题答案")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "隐藏答案" })).toBeDisabled();
  await expect.element(page.getByRole("button", { name: "清空本局" })).toBeDisabled();
  await expect.element(page.getByText("红队", { exact: true })).toBeVisible();
  for (const [name, action] of [["开始 / 下一题", "next"], ["换个局部", "recrop"], ["揭晓", "reveal"], ["答对", "correct"], ["答错", "wrong"], ["跳过", "skip"], ["撤销", "undo"], ["停止", "stop"]]) {
    await page.getByRole("button", { name, exact: true }).click(); expect(command).toHaveBeenLastCalledWith(action);
  }
  await page.getByRole("button", { name: "切换到本队" }).nth(1).click(); expect(command).toHaveBeenLastCalledWith("team", { team: "B" });
  live = snapshot({ status: "revealed" }); await view.rerender(game("host"));
  await expect.element(page.getByRole("button", { name: "答对", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "隐藏答案" }).click(); expect(command).toHaveBeenLastCalledWith("hideAnswer");
  live = snapshot({ status: "stopped", current: null, total: 2 }); await view.rerender(game("host"));
  await page.getByRole("button", { name: "清空本局" }).click(); expect(command).toHaveBeenLastCalledWith("reset");
});

test("host shortcuts ignore editing and modifiers and are removed on unmount", async () => {
  const view = await render(game("host"));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", cancelable: true }));
  expect(command).toHaveBeenLastCalledWith("reveal"); command.mockClear();
  const input = document.createElement("input"); document.body.append(input);
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", ctrlKey: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" }));
  expect(command).not.toHaveBeenCalled(); input.remove();
  await view.unmount(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "v" })); expect(command).not.toHaveBeenCalled();
});

test("solo guesses and reset require user actions; cancel preserves the round", async () => {
  const view = await render(game("self", "/solo"));
  await page.getByLabelText("角色名字或昵称").fill("香澄");
  await page.getByRole("button", { name: "提交", exact: true }).click();
  expect(command).toHaveBeenLastCalledWith("selfGuess", { guess: "香澄" });
  await expect.element(page.getByLabelText("角色名字或昵称")).toHaveValue("");
  await page.getByRole("button", { name: "重置本局" }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(command).not.toHaveBeenCalledWith("reset");
  await page.getByRole("button", { name: "重置本局" }).click();
  await page.getByRole("button", { name: "确认重置" }).click(); expect(command).toHaveBeenLastCalledWith("reset");
  await page.getByRole("button", { name: "停止游戏" }).click(); expect(command).toHaveBeenLastCalledWith("stop");
  live = snapshot({ current: null, status: "idle", loading: true }); await view.rerender(game("self"));
  await expect.element(page.getByRole("button", { name: "开始挑战" })).toBeDisabled();
  live = snapshot({ current: null, status: "idle" }); await view.rerender(game("self"));
  await page.getByRole("button", { name: "开始挑战" }).click(); expect(command).toHaveBeenLastCalledWith("start");
});

test.each(["sekai", "bluearchive"] as const)("connection and fullscreen errors remain actionable, and server %s theme drives navigation links", async theme => {
  live.room.theme = theme;
  const tree = game("player"); vi.mocked(useGame).mockReturnValue({ state: live, connected: false, error: "连接已断开", command, reconnect });
  const view = await render(tree);
  await expect.element(page.getByRole("alert")).toHaveTextContent("连接已断开");
  await page.getByRole("button", { name: "重新连接" }).click(); expect(reconnect).toHaveBeenCalledOnce();
  await expect.element(page.getByRole("link", { name: "返回游戏大厅" })).toHaveAttribute("href", `/games?theme=${theme}`);
  vi.spyOn(HTMLElement.prototype, "requestFullscreen").mockRejectedValue(new Error("denied"));
  await view.rerender(game()); await page.getByRole("button", { name: "全屏", exact: true }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent("当前浏览器不支持全屏");
});

test("without a room the player gets the join form instead of game controls", async () => {
  const tree = game("player", "/player?theme=sekai");
  vi.mocked(useGame).mockReturnValue({ state: null, connected: false, error: "", command, reconnect });
  await render(tree);
  await expect.element(page.getByRole("heading", { name: "一起，猜中这一刻。" })).toBeVisible();
  await expect.element(page.getByRole("link", { name: /也可以单人挑战/ })).toHaveAttribute("href", "/solo?theme=sekai");
});
