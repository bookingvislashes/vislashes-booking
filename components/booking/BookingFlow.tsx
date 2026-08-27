"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bookingSchema, BookingFormData, stepFields } from "@/lib/schemas";
import { ProgressBar } from "./ProgressBar";
import { ServiceSelector } from "./ServiceSelector";
import { CalendarPicker } from "./CalendarPicker";
import { CustomerForm } from "./CustomerForm";
import { IntakeQuestions } from "./IntakeQuestions";
import { MedicalForm } from "./MedicalForm";
import { AgreementForm } from "./AgreementForm";
import { PaymentStep } from "./PaymentStep";
import { Button } from "@/components/ui/button";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  deposit_amount: number;
  duration_minutes: number;
  image_url: string | null;
}

interface BookingFlowProps {
  services: Service[];
  removalPrice: number;
  removalMinutes: number;
}

const TOTAL_STEPS = 7;

export function BookingFlow({
  services,
  removalPrice,
  removalMinutes,
}: BookingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const searchParams = useSearchParams();

  const form = useForm<BookingFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(bookingSchema) as any,
    defaultValues: {
      serviceId: "",
      bookingDate: "",
      timeSlot: "",
      fullName: "",
      phone: "",
      email: "",
      hasHadExtensions: undefined as unknown as boolean,
      isSpecialOccasion: false,
      occasionDetails: "",
      hasCataracts: false,
      hasConjunctivitis: false,
      hasDryEye: false,
      hasGlaucoma: false,
      otherComplaints: "",
      doctorName: "",
      surgeryNotes: "",
      medicalAcknowledgment: false,
      filmingConsent: false,
      liabilityWaiverSigned: false,
      termsAccepted: false,
      signatureData: "",
      paymentMethod: "square",
    },
    mode: "onChange",
  });

  // A homepage "Book [Set]" button links here as /book?service=<id> so a
  // visitor who already knows what they want doesn't have to pick it again —
  // land straight on the calendar with that set already chosen. Silently a
  // no-op for a stale or deactivated service id, or no param at all.
  useEffect(() => {
    const preselected = searchParams.get("service");
    if (!preselected) return;
    const match = services.find((s) => s.id === preselected);
    if (!match) return;
    form.setValue("serviceId", match.id, { shouldValidate: true });
    setCurrentStep(2);
    // Intentionally once, on mount: this is a one-time entry point, not a
    // sync that should fight her subsequent picks as she moves through steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = async () => {
    const fields = stepFields[currentStep];
    if (fields) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ServiceSelector
            form={form}
            services={services}
            removalPrice={removalPrice}
            removalMinutes={removalMinutes}
          />
        );
      case 2:
        return (
          <CalendarPicker
            form={form}
            serviceId={form.watch("serviceId")}
            hasRemoval={form.watch("hasRemoval")}
          />
        );
      case 3:
        return <CustomerForm form={form} />;
      case 4:
        return <IntakeQuestions form={form} />;
      case 5:
        return <MedicalForm form={form} />;
      case 6:
        return (
          <AgreementForm
            form={form}
            depositAmount={
              services.find((s) => s.id === form.getValues("serviceId"))
                ?.deposit_amount ?? 0
            }
          />
        );
      case 7:
        return <PaymentStep form={form} services={services} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      <div className="transition-opacity duration-150">{renderStep()}</div>

      {/* Navigation buttons */}
      {currentStep < TOTAL_STEPS && (
        <div className="flex gap-3 mt-8">
          {currentStep > 1 && (
            <Button type="button" variant="secondary" onClick={goBack}>
              Back
            </Button>
          )}
          <Button type="button" onClick={goNext} className="flex-1">
            Continue
          </Button>
        </div>
      )}
      {currentStep === TOTAL_STEPS && (
        <div className="mt-4">
          <Button type="button" variant="ghost" onClick={goBack}>
            &larr; Back
          </Button>
        </div>
      )}
    </div>
  );
}
