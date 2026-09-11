import { useState, useRef, useEffect } from "react";
import { Image } from "@/components/ui/image";
import { Loader2, X, Camera } from "lucide-react";

export default function PhotoUploader({
  photos = [],
  onChange,
  maxPhotos = 10,
  label = "Property photos",
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const objectUrlsRef = useRef(new Map());

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
    };
  }, []);

  const getPreviewUrl = (photo) => {
    if (typeof photo === "string") return photo;

    if (photo instanceof File) {
      if (!objectUrlsRef.current.has(photo)) {
        objectUrlsRef.current.set(photo, URL.createObjectURL(photo));
      }
      return objectUrlsRef.current.get(photo);
    }

    return "";
  };

  const handleFiles = async (files) => {
    const remaining = maxPhotos - photos.length;
    const toAdd = Array.from(files).slice(0, remaining);

    if (toAdd.length === 0) return;

    setUploading(true);

    try {
      onChange([...photos, ...toAdd]);
    } finally {
      setUploading(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const removePhoto = (idx) => {
    const photo = photos[idx];

    if (photo instanceof File) {
      const url = objectUrlsRef.current.get(photo);

      if (url) {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(photo);
      }
    }

    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>

      <p className="text-xs text-muted-foreground mb-3">
        Upload up to {maxPhotos} photos. The first photo will be the cover image.
      </p>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {photos.map((photo, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-lg overflow-hidden border border-border group"
            >
              <Image
                src={getPreviewUrl(photo)}
                alt={`Photo ${i + 1}`}
                className="w-full h-full"
                fittingType="fill"
              />

              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                  Cover
                </span>
              )}

              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < maxPhotos && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Preparing...</span>
            </>
          ) : (
            <>
              <Camera className="w-6 h-6" />
              <span className="text-sm">Click to upload photos</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) =>
          e.target.files?.length > 0 && handleFiles(e.target.files)
        }
      />
    </div>
  );
}