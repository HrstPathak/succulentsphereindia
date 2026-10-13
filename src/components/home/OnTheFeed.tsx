"use client";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { mediaAsset } from "@/lib/media";

// ─── Replace these with your hosted product/lifestyle video URLs ────────────
const VIDEOS = [
  {
    id: 1,
    src: mediaAsset("sites/videos/91c4ec8634-311ceaee95a74c1095c42633a60a1ddb.mp4"),
    poster: mediaAsset("sites/images/e46dc99640-String_Of_Pearls_Elegant_Trailing_Succulent.png"),
    label: "@succulentsphere",
  },
  {
    id: 2,
    src: mediaAsset("sites/videos/7af6c70339-4e662069ff444f57b0e5d93899d435e6.mp4"),
    poster: mediaAsset("sites/images/27bf3d6711-Chinese_Dunce_cap_Succulent.jpg"),
    label: "@succulentsphere",
  },
  {
    id: 3,
    src: mediaAsset("sites/videos/e366e30bab-782264ef0d3c4a96b6a500630e1c86d4.mp4"),
    poster: mediaAsset("sites/images/b9dc289798-Lime_Green_Sencio.jpg"),
    label: "@succulentsphere",
  },
  {
    id: 4,
    src: mediaAsset("sites/videos/4b2b269e6b-eb7038fec6c24aea95dfe72f44a5845b.mp4"),
    poster: mediaAsset("sites/images/5803e6d87b-Variegated_Gollum_Jade_succulent.jpg"),
    label: "@succulentsphere",
  },
  {
    id: 5,
    src: mediaAsset("sites/videos/1f6ce48abb-d5aa7434c06e42a0b66028750bbd4cd5.mp4"),
    poster: mediaAsset("sites/images/35726c5377-Haworthia_Cymbiformis_Pallida_Angle_View.png"),
    label: "@succulentsphere",
  },
];
// ───────────────────────────────────────────────────────────────────────────

function VideoCard({ video, isCenter, onClick, isPlaying, onEnded }) {
  const videoRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [showPlay, setShowPlay] = useState(false);

  // Play / pause based on parent state
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) {
      el.play().catch(() => {});
      setShowPlay(false);
    } else {
      el.pause();
    }
  }, [isPlaying]);

  const scale = isCenter ? 1 : 0.82;
  const zIndex = isCenter ? 10 : 1;
  const opacity = isCenter ? 1 : 0.55;
  const borderRadius = "18px";
  const cardWidth = isCenter ? 220 : 140;
  const cardHeight = isCenter ? 380 : 280;

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: cardWidth,
        height: cardHeight,
        borderRadius,
        overflow: "hidden",
        flexShrink: 0,
        cursor: "pointer",
        zIndex,
        opacity,
        transition: "all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: `scale(${scale})`,
        boxShadow: isCenter
          ? "0 24px 60px rgba(0,0,0,0.28)"
          : "0 8px 24px rgba(0,0,0,0.15)",
        border: isCenter ? "2px solid rgba(255,255,255,0.12)" : "none",
      }}
    >
      {/* Poster / thumbnail shown before play */}
      {video.poster && !isPlaying && (
        <Image
          src={video.poster}
          alt={video.label}
          fill
          sizes={isCenter ? "220px" : "140px"}
          loading="lazy"
          placeholder="blur"
          blurDataURL={SHIMMER_BLUR_DATA_URL}
          className="z-[2] object-cover"
        />
      )}

      {/* Video — lazy loaded: preload="none" until clicked */}
      <video
        ref={videoRef}
        src={isCenter ? video.src : undefined} // only load src for center card
        data-src={video.src}
        poster={video.poster}
        preload="none"
        muted
        playsInline
        loop={false}
        onLoadedData={() => setLoaded(true)}
        onEnded={onEnded}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: isPlaying ? 3 : 1,
        }}
      />

      {/* Dark gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)",
          zIndex: 4,
          pointerEvents: "none",
        }}
      />

      {/* Play icon — only on center card when not playing */}
      {isCenter && !isPlaying && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid rgba(255,255,255,0.3)",
            }}
          >
            {/* Play triangle */}
            <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
              <path d="M1 1L17 10L1 19V1Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}

      {/* Pause icon — shown briefly on click while playing */}
      {isCenter && isPlaying && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 5,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
          }}
        >
          <div style={{ width: 3, height: 10, background: "#fff", borderRadius: 2 }} />
          <div style={{ width: 3, height: 10, background: "#fff", borderRadius: 2 }} />
        </div>
      )}

      {/* Username label */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 14,
          zIndex: 5,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: "0.04em",
        }}
      >
        {video.label}
      </div>
    </div>
  );
}

