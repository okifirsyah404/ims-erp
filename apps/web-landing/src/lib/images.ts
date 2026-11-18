/**
 * Photography from the approved design (`designs/assets/generated-*.png`), shipped as
 * WebP under `public/images`. Keys describe the subject; the comment is the source asset
 * so a frame's `images/generated-N.png` reference can be traced back.
 */
export const images = {
  accessTerminal: "/images/products/access-terminal.webp", // generated
  swingBarrierDouble: "/images/products/swing-barrier-double.webp", // generated-1
  flapBarrier: "/images/products/flap-barrier.webp", // generated-2
  faceTerminal: "/images/products/face-recognition-terminal.webp", // generated-3
  tripodTurnstile: "/images/products/tripod-turnstile.webp", // generated-4
  rfidKit: "/images/products/rfid-access-kit.webp", // generated-5
  parkingKiosk: "/images/products/parking-ticket-kiosk.webp", // generated-6
  parkingBarrier: "/images/products/parking-barrier.webp", // generated-7
  accessController: "/images/products/access-controller.webp", // generated-8
  engineeringTeam: "/images/scenes/engineering-team.webp", // generated-9
  hotelLobby: "/images/scenes/hotel-lobby-gates.webp", // generated-10
  officeLobby: "/images/scenes/office-lobby-gates.webp", // generated-11
  parkingEntrance: "/images/scenes/parking-entrance.webp", // generated-12
  transitTurnstiles: "/images/scenes/transit-turnstiles.webp", // generated-13
  stadiumEntrance: "/images/scenes/stadium-entrance.webp", // generated-14
  corporateLobby: "/images/scenes/corporate-lobby.webp", // generated-15
  mallLobby: "/images/scenes/mall-lobby-gates.webp", // generated-16
  smartParkingMall: "/images/scenes/smart-parking-mall.webp", // generated-17
  swingGateGlass: "/images/products/swing-gate-glass-detail.webp", // generated-18
  officeReception: "/images/scenes/office-reception-gates.webp", // generated-19
  flapBarrierDisplay: "/images/products/flap-barrier-display.webp", // generated-20
  flapBarrierReader: "/images/products/flap-barrier-reader.webp", // generated-21
  swingGateHinge: "/images/products/swing-gate-hinge-detail.webp", // generated-22
  campusLobby: "/images/scenes/campus-lobby-gates.webp", // generated-23
  trackingMap: "/images/misc/tracking-map.webp", // generated-40
} as const;

export type ImageKey = keyof typeof images;

/** generated-24 … generated-39 → team portraits 01 … 16. */
export const portrait = (n: number) => `/images/team/portrait-${String(n).padStart(2, "0")}.webp`;

