export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const previousFocus = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = "position:fixed;top:0;left:-9999px";
  document.body.append(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (!document.execCommand("copy")) throw new Error("复制失败");
  } finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement)
      previousFocus.focus({ preventScroll: true });
  }
}
