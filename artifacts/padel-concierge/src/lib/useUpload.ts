import { useCallback, useState } from "react";

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
}

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
          }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error((e as { error?: string }).error || "Failed to get upload URL");
        }
        const data = (await res.json()) as UploadResponse;
        const putRes = await fetch(data.uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!putRes.ok) throw new Error("Failed to upload file");
        return { uploadURL: data.uploadURL, objectPath: data.objectPath };
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Upload failed");
        setError(e);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  return { uploadFile, isUploading, error };
}

/** Convert an object path like "/objects/uploads/uuid" into a fetchable URL via our API. */
export function objectUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) return objectPath;
  if (objectPath.startsWith("/objects/")) {
    return `/api/storage${objectPath}`;
  }
  return objectPath;
}
