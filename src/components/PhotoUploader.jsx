import { useState, useRef } from "react";
import { zimrent } from "@/api/zimrentClient";
import { Image } from "@/components/ui/image";
import { Loader2, Camera } from "lucide-react";

// NOTE: this component's contract changed. The backend's POST /uploads
// requires `kind` ('photo') and, for photos, a `property_id` — a photo can
// only ever be attached to a property that already exists. So this now
// takes a required `propertyId` prop and uploads immediately on file
// selection (no more "collect local URLs, send them all at property-create
// time" — the backend never returns a usable file_url to collect, only a
// storage_key + media id).
//
// There is currently no DELETE route for property_media on the backend, so
// removing an uploaded photo isn't possible from here yet — the "remove"
// affordance from the old version is intentionally left out rather than
// faking a delete that doesn't happen server-side.
export default function PhotoUploader({ propertyId, photos = [], onChange, maxPhotos = 10, label = "Property photos" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleFiles = async (files) => {
    if (!propertyId) {
      setError("Save the property first before adding photos.");
      return;
    }
    const remaining = maxPhotos - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of toUpload) {
        // kind:'photo' requires property_id — see zimrentClient.js
        const media = await zimrent.uploads.upload(file, "photo", { propertyId });
        uploaded.push({
          id: media.id,
          property_id: media.property_id,
          // Listing likely isn't active yet, so the public photo URL (which
          // requires an active listing) won't resolve — use the owner-only
          // URL, which works regardless of listing status.
          url: zimrent.properties.photoUrlAsOwner(media.property_id, media.id),
        });
      }
      onChange([...photos, ...uploaded]);
    } catch (e) {
      setError("Upload failed: " + e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <p className="text-xs text-muted-foreground mb-3">
        {propertyId
          ? `Upload up to ${maxPhotos} photos. The first photo will be the cover image.`
          : "Save the property details first, then add photos here."}
      </p>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {photos.map((p, i) => (
            <div key={p.id || i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
              <Image src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full" fittingType="fill" />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Cover</span>
              )}
            </div>
          ))}
        </div>
      )}

      {photos.length < maxPhotos && (
        <button
          type="button"
          onClick={() => propertyId && fileRef.current?.click()}
          disabled={uploading || !propertyId}
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
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length > 0 && handleFiles(e.target.files)}
      />
    </div>
  );
}
