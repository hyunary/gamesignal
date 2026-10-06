export default function Monogram({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="5" fill="var(--nc-ink)" />
      <path fill="var(--nc-paper)" d="M10 47V17h6l13 20V17h6v30h-6L16 27v20z" />
      <path fill="var(--nc-paper)" d="M51 27c-8-5-17 1-17 10s9 15 17 10v-6c-5 4-11 1-11-4s6-8 11-4z" />
      <circle cx="55" cy="47" r="3" fill="#ed9671" />
    </svg>
  );
}
