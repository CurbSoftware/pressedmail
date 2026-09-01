import { Plus } from "lucide-react";

import { Button } from "@kit/ui/plugin";
interface ComposeButtonProps {
  onClick: () => void;
  isVisible: boolean;
}

export function ComposeButton({ onClick, isVisible }: ComposeButtonProps) {
  if (!isVisible) return null;

  return (
    <Button
      onClick={onClick}
      data-test="compose-button"
      className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl bg-primary text-background"
      style={{
        transform: "scale(1)",
        transition: "all 0.2s ease-in-out",
      }}>
      <Plus className="h-6 w-6" />
    </Button>
  );
}
