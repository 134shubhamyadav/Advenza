export interface PhotoSlot {
  id: string;
  x: number; // 0-1 (normalized percentage)
  y: number; // 0-1
  width: number; // 0-1
  height: number; // 0-1
  rotation?: number; // degrees
}

export interface TextSlot {
  id: string; // e.g. "DESTINATION", "DATE"
  x: number;
  y: number;
  maxWidth: number;
  align: "left" | "center" | "right";
  fontSize: number;
  fontWeight: string | number;
  color: string;
  opacity: number;
  fontFamily: string;
}

export interface CollageTemplate {
  id: string;
  name: string;
  thumbnailUrl: string;
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
  photoSlots: PhotoSlot[];
  textSlots: TextSlot[];
  style: {
    background: string;
    borderRadius: number;
    gap: number;
    padding: number;
  };
}

export const COLLAGE_TEMPLATES: CollageTemplate[] = [
  {
    id: "minimal-split",
    name: "Minimal Split",
    thumbnailUrl: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=200&q=75&auto=format&fit=crop",
    aspectRatio: "4:5",
    photoSlots: [
      { id: "PHOTO_1", x: 0.05, y: 0.05, width: 0.9, height: 0.42 },
      { id: "PHOTO_2", x: 0.05, y: 0.5, width: 0.9, height: 0.42 },
    ],
    textSlots: [
      {
        id: "DESTINATION",
        x: 0.5,
        y: 0.95,
        maxWidth: 0.8,
        align: "center",
        fontSize: 24,
        fontWeight: "bold",
        color: "#1a1a1a",
        opacity: 1,
        fontFamily: "'Instrument Serif', serif",
      },
    ],
    style: {
      background: "#f8f9fa",
      borderRadius: 16,
      gap: 0,
      padding: 0,
    },
  },
  {
    id: "polaroid-grid",
    name: "Polaroid Grid",
    thumbnailUrl: "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=200&q=75&auto=format&fit=crop",
    aspectRatio: "1:1",
    photoSlots: [
      { id: "PHOTO_1", x: 0.05, y: 0.05, width: 0.425, height: 0.425 },
      { id: "PHOTO_2", x: 0.525, y: 0.05, width: 0.425, height: 0.425 },
      { id: "PHOTO_3", x: 0.05, y: 0.525, width: 0.425, height: 0.425 },
      { id: "PHOTO_4", x: 0.525, y: 0.525, width: 0.425, height: 0.425 },
    ],
    textSlots: [
      {
        id: "TITLE",
        x: 0.5,
        y: 0.5,
        maxWidth: 0.5,
        align: "center",
        fontSize: 32,
        fontWeight: "bold",
        color: "#ffffff",
        opacity: 1,
        fontFamily: "'Inter', sans-serif",
      },
    ],
    style: {
      background: "#121212",
      borderRadius: 8,
      gap: 0,
      padding: 0,
    },
  }
];
