import Image from "next/image";

/**
 * The app icon as the signed-in navigation's logo: the black squircle, or in
 * dark mode the light one (design/logo/app-icon-gradient-light-squircle-1024.png
 * at 256px), so it stands off the dark page instead of sinking into it.
 *
 * Both are in the page and CSS shows one — the `dark` class is set before the
 * first paint, so the right one shows from the start. Only inside the
 * signed-in shell, where the `dark:` variant applies.
 */
export function LogoMark({ size }: { size: number }) {
  return (
    <>
      <Image src="/logo-mark.png" alt="" width={size} height={size} className="block dark:hidden" />
      <Image src="/logo-mark-light.png" alt="" width={size} height={size} className="hidden dark:block" />
    </>
  );
}
