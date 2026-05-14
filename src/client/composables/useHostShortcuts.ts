import { onMounted, onUnmounted } from 'vue';

export function useHostShortcuts(gameStore: any) {
  function handleGlobalShortcut(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) || target.isContentEditable) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    let cmd = "";
    if (event.code === "Space" || event.key === "ArrowRight") cmd = "start";
    else if (event.code === "KeyR") cmd = "recrop";
    else if (event.code === "KeyV") cmd = "reveal";
    else if (event.code === "Enter") cmd = "correct";
    else if (event.code === "Backspace") cmd = "wrong";
    else if (event.code === "KeyS") cmd = "skip";
    else if (event.code === "KeyU") cmd = "undo";
    else if (event.code === "Digit1") cmd = "team";
    else if (event.code === "Digit2") cmd = "team";
    else if (event.code === "Escape") cmd = "stop";

    if (cmd) {
      event.preventDefault();
      if (cmd === "team") {
        gameStore.command("team", { team: event.code === "Digit1" ? "A" : "B" });
      } else {
        gameStore.command(cmd);
      }
    }
  }

  onMounted(() => {
    document.addEventListener("keydown", handleGlobalShortcut);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleGlobalShortcut);
  });
}