export default function OnTheFeed() {
  const [centerIndex, setCenterIndex] = useState(1);
  const [playingIndex, setPlayingIndex] = useState(null);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const swipeDeltaRef = useRef(0);
  const isSwipingRef = useRef(false);

  const handleCardClick = (idx) => {
    if (isSwipingRef.current) return;
    if (idx !== centerIndex) {
      // Side card clicked — bring to center, stop any playing
      setCenterIndex(idx);
      setPlayingIndex(null);
    } else {
      // Center card clicked — toggle play/pause
      setPlayingIndex((prev) => (prev === idx ? null : idx));
    }
  };

  const handleEnded = () => setPlayingIndex(null);

  // Show 3 cards: centerIndex-1, centerIndex, centerIndex+1
  const visibleIndices = [centerIndex - 1, centerIndex, centerIndex + 1].filter(
    (i) => i >= 0 && i < VIDEOS.length
  );

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeDeltaRef.current = 0;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStartRef.current.x;
    const dy = touch.clientY - swipeStartRef.current.y;

    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      isSwipingRef.current = true;
      swipeDeltaRef.current = dx;
    }
  };

  const handleTouchEnd = () => {
    const swipeDistance = swipeDeltaRef.current;
    const threshold = 40;

    if (Math.abs(swipeDistance) >= threshold) {
      if (swipeDistance < 0 && centerIndex < VIDEOS.length - 1) {
        setCenterIndex((prev) => Math.min(prev + 1, VIDEOS.length - 1));
        setPlayingIndex(null);
      }
      if (swipeDistance > 0 && centerIndex > 0) {
        setCenterIndex((prev) => Math.max(prev - 1, 0));
        setPlayingIndex(null);
      }
    }

    swipeDeltaRef.current = 0;
    window.setTimeout(() => {
      isSwipingRef.current = false;
    }, 0);
  };

  return (
    <section
      style={{
        width: "100%",
        padding: "80px 0 90px",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#7a9a7a",
            marginBottom: 10,
          }}
        >
          Community
        </p>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "clamp(32px, 6vw, 52px)",
            fontWeight: 600,
            fontStyle: "italic",
            color: "#0e1e0e",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          On the Feed
        </h2>
      </div>

      {/* ── Video carousel ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          width: "100%",
          maxWidth: 560,
          padding: "0 20px",
          position: "relative",
          touchAction: "pan-y",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {visibleIndices.map((videoIdx) => (
          <VideoCard
            key={VIDEOS[videoIdx].id}
            video={VIDEOS[videoIdx]}
            isCenter={videoIdx === centerIndex}
            isPlaying={playingIndex === videoIdx}
            onClick={() => handleCardClick(videoIdx)}
            onEnded={handleEnded}
          />
        ))}
      </div>

      {/* ── Dot indicators ── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 28,
          alignItems: "center",
        }}
      >
        {VIDEOS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCenterIndex(i); setPlayingIndex(null); }}
            style={{
              width: i === centerIndex ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === centerIndex ? "#1a3a1a" : "#c8d8c8",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* ── Tag line ── */}
      <p
        style={{
          marginTop: 20,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          color: "#9aaa9a",
          letterSpacing: "0.08em",
          fontWeight: 300,
        }}
      >
        Tag us <strong style={{ color: "#4a7a4a", fontWeight: 500 }}><a href="https://www.instagram.com/succulentsphere/">@succulentsphere</a></strong> to be featured
      </p>
    </section>
  );
}
