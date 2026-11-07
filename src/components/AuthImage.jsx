import React, { useEffect, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "zimrent_access_token";

export default function AuthImage({
  src,
  alt = "",
  className = "",
  fittingType = "cover",
  ...props
}) {
  const [imageSrc, setImageSrc] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    setImageSrc(null);

    if (!src) return;

    const loadImage = async () => {
      try {
        const imageUrl = new URL(src, window.location.origin);
        const apiUrl = new URL(API_BASE_URL, window.location.origin);

        const apiPath = apiUrl.pathname.replace(/\/$/, "");

        const isApiImage =
          imageUrl.origin === apiUrl.origin &&
          imageUrl.pathname.startsWith(apiPath + "/media/");

        if (!isApiImage) {
          if (active) setImageSrc(src);
          return;
        }

        const token = window.localStorage.getItem(TOKEN_KEY);
        const headers = new Headers();

        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        const response = await fetch(imageUrl.toString(), {
          headers,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Image request failed: ${response.status}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (active) setImageSrc(objectUrl);
      } catch (error) {
        console.error("Property image could not be loaded:", error);
        if (active) setImageSrc(null);
      }
    };

    loadImage();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!imageSrc) {
    return <div className={className} role="img" aria-label={alt} />;
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={{
        objectFit: fittingType === "fill" ? "cover" : fittingType,
      }}
      {...props}
    />
  );
}