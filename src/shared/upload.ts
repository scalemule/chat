import type { ApiResponse } from '../types';

const RETRY_DELAYS_MS = [0, 1000, 3000];
const STALL_TIMEOUT_MS = 45_000;
const RETRYABLE_STATUS_CODES = new Set([0, 408, 429, 500, 502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number, code?: string): boolean {
  if (code === 'aborted') {
    return false;
  }

  return RETRYABLE_STATUS_CODES.has(status) || code === 'upload_stalled';
}

function uploadOnce(
  url: string,
  file: Blob,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<ApiResponse<null>> {
  return new Promise((resolve) => {
    if (typeof XMLHttpRequest === 'undefined') {
      resolve({
        data: null,
        error: {
          code: 'unsupported_environment',
          message: 'XMLHttpRequest is not available in this environment',
          status: 0,
        },
      });
      return;
    }

    const xhr = new XMLHttpRequest();
    let settled = false;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let lastLoaded = 0;
    let totalBytes = file.size;

    const finish = (result: ApiResponse<null>) => {
      if (settled) return;
      settled = true;

      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }

      resolve(result);
    };

    const resetStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
      }

      stallTimer = setTimeout(() => {
        xhr.abort();
        finish({
          data: null,
          error: {
            code: 'upload_stalled',
            message: `Upload stalled (no progress for ${STALL_TIMEOUT_MS / 1000}s)`,
            status: 0,
            details: {
              bytes_sent: lastLoaded,
              total_bytes: totalBytes,
            },
          },
        });
      }, STALL_TIMEOUT_MS);
    };

    if (signal) {
      if (signal.aborted) {
        finish({
          data: null,
          error: { code: 'aborted', message: 'Upload aborted', status: 0 },
        });
        return;
      }

      signal.addEventListener(
        'abort',
        () => {
          xhr.abort();
          finish({
            data: null,
            error: { code: 'aborted', message: 'Upload aborted', status: 0 },
          });
        },
        { once: true },
      );
    }

    xhr.upload.addEventListener('progress', (event) => {
      resetStallTimer();
      lastLoaded = event.loaded;
      totalBytes = event.total || totalBytes;

      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        finish({ data: null, error: null });
        return;
      }

      finish({
        data: null,
        error: {
          code: 'upload_error',
          message: `S3 upload failed: ${xhr.status}`,
          status: xhr.status,
          details: {
            bytes_sent: lastLoaded,
            total_bytes: totalBytes,
          },
        },
      });
    });

    xhr.addEventListener('error', () => {
      finish({
        data: null,
        error: {
          code: 'upload_error',
          message: 'S3 upload failed',
          status: xhr.status || 0,
          details: {
            bytes_sent: lastLoaded,
            total_bytes: totalBytes,
          },
        },
      });
    });

    xhr.addEventListener('abort', () => {
      if (settled) return;
      finish({
        data: null,
        error: { code: 'aborted', message: 'Upload aborted', status: 0 },
      });
    });

    xhr.open('PUT', url, true);
    if (file.type) {
      xhr.setRequestHeader('Content-Type', file.type);
    }
    resetStallTimer();
    xhr.send(file);
  });
}

export async function uploadToPresignedUrl(
  url: string,
  file: Blob,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<ApiResponse<null>> {
  let lastError: ApiResponse<null>['error'] = null;

  for (const [attempt, delayMs] of RETRY_DELAYS_MS.entries()) {
    if (delayMs > 0) {
      await delay(delayMs);
    }

    const result = await uploadOnce(url, file, onProgress, signal);
    if (!result.error) {
      return result;
    }

    lastError = {
      ...result.error,
      details: {
        ...result.error.details,
        attempt: attempt + 1,
      },
    };

    if (!shouldRetry(result.error.status, result.error.code)) {
      break;
    }
  }

  return {
    data: null,
    error: lastError ?? {
      code: 'upload_error',
      message: 'Upload failed',
      status: 0,
    },
  };
}
