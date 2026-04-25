export function downloadMarkdown(filename: string, content: string) {
  const element = document.createElement("a");
  const file = new Blob([content], { type: "text/markdown" });
  element.href = URL.createObjectURL(file);
  element.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
