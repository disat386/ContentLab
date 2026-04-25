import { marked } from 'marked';

export function downloadMarkdown(filename: string, content: string) {
  const element = document.createElement("a");
  const file = new Blob([content], { type: "text/markdown" });
  element.href = URL.createObjectURL(file);
  element.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export function downloadAsTxt(filename: string, content: string) {
  const element = document.createElement("a");
  const file = new Blob([content], { type: "text/plain" });
  element.href = URL.createObjectURL(file);
  element.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export async function downloadAsDocx(filename: string, content: string) {
  const htmlContent = await marked(content);
  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Export</title></head><body>`;
  const footer = "</body></html>";
  const sourceHTML = header + htmlContent + footer;
  
  const blob = new Blob([sourceHTML], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const fileLink = document.createElement("a");
  document.body.appendChild(fileLink);
  fileLink.href = url;
  fileLink.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.doc`;
  fileLink.click();
  document.body.removeChild(fileLink);
  URL.revokeObjectURL(url);
}

export async function downloadAsHtml(filename: string, content: string) {
  const htmlContent = await marked(content);
  const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${filename}</title>
      <style>
        body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
        img { max-width: 100%; height: auto; border-radius: 8px; }
        h1, h2, h3 { color: #111; }
        blockquote { border-left: 4px solid #eee; padding-left: 20px; color: #666; font-style: italic; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;
  const blob = new Blob([styledHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
