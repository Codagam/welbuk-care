// Ambient declarations for CSS imports (NativeWind global stylesheet + any CSS
// modules used by web components). Expo also emits these on `expo start`, but
// declaring them here keeps `tsc --noEmit` green in CI without a running metro.
declare module "*.css";

declare module "*.module.css" {
  const content: { [className: string]: string };
  export default content;
}
