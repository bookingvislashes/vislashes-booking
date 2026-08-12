"use client";

import { useRef, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { BookingFormData } from "@/lib/schemas";
import { Modal } from "@/components/ui/modal";
import SignatureCanvas from "react-signature-canvas";

interface AgreementFormProps {
  form: UseFormReturn<BookingFormData>;
}

const WAIVER_TEXT = `LASH CONSENTS, RELEASE, AND WAIVER OF LIABILITY AGREEMENT

By signing this agreement, I acknowledge that I have been informed of the potential risks associated with eyelash extension application, including but not limited to: allergic reactions to adhesive or other products, eye irritation, temporary or permanent loss of natural eyelashes, and eye infections.

I confirm that I have disclosed all relevant medical conditions and allergies. I understand that the lash artist is not a medical professional and cannot provide medical advice.

I release VIS Lashes, its owner, and its employees from any liability for injury or damage that may result from the application of eyelash extensions.

I understand that results may vary and that VIS Lashes does not guarantee specific outcomes.`;

const TERMS_TEXT = `TERMS AND CONDITIONS

1. A $10 non-refundable deposit is required to secure your appointment.
2. Cancellations must be made at least 24 hours before the scheduled appointment.
3. Late cancellations or no-shows may forfeit the deposit.
4. Please arrive with clean, makeup-free eyes.
5. The remaining balance is due at the time of your appointment.
6. We accept cash, credit/debit cards, Apple Pay, and PayPal.
7. A $3 convenience fee applies to cash payments.
8. Refills are recommended every 2-3 weeks.
9. VIS Lashes is not responsible for improper aftercare by the client.
10. By booking an appointment, you agree to these terms and conditions.`;

export function AgreementForm({ form }: AgreementFormProps) {
  const { register, setValue, formState: { errors } } = form;
  const sigRef = useRef<SignatureCanvas>(null);
  const [modalContent, setModalContent] = useState<{ title: string; text: string } | null>(null);

  const handleSignatureEnd = () => {
    if (sigRef.current) {
      const data = sigRef.current.toDataURL();
      setValue("signatureData", data, { shouldValidate: true });
    }
  };

  const clearSignature = () => {
    if (sigRef.current) {
      sigRef.current.clear();
      setValue("signatureData", "", { shouldValidate: true });
    }
  };

  return (
    <div>
      <h2 className="font-display text-[24px] font-bold text-dark-brown mb-1">
        Agreements
      </h2>
      <p className="font-sans text-[14px] text-charcoal mb-6">
        Please review and accept the following agreements.
      </p>

      <div className="flex flex-col gap-4">
        {/* Filming consent */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-deep-brown w-4 h-4 mt-0.5"
            {...register("filmingConsent")}
          />
          <span className="font-sans text-[13px] text-charcoal">
            Will you allow us to film our work? (Optional)
          </span>
        </label>

        {/* Liability waiver */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="accent-deep-brown w-4 h-4 mt-0.5"
            {...register("liabilityWaiverSigned")}
          />
          <div>
            <span className="font-sans text-[13px] text-charcoal">
              Check to Accept our Lash Consents, Release, and Waiver of Liability Agreement
            </span>
            <button
              type="button"
              onClick={() =>
                setModalContent({
                  title: "Liability Waiver",
                  text: WAIVER_TEXT,
                })
              }
              className="block text-deep-brown text-[12px] font-semibold mt-1 underline cursor-pointer font-sans"
            >
              Read Terms
            </button>
            {errors.liabilityWaiverSigned && (
              <p className="text-danger text-[12px] mt-1 font-sans">
                {errors.liabilityWaiverSigned.message}
              </p>
            )}
          </div>
        </div>

        {/* Terms and conditions */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="accent-deep-brown w-4 h-4 mt-0.5"
            {...register("termsAccepted")}
          />
          <div>
            <span className="font-sans text-[13px] text-charcoal">
              I have read and agree to the terms and conditions
            </span>
            <button
              type="button"
              onClick={() =>
                setModalContent({
                  title: "Terms & Conditions",
                  text: TERMS_TEXT,
                })
              }
              className="block text-deep-brown text-[12px] font-semibold mt-1 underline cursor-pointer font-sans"
            >
              Read Terms
            </button>
            {errors.termsAccepted && (
              <p className="text-danger text-[12px] mt-1 font-sans">
                {errors.termsAccepted.message}
              </p>
            )}
          </div>
        </div>

        {/* Signature */}
        <div className="mt-4">
          <p className="text-dark-brown text-[12px] font-semibold font-sans mb-2">
            Digital Signature
          </p>
          {/* clearOnResize defaults to true, and the library only skips its
              resize handler when BOTH width and height are given. On a phone,
              collapsing the address bar or opening the keyboard fires resize —
              which wiped the drawn signature while signatureData kept the old
              PNG, so the step passed validation over a visibly blank pad and a
              waiver was stored that the client never saw themselves sign.
              Fixing width alongside height also stops retina strokes in the
              lower half falling outside the bitmap. */}
          <SignatureCanvas
            ref={sigRef}
            onEnd={handleSignatureEnd}
            clearOnResize={false}
            canvasProps={{
              className: "sig-canvas w-full bg-white rounded-surface border border-light-tan",
              width: 600,
              height: 200,
            }}
          />
          <button
            type="button"
            onClick={clearSignature}
            className="mt-2 text-muted text-[12px] font-semibold underline cursor-pointer font-sans"
          >
            Clear signature
          </button>
          {errors.signatureData && (
            <p className="text-danger text-[12px] mt-1 font-sans">
              {errors.signatureData.message}
            </p>
          )}
        </div>
      </div>

      {/* Modal for reading full agreement text */}
      <Modal
        isOpen={!!modalContent}
        onClose={() => setModalContent(null)}
        title={modalContent?.title}
      >
        <pre className="whitespace-pre-wrap font-sans text-[13px] text-charcoal leading-relaxed">
          {modalContent?.text}
        </pre>
      </Modal>
    </div>
  );
}
