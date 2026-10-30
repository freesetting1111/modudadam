import {
  Baby, BookOpenText, CarFront, Clapperboard, CookingPot, Dumbbell,
  House, Luggage, MapPinned, Palette, PawPrint, Sparkles,
} from "lucide-react";

export const categories = [
  { code: "pets", name: "동물·반려동물", icon: PawPrint, short: "반려동물" },
  { code: "food", name: "음식·요리", icon: CookingPot, short: "음식·요리" },
  { code: "home", name: "집·주거·살림", icon: House, short: "집·살림" },
  { code: "hobby", name: "취미·수집", icon: Palette, short: "취미·수집" },
  { code: "travel", name: "여행·나들이", icon: Luggage, short: "여행" },
  { code: "wellness", name: "운동·생활습관", icon: Dumbbell, short: "운동·습관" },
  { code: "family", name: "육아·가족", icon: Baby, short: "육아·가족" },
  { code: "mobility", name: "자동차·이동생활", icon: CarFront, short: "자동차" },
  { code: "style", name: "패션·뷰티", icon: Sparkles, short: "패션·뷰티" },
  { code: "learning", name: "학습·자기계발", icon: BookOpenText, short: "학습" },
  { code: "local", name: "지역·동네생활", icon: MapPinned, short: "동네생활" },
  { code: "culture", name: "문화·콘텐츠", icon: Clapperboard, short: "문화" },
] as const;

export function findCategory(code: string) { return categories.find((category) => category.code === code); }
