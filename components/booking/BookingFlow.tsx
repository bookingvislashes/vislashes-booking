"use client";

import { useState } from "react";
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
}

const TOTAL_STEPS = 7;

export function BookingFlow({ services }: BookingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);

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
        return <ServiceSelector form={form} services={services} />;
      case 2:
        return (
          <CalendarPicker
            form={form}
            serviceId={form.watch("serviceId")}
          />
        );
      case 3:
        return <CustomerForm form={form} />;
      case 4:
        return <IntakeQuestions form={form} />;
      case 5:
        return <MedicalForm form={form} />;
      case 6:
        return <AgreementForm form={form} />;
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
