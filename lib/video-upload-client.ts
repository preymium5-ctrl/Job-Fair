import { VIDEO_CHUNK_BYTES } from "./video-applications";

export class VideoUploadError extends Error {
  /** True when the Drive upload link no longer works and a new one is needed. */
  constructor(message: string, readonly restart = false) { super(message); }
}

type Reply = { status: number; body: string; range: string | null };

function send(url: string, body: Blob | null, contentRange: string, onProgress?: (loaded: number) => void): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 10 * 60 * 1000;
    xhr.setRequestHeader("Content-Range", contentRange);
    if (onProgress) xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      let range: string | null = null;
      try { range = xhr.getResponseHeader("Range"); } catch { range = null; }
      resolve({ status: xhr.status, body: xhr.responseText, range });
    };
    xhr.onerror = () => reject(new Error("NETWORK"));
    xhr.ontimeout = () => reject(new Error("NETWORK"));
    xhr.send(body);
  });
}

/** Bytes Drive already holds, from a "bytes=0-N" Range header. */
function received(range: string | null) {
  const match = range && /^bytes=0-(\d+)$/.exec(range.trim());
  return match ? Number(match[1]) + 1 : null;
}

function fileId(reply: Reply) {
  try {
    const file = JSON.parse(reply.body) as { id?: unknown };
    if (typeof file.id === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(file.id)) return file.id;
  } catch { /* fall through */ }
  throw new VideoUploadError("We couldn’t confirm your video upload. Select Submit to try again.", true);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends the video straight to its private Google Drive upload, in parts, so a
 * dropped connection only repeats the current part. Returns the Drive file ID.
 * Calling it again with the same URL resumes where Drive stopped.
 */
export async function uploadVideoToDrive(url: string, file: File, onProgress: (sentBytes: number) => void, resume = false): Promise<string> {
  const total = file.size;
  let offset = 0;
  let failures = 0;
  // A resumed upload first asks Drive how much it already has.
  let askFirst = resume;
  while (true) {
    try {
      if (askFirst) {
        const status = await send(url, null, `bytes */${total}`);
        if (status.status === 200 || status.status === 201) { onProgress(total); return fileId(status); }
        if (status.status === 308) offset = received(status.range) ?? 0;
        else if (status.status === 404 || status.status === 410) throw new VideoUploadError("Your upload link expired. Select Submit to upload the video again.", true);
        else throw new Error("RETRY");
        askFirst = false;
      }
      onProgress(offset);
      const end = Math.min(offset + VIDEO_CHUNK_BYTES, total);
      const start = offset;
      const reply = await send(url, file.slice(start, end), `bytes ${start}-${end - 1}/${total}`, (loaded) => onProgress(start + loaded));
      if (reply.status === 200 || reply.status === 201) { onProgress(total); return fileId(reply); }
      if (reply.status === 308) {
        // Drive reports how much it kept. Without that header, it kept the whole part.
        offset = received(reply.range) ?? end;
        failures = 0;
        continue;
      }
      if (reply.status === 404 || reply.status === 410) throw new VideoUploadError("Your upload link expired. Select Submit to upload the video again.", true);
      if (reply.status >= 400 && reply.status < 500 && reply.status !== 408 && reply.status !== 429)
        throw new VideoUploadError("Google Drive did not accept this video. Choose the video again and select Submit.", true);
      throw new Error("RETRY");
    } catch (error) {
      if (error instanceof VideoUploadError) throw error;
      failures += 1;
      if (failures > 5) throw new VideoUploadError("Your connection was interrupted. Select Submit to continue uploading from where it stopped.");
      await wait(Math.min(15000, 1000 * 2 ** failures));
      askFirst = true;
    }
  }
}

/** Reads the video length in the browser. Null when this browser cannot read the format. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(value);
    };
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    video.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);
    video.src = url;
  });
}
