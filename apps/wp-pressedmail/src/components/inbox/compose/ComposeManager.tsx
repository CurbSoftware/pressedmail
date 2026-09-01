import { useState } from "react";
import { ComposeButton } from "./ComposeButton";
import { ComposeForm } from "./ComposeForm";

export function ComposeManager() {
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleComposeClick = () => {
    setIsComposeOpen(true);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const handleClose = () => {
    setIsComposeOpen(false);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (isMaximized) setIsMaximized(false);
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (isMinimized) setIsMinimized(false);
  };

  return (
    <>
      <ComposeButton onClick={handleComposeClick} isVisible={!isComposeOpen} />
      <ComposeForm
        isOpen={isComposeOpen}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        isMinimized={isMinimized}
        isMaximized={isMaximized}
      />
    </>
  );
}
