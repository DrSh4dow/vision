/** Trigger a browser file download from binary data. */
export function downloadFile(data: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([new Uint8Array(data)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
