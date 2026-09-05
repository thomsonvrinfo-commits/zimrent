import { useState, useRef } from "react";
import { zimrent } from "@/api/zimrentClient";
import { Image } from "@/components/ui/image";
import { Loader2, X, Camera } from "lucide-react";

export default function PhotoUploader({ photos = [], onChange, maxPhotos = 10, label = "Property photos" }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (files) => {
    const remaining = maxPhotos - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of toUpload) {
        const { file_url } = await zimrent.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      onChange([...photos, ...urls]);
    } catch (e) {
      alert("Upload failed: " + e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = (idx) => {
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <p className="text-xs text-muted-foreground mb-3">Upload up to {maxPhotos} photos. The first photo will be the cover image.</p>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {photos.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
              <Image src={url} alt={`Photo ${i + 1}`} className="w-full h-full" fittingType="fill" />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Cover</span>
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
            <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Uploading...</span></>
          ) : (
            <><Camera className="w-6 h-6" /><span className="text-sm">Click to upload photos</span></>
          )}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length > 0 && handleFiles(e.target.files)}
      />
    </div>
  );
}