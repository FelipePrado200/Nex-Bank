import {
  Armchair,
  Backpack,
  BookOpen,
  Camera,
  Coffee,
  Footprints,
  Gamepad2,
  Glasses,
  Headphones,
  Keyboard,
  Lamp,
  Laptop,
  Mouse,
  Package,
  Shirt,
  Speaker,
  Watch,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  headphones: Headphones,
  keyboard: Keyboard,
  mouse: Mouse,
  speaker: Speaker,
  watch: Watch,
  camera: Camera,
  gamepad: Gamepad2,
  laptop: Laptop,
  lamp: Lamp,
  coffee: Coffee,
  armchair: Armchair,
  backpack: Backpack,
  shirt: Shirt,
  footprints: Footprints,
  glasses: Glasses,
  book: BookOpen,
};

/** Product artwork: a line icon, resolved from the `icon` key stored with the product. */
export function ProductIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Package;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
