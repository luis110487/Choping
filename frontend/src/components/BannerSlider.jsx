import React, { useEffect } from "react";
import { storeMediaUrl } from "../lib/api";

function BannerSlider({ storeName, banner, setBanner, storeBanners, storageKey = "choping-home-banners" }) {
  const defaultImages =
    storeName === "EcoRuedas"
      ? [
          "/ecorruedas-banner.png",
          "/ecorruedas-banner.png",
          "/ecorruedas-banner.png",
        ]
      : storeName === "Casa Viva"
        ? [
            "/casaviva-banner-1.png",
            "/casaviva-banner-2.png",
            "/casaviva-banner-1.png",
          ]
        : storeName === "Tech Zone"
          ? [
              "/techzone-banner.png",
              "/techzone-banner.png",
              "/techzone-banner.png",
            ]
          : ["/banner-home-1.png", "/banner-home-2.png", "/banner-home-3.png"];
  const uploaded = (storeBanners || []).map(storeMediaUrl).filter(Boolean);
  const images = uploaded.length
    ? uploaded
    : storeName
      ? defaultImages
      : JSON.parse(localStorage.getItem(storageKey) || "null") || defaultImages;
  useEffect(() => {
    const timer = setInterval(
      () => setBanner((banner + 1) % images.length),
      6000,
    );
    return () => clearInterval(timer);
  }, [banner, setBanner]);
  return (
    <section className={`banner-slider ${storeName ? "store-banner" : "home-banner"}`}>
      <img
        className="banner-image"
        src={images[banner % images.length]}
        alt={`Banner ${banner + 1}`}
      />
      <button
        className="banner-control previous"
        onClick={() => setBanner((banner + images.length - 1) % images.length)}
      >
        ‹
      </button>
      <button
        className="banner-control next"
        onClick={() => setBanner((banner + 1) % images.length)}
      >
        ›
      </button>
      <div className="banner-dots">
        {images.map((_, i) => (
          <button
            key={i}
            className={i === banner ? "active" : ""}
            aria-label={`Mostrar banner ${i + 1}`}
            onClick={() => setBanner(i)}
          />
        ))}
      </div>
    </section>
  );
}

export { BannerSlider };
