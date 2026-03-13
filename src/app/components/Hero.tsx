import { HeroSphere } from "./HeroSphere";

/**
 * Hero section — renders the particle sphere variant.
 */
export const Hero = ({ ready = true }: { ready?: boolean }) => {
  return <HeroSphere ready={ready} />;
};
