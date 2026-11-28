import { useRef } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { policyIntroduction, policySections } from "./privacyPolicyContent";

export default function PrivacyPolicyDialog({ theme }: { theme: "light" | "dark" }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root>
      <Dialog.Trigger className="privacy-dialog-trigger">Privacy Policy</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="privacy-dialog-backdrop" />
        <Dialog.Popup className="landing privacy-dialog" data-theme={theme} initialFocus={closeButton}>
          <div className="privacy-dialog-header">
            <Dialog.Title>Privacy Policy</Dialog.Title>
            <Dialog.Close className="privacy-dialog-icon" aria-label="Close privacy policy">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="privacy-dialog-body" tabIndex={0}>
            {policyIntroduction}
            {policySections.map(({ id, title, content }) => (
              <section className="privacy-section" key={id}>
                <h3>{title}</h3>
                {content}
              </section>
            ))}
          </div>
          <div className="privacy-dialog-footer">
            <Dialog.Close className="landing-button" ref={closeButton}>Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
