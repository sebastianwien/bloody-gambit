/** Lädt ein Bild über onload (decode() hängt in Hintergrund-Tabs mancher Browser). */
export function loadImage(url: string, timeoutMs = 15000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('Zeitüberschreitung: ' + url)), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Bild fehlt: ' + url));
    };
    img.src = url;
  });
}
