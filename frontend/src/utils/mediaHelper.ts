import { GetPhotoFilePath } from '../../wailsjs/go/main/App';

/**
 * Vervangt alle <img src="media://OBJECT_ID"> tags in een HTML-string 
 * met het werkelijke pad opgehaald uit de Go-backend.
 */
export async function resolveMediaHtml(htmlContent: string): Promise<string> {
  if (!htmlContent) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const images = doc.querySelectorAll('img[data-media-id]');

  for (const img of Array.from(images)) {
    const mediaId = img.getAttribute('data-media-id');
    if (mediaId) {
      try {
        const filePath = await GetPhotoFilePath(mediaId);
        if (filePath) {
          // Correcte template string notatie met backticks en slashes voor WebView2 / Browser
          const formattedPath = filePath.replace(/\\/g, '/');
          img.setAttribute('src', `${formattedPath}`);
        }
      } catch (err) {
        console.error(`Kon bestandspad niet ophalen voor mediaId ${mediaId}:`, err);
      }
    }
  }

  return doc.body.innerHTML;
}